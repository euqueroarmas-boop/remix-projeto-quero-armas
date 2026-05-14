/**
 * FASE 2B-2 — qa-venda-gerar-cobranca
 *
 * Edge function para a Equipe Quero Armas gerar cobrança Asaas a partir
 * de uma venda APROVADA em qa_vendas.
 *
 * NÃO altera webhook Asaas, contrato, processo ou checklist.
 * NÃO marca a venda como PAGA — apenas grava o vínculo de cobrança.
 *
 * Auth: requireQAStaff (JWT da equipe). Sem verify_jwt=false.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  ...qaAuthCors,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_BILLING = new Set(["PIX", "BOLETO", "CREDIT_CARD"]);

function digitsOnly(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

function isValidDueDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function safeAsaasErr(payload: unknown): Record<string, unknown> {
  // Não logar token. Reduz payload a códigos/descrições do Asaas.
  try {
    const p = payload as any;
    if (p && Array.isArray(p.errors)) {
      return { errors: p.errors.map((e: any) => ({ code: e?.code, description: e?.description })) };
    }
    return { message: String((p && (p.message || p.error)) || "asaas_error") };
  } catch {
    return { message: "asaas_error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 🔒 Apenas equipe Quero Armas autenticada.
  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;
  const ator = guard.email || guard.userId;

  // Input
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const venda_id = Number(body?.venda_id);
  const billing_type = String(body?.billing_type || "").toUpperCase();
  const dry_run = body?.dry_run === true;
  const due_date_in = typeof body?.due_date === "string" ? body.due_date : null;

  if (!Number.isFinite(venda_id) || venda_id <= 0) return json({ error: "venda_id_required" }, 400);
  if (!ALLOWED_BILLING.has(billing_type)) {
    return json({ error: "invalid_billing_type", allowed: [...ALLOWED_BILLING] }, 400);
  }
  const due_date = due_date_in && isValidDueDate(due_date_in) ? due_date_in : defaultDueDate();

  // Supabase service-role para ler/atualizar qa_vendas e qa_clientes.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Buscar venda
  const { data: venda, error: vErr } = await supabase
    .from("qa_vendas")
    .select("id, id_legado, cliente_id, status, status_validacao_valor, valor_aprovado, asaas_payment_id, asaas_customer_id, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, asaas_due_date, cobranca_status, cobranca_origem")
    .eq("id", venda_id)
    .maybeSingle();
  if (vErr) return json({ error: "db_error", detail: vErr.message }, 500);
  if (!venda) return json({ error: "venda_not_found" }, 404);

  // 2) Pré-condições
  if (venda.status_validacao_valor !== "aprovado") {
    return json({ error: "venda_nao_aprovada", status_validacao_valor: venda.status_validacao_valor }, 409);
  }
  const valor = Number(venda.valor_aprovado);
  if (!Number.isFinite(valor) || valor <= 0) {
    return json({ error: "valor_aprovado_invalido", valor_aprovado: venda.valor_aprovado }, 409);
  }
  if (String(venda.cobranca_status || "").toLowerCase() === "confirmada") {
    return json({ error: "cobranca_ja_confirmada" }, 409);
  }

  // Idempotência: se já existe asaas_payment_id, devolve o vínculo existente.
  if (venda.asaas_payment_id) {
    return json({
      success: true,
      reused: true,
      venda_id: venda.id,
      asaas_payment_id: venda.asaas_payment_id,
      asaas_customer_id: venda.asaas_customer_id,
      asaas_invoice_url: venda.asaas_invoice_url,
      asaas_bank_slip_url: venda.asaas_bank_slip_url,
      asaas_pix_payload: venda.asaas_pix_payload,
      cobranca_status: venda.cobranca_status,
    });
  }

  // 3) Cliente
  const { data: cliente, error: cErr } = await supabase
    .from("qa_clientes")
    .select("id, id_legado, nome_completo, cpf, email, celular")
    .eq("id_legado", venda.cliente_id)
    .maybeSingle();
  if (cErr) return json({ error: "db_error_cliente", detail: cErr.message }, 500);
  if (!cliente) return json({ error: "cliente_not_found", cliente_id: venda.cliente_id }, 404);

  const cpf = digitsOnly(cliente.cpf);
  if (!cliente.nome_completo || !cpf || !cliente.email) {
    return json({
      error: "cliente_incompleto",
      faltando: {
        nome: !cliente.nome_completo,
        cpf: !cpf,
        email: !cliente.email,
      },
    }, 422);
  }

  const description = `Quero Armas — Venda #${venda.id_legado ?? venda.id}`;

  // 4) Dry-run: não chama Asaas, não grava nada.
  if (dry_run) {
    await logSistemaBackend({
      tipo: "checkout",
      status: "info",
      mensagem: "qa-venda-gerar-cobranca dry_run",
      payload: { venda_id: venda.id, billing_type, due_date, valor, ator },
    });
    return json({
      success: true,
      dry_run: true,
      venda_id: venda.id,
      cliente: { id: cliente.id, nome: cliente.nome_completo, cpf, email: cliente.email },
      valor_aprovado: valor,
      billing_type,
      due_date,
      description,
      asaas_customer_id_existente: venda.asaas_customer_id || null,
      precondicoes_ok: true,
    });
  }

  // ─── A partir daqui: cobrança real ───
  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");
  if (!ASAAS_API_KEY) return json({ error: "asaas_key_missing" }, 500);
  if (!ASAAS_BASE_URL) return json({ error: "asaas_base_url_missing" }, 500);

  const asaasHeaders = {
    "Content-Type": "application/json",
    access_token: ASAAS_API_KEY,
    "User-Agent": "WMTi-Integration/1.0",
  };

  // 5) Criar/reaproveitar customer Asaas
  let asaasCustomerId = venda.asaas_customer_id || null;

  if (!asaasCustomerId) {
    const customerPayload: Record<string, unknown> = {
      name: cliente.nome_completo,
      email: cliente.email,
      cpfCnpj: cpf,
      externalReference: `qa_cliente:${cliente.id}`,
    };
    const tel = digitsOnly(cliente.celular);
    if (tel) customerPayload.mobilePhone = tel;

    try {
      // Tenta buscar primeiro por CPF para evitar duplicado.
      const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cpf}`, {
        headers: { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" },
      });
      const searchData = await searchRes.json();
      if (searchRes.ok && searchData?.data?.[0]?.id) {
        asaasCustomerId = searchData.data[0].id;
      } else {
        const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
          method: "POST",
          headers: asaasHeaders,
          body: JSON.stringify(customerPayload),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData?.id) {
          await logSistemaBackend({
            tipo: "checkout",
            status: "error",
            mensagem: "qa-venda-gerar-cobranca: falha criar customer Asaas",
            payload: { venda_id: venda.id, asaas: safeAsaasErr(createData) },
          });
          return json({ error: "asaas_customer_failed", details: safeAsaasErr(createData) }, 502);
        }
        asaasCustomerId = createData.id;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      await logSistemaBackend({
        tipo: "checkout", status: "error",
        mensagem: "qa-venda-gerar-cobranca: erro de rede ao resolver customer",
        payload: { venda_id: venda.id, error: msg },
      });
      return json({ error: "asaas_network_customer", detail: msg }, 502);
    }

    // Persistir customer mesmo antes do payment para reuso.
    await supabase.from("qa_vendas").update({ asaas_customer_id: asaasCustomerId }).eq("id", venda.id);
  }

  // 6) Re-checar idempotência logo antes de criar (corrida).
  const { data: vRecheck } = await supabase
    .from("qa_vendas")
    .select("asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, cobranca_status")
    .eq("id", venda.id)
    .maybeSingle();
  if (vRecheck?.asaas_payment_id) {
    return json({
      success: true,
      reused: true,
      venda_id: venda.id,
      asaas_payment_id: vRecheck.asaas_payment_id,
      asaas_customer_id: asaasCustomerId,
      asaas_invoice_url: vRecheck.asaas_invoice_url,
      asaas_bank_slip_url: vRecheck.asaas_bank_slip_url,
      asaas_pix_payload: vRecheck.asaas_pix_payload,
      cobranca_status: vRecheck.cobranca_status,
    });
  }

  // 7) Criar payment
  const paymentPayload = {
    customer: asaasCustomerId,
    billingType: billing_type,
    value: valor,
    dueDate: due_date,
    description,
    externalReference: `qa_venda:${venda.id}`,
  };

  let paymentData: any;
  try {
    const payRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify(paymentPayload),
    });
    paymentData = await payRes.json();
    if (!payRes.ok || !paymentData?.id) {
      await logSistemaBackend({
        tipo: "checkout", status: "error",
        mensagem: "qa-venda-gerar-cobranca: Asaas recusou payment",
        payload: { venda_id: venda.id, asaas: safeAsaasErr(paymentData) },
      });
      return json({ error: "asaas_payment_failed", details: safeAsaasErr(paymentData) }, 502);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logSistemaBackend({
      tipo: "checkout", status: "error",
      mensagem: "qa-venda-gerar-cobranca: erro de rede ao criar payment",
      payload: { venda_id: venda.id, error: msg },
    });
    return json({ error: "asaas_network_payment", detail: msg }, 502);
  }

  // 8) PIX QR Code (best-effort, não bloqueia)
  let pixPayload: string | null = null;
  if (billing_type === "PIX") {
    try {
      const pixRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" },
      });
      const pixData = await pixRes.json();
      if (pixRes.ok) pixPayload = pixData?.payload || null;
    } catch { /* ignore */ }
  }

  const invoiceUrl = paymentData.invoiceUrl || null;
  const bankSlipUrl = paymentData.bankSlipUrl || null;

  // 9) Persistir vínculo na venda — UPDATE condicional (só se ainda não tiver payment_id).
  const { data: updated, error: uErr } = await supabase
    .from("qa_vendas")
    .update({
      asaas_payment_id: paymentData.id,
      asaas_customer_id: asaasCustomerId,
      asaas_invoice_url: invoiceUrl,
      asaas_bank_slip_url: bankSlipUrl,
      asaas_pix_payload: pixPayload,
      asaas_due_date: due_date,
      cobranca_status: "aguardando_pagamento",
      cobranca_gerada_em: new Date().toISOString(),
      cobranca_origem: "equipe_quero_armas",
    })
    .eq("id", venda.id)
    .is("asaas_payment_id", null)
    .select("id")
    .maybeSingle();

  if (uErr) {
    await logSistemaBackend({
      tipo: "checkout", status: "error",
      mensagem: "qa-venda-gerar-cobranca: falha persistir vínculo (cobrança Asaas já criada)",
      payload: { venda_id: venda.id, asaas_payment_id: paymentData.id, db_error: uErr.message },
    });
    return json({
      error: "db_update_failed_after_asaas",
      asaas_payment_id: paymentData.id,
      detail: uErr.message,
    }, 500);
  }

  if (!updated) {
    // Outro processo gravou primeiro — devolver o que já está lá.
    const { data: vFinal } = await supabase
      .from("qa_vendas")
      .select("asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, cobranca_status")
      .eq("id", venda.id)
      .maybeSingle();
    await logSistemaBackend({
      tipo: "checkout", status: "warning",
      mensagem: "qa-venda-gerar-cobranca: corrida detectada — cobrança duplicada bloqueada",
      payload: { venda_id: venda.id, novo_payment_id: paymentData.id, payment_id_persistido: vFinal?.asaas_payment_id },
    });
    return json({
      success: true,
      reused: true,
      race_detected: true,
      venda_id: venda.id,
      asaas_payment_id: vFinal?.asaas_payment_id ?? null,
      cobranca_status: vFinal?.cobranca_status ?? null,
    });
  }

  await logSistemaBackend({
    tipo: "checkout", status: "success",
    mensagem: "qa-venda-gerar-cobranca: cobrança criada",
    payload: { venda_id: venda.id, asaas_payment_id: paymentData.id, billing_type, valor, ator },
  });

  return json({
    success: true,
    venda_id: venda.id,
    asaas_payment_id: paymentData.id,
    asaas_customer_id: asaasCustomerId,
    asaas_invoice_url: invoiceUrl,
    asaas_bank_slip_url: bankSlipUrl,
    asaas_pix_payload: pixPayload,
    asaas_due_date: due_date,
    cobranca_status: "aguardando_pagamento",
    billing_type,
  });
});