/**
 * FASE 2C-2 — qa-checkout-iniciar-pagamento (PÚBLICA, anon)
 *
 * 🆕 ATUALIZADO (2026-05) — suporte a parcelamento com juros embutidos
 * (Tabela Price) calculados no SERVIDOR a partir do preço base (PIX) da
 * venda. O frontend pode SUGERIR billing_type e installment_count, mas
 * o valor cobrado é sempre recomputado aqui — o cliente não consegue
 * manipular preço via DevTools.
 *
 * Permite que o cliente que acabou de criar uma venda no checkout público
 * gere a cobrança Asaas correspondente, autorizado pelo checkout_token
 * recebido na resposta de qa-checkout-criar-venda.
 *
 * NÃO usa fluxo WMTi. NÃO toca payments/contracts/quotes/customers.
 * NÃO marca venda como PAGO. NÃO gera contrato/processo/checklist.
 * NÃO libera Arsenal. Apenas cria o payment Asaas e devolve PIX/boleto/fatura.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import {
  constantTimeEqual,
  createOrReuseQaAsaasCustomer,
  createQaVendaPayment,
  defaultDueDate,
  digitsOnly,
  getAsaasEnv,
  isValidDueDate,
  sha256Hex,
} from "../_shared/qaAsaas.ts";
import {
  DEFAULT_PRICING_CONFIG,
  calcularPrecoFinal,
  type BillingType,
} from "../_shared/checkoutPricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_BILLING = new Set(["PIX", "BOLETO", "CREDIT_CARD"]);

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || "");
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  vendaId: number | null,
  qaClienteId: number | null,
  cliIdLegado: number | null,
  tipo: string,
  descricao: string,
  dados: Record<string, unknown>,
) {
  if (!vendaId) return;
  try {
    await supabase.from("qa_venda_eventos").insert({
      venda_id: vendaId,
      qa_cliente_id: qaClienteId,
      cliente_id: cliIdLegado,
      tipo_evento: tipo,
      descricao,
      ator: "cliente_publico",
      dados_json: dados,
    });
  } catch {
    /* nunca derruba o fluxo de pagamento por log */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const venda_id = Number(body?.venda_id);
  const checkout_token = String(body?.checkout_token || "");
  const billing_type = String(body?.billing_type || "").toUpperCase();
  const due_date_in = typeof body?.due_date === "string" ? body.due_date : null;
  /* 🆕 URL de retorno após o pagamento no checkout hospedado do Asaas. */
  const success_url_in = typeof body?.success_url === "string" ? body.success_url : null;
  const success_url =
    success_url_in && /^https?:\/\//i.test(success_url_in) ? success_url_in : null;
  /* 🆕 número de parcelas — só faz sentido para CREDIT_CARD; demais ignoram. */
  const installment_count_in = Number(body?.installment_count ?? 1);

  if (!Number.isFinite(venda_id) || venda_id <= 0) return json({ error: "venda_id_required" }, 400);
  if (!checkout_token || checkout_token.length < 16 || checkout_token.length > 256) {
    return json({ error: "checkout_token_required" }, 400);
  }
  if (!ALLOWED_BILLING.has(billing_type)) {
    return json({ error: "invalid_billing_type", allowed: [...ALLOWED_BILLING] }, 400);
  }

  /* 🆕 Sanitiza installment_count: 1..maxParcelas, tudo fora vira 1. */
  const installmentCount = Math.max(
    1,
    Math.min(
      Math.trunc(Number.isFinite(installment_count_in) ? installment_count_in : 1),
      DEFAULT_PRICING_CONFIG.maxParcelas,
    ),
  );

  const due_date = due_date_in && isValidDueDate(due_date_in) ? due_date_in : defaultDueDate(3);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Carrega venda
  const { data: venda, error: vErr } = await supabase
    .from("qa_vendas")
    .select(
      "id, id_legado, cliente_id, status, valor_a_pagar, asaas_payment_id, asaas_customer_id, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, asaas_due_date, cobranca_status, cobranca_origem, checkout_token_hash, checkout_token_expires_at",
    )
    .eq("id", venda_id)
    .maybeSingle();
  if (vErr) return json({ error: "db_error", detail: vErr.message }, 500);
  if (!venda) return json({ error: "venda_not_found" }, 404);

  // 2) Origem deve ser checkout_site
  if ((venda.cobranca_origem || "") !== "checkout_site") {
    return json({ error: "venda_nao_eh_checkout_publico" }, 403);
  }

  // 3) Token: hash + expiração (constant-time)
  const submittedHash = await sha256Hex(checkout_token);
  if (!venda.checkout_token_hash || !constantTimeEqual(submittedHash, venda.checkout_token_hash)) {
    await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
      "checkout_token_invalido", "Token inválido ao iniciar pagamento", { venda_id: venda.id });
    return json({ error: "checkout_token_invalido" }, 401);
  }
  if (!venda.checkout_token_expires_at || new Date(venda.checkout_token_expires_at).getTime() < Date.now()) {
    await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
      "checkout_token_expirado", "Token expirado ao iniciar pagamento", { venda_id: venda.id });
    return json({ error: "checkout_token_expirado" }, 401);
  }

  // 4) Pré-condições de status/valor
  const statusUpper = String(venda.status || "").toUpperCase().trim();
  if (statusUpper === "PAGO") return json({ error: "venda_ja_paga" }, 409);

  const cobStatus = String(venda.cobranca_status || "").toLowerCase();
  if (cobStatus === "confirmada") return json({ error: "cobranca_ja_confirmada" }, 409);

  /* 🆕 valor_a_pagar é o PREÇO BASE (tabela / PIX à vista).
   * O servidor recalcula valor real conforme billing_type + installment_count.
   * Esta é a FONTE DA VERDADE — frontend não pode burlar. */
  const precoBase = Number(venda.valor_a_pagar);
  if (!Number.isFinite(precoBase) || precoBase <= 0) {
    return json({ error: "valor_invalido", valor_a_pagar: venda.valor_a_pagar }, 409);
  }

  let pricing;
  try {
    pricing = calcularPrecoFinal(
      precoBase,
      billing_type as BillingType,
      installmentCount,
    );
  } catch (e) {
    return json({
      error: "pricing_calc_failed",
      detail: e instanceof Error ? e.message : "unknown",
    }, 500);
  }

  // 5) Idempotência inicial
  if (venda.asaas_payment_id) {
    await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
      "checkout_cobranca_reutilizada", "Cobrança Asaas já existia", {
        asaas_payment_id: venda.asaas_payment_id,
      });
    return json({
      success: true,
      reused: true,
      venda_id: venda.id,
      asaas_payment_id: venda.asaas_payment_id,
      asaas_customer_id: venda.asaas_customer_id,
      asaas_invoice_url: venda.asaas_invoice_url,
      asaas_bank_slip_url: venda.asaas_bank_slip_url,
      asaas_pix_payload: venda.asaas_pix_payload,
      asaas_due_date: venda.asaas_due_date,
      cobranca_status: venda.cobranca_status,
    });
  }

  // 6) Cliente
  const { data: cliente, error: cErr } = await supabase
    .from("qa_clientes")
    .select("id, id_legado, nome_completo, cpf, email, celular")
    .eq("id_legado", venda.cliente_id)
    .maybeSingle();
  if (cErr) return json({ error: "db_error_cliente", detail: cErr.message }, 500);
  if (!cliente) return json({ error: "cliente_not_found" }, 404);

  const cpf = digitsOnly(cliente.cpf);
  if (!cliente.nome_completo || cpf.length !== 11 || !cliente.email || !isValidEmail(cliente.email)) {
    return json({
      error: "cliente_incompleto",
      faltando: { nome: !cliente.nome_completo, cpf: cpf.length !== 11, email: !cliente.email },
    }, 422);
  }

  // 7) Asaas env
  const env = getAsaasEnv();
  if ("error" in env) return json({ error: env.error }, 500);

  await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
    "checkout_pagamento_iniciado", "Cliente público iniciou pagamento", {
      billing_type,
      parcelas: pricing.parcelas,
      preco_base: precoBase,
      valor_cobrado: pricing.valorTotal,
      encargos_reais: pricing.encargosReais,
      encargos_fracao: pricing.encargosFracao,
      due_date,
    });

  // 8) Customer Asaas
  let asaasCustomerId = venda.asaas_customer_id || null;
  if (!asaasCustomerId) {
    const cust = await createOrReuseQaAsaasCustomer(
      {
        id: cliente.id,
        nome_completo: cliente.nome_completo,
        cpf,
        email: cliente.email,
        celular: cliente.celular,
      },
      env,
    );
    if (!cust.ok) {
      await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
        "checkout_cobranca_erro", "Falha ao resolver customer Asaas", cust.body);
      await logSistemaBackend({
        tipo: "checkout", status: "error",
        mensagem: "qa-checkout-iniciar-pagamento: customer Asaas falhou",
        payload: { venda_id: venda.id, ...cust.body },
      });
      return json(cust.body, cust.status);
    }
    asaasCustomerId = cust.customerId;
    await supabase.from("qa_vendas").update({ asaas_customer_id: asaasCustomerId }).eq("id", venda.id);
  }

  // 9) Recheca corrida
  const { data: vRe } = await supabase
    .from("qa_vendas")
    .select("asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, cobranca_status, asaas_due_date")
    .eq("id", venda.id)
    .maybeSingle();
  if (vRe?.asaas_payment_id) {
    await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
      "checkout_cobranca_reutilizada", "Race detected", { asaas_payment_id: vRe.asaas_payment_id });
    return json({
      success: true, reused: true, race_detected: true,
      venda_id: venda.id,
      asaas_payment_id: vRe.asaas_payment_id,
      asaas_customer_id: asaasCustomerId,
      asaas_invoice_url: vRe.asaas_invoice_url,
      asaas_bank_slip_url: vRe.asaas_bank_slip_url,
      asaas_pix_payload: vRe.asaas_pix_payload,
      asaas_due_date: vRe.asaas_due_date,
      cobranca_status: vRe.cobranca_status,
    });
  }

  // 10) Cria payment — agora respeitando parcelamento
  const description = `Quero Armas — Venda #${venda.id_legado ?? venda.id}`;
  const pay = await createQaVendaPayment(
    {
      vendaId: venda.id,
      customerId: asaasCustomerId!,
      billingType: billing_type as any,
      /* PIX/BOLETO → value = preço cheio.
       * CREDIT_CARD com 1x → value = pricing.valorTotal (com juros 1x).
       * CREDIT_CARD com N>1 → installmentCount + installmentValue.
       * O qaAsaas.ts trata os 3 casos a partir de installmentCount. */
      value: pricing.valorTotal,
      installmentCount: pricing.parcelas,
      installmentValue: pricing.valorParcela,
      dueDate: due_date,
      description,
      callbackSuccessUrl: success_url,
    },
    env,
  );
  if (!pay.ok) {
    await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
      "checkout_cobranca_erro", "Asaas recusou payment", pay.body);
    await logSistemaBackend({
      tipo: "checkout", status: "error",
      mensagem: "qa-checkout-iniciar-pagamento: payment Asaas falhou",
      payload: { venda_id: venda.id, ...pay.body },
    });
    return json(pay.body, pay.status);
  }

  // 11) UPDATE condicional (idempotência forte)
  const { data: updated, error: uErr } = await supabase
    .from("qa_vendas")
    .update({
      asaas_payment_id: pay.data.paymentId,
      asaas_customer_id: asaasCustomerId,
      asaas_invoice_url: pay.data.invoiceUrl,
      asaas_bank_slip_url: pay.data.bankSlipUrl,
      asaas_pix_payload: pay.data.pixPayload,
      asaas_due_date: due_date,
      cobranca_status: "aguardando_pagamento",
      cobranca_gerada_em: new Date().toISOString(),
      cobranca_origem: "checkout_site",
      /* 🆕 Auditoria de encargos — colunas adicionadas pela migration
       * 20260518_qa_vendas_parcelamento.sql. Se você ainda não rodou
       * a migration, comente esses 4 campos. */
      parcelas_cobranca: pricing.parcelas,
      valor_cobrado: pricing.valorTotal,
      encargos_reais: pricing.encargosReais,
      encargos_fracao: pricing.encargosFracao,
    })
    .eq("id", venda.id)
    .is("asaas_payment_id", null)
    .select("id")
    .maybeSingle();

  if (uErr) {
    await logSistemaBackend({
      tipo: "checkout", status: "error",
      mensagem: "qa-checkout-iniciar-pagamento: falha persistir vínculo (cobrança Asaas já criada)",
      payload: { venda_id: venda.id, asaas_payment_id: pay.data.paymentId, db_error: uErr.message },
    });
    return json({
      error: "db_update_failed_after_asaas",
      asaas_payment_id: pay.data.paymentId,
      detail: uErr.message,
    }, 500);
  }

  if (!updated) {
    const { data: vFinal } = await supabase
      .from("qa_vendas")
      .select("asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, cobranca_status, asaas_due_date")
      .eq("id", venda.id)
      .maybeSingle();
    await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
      "checkout_cobranca_reutilizada", "Race blocked after Asaas create", {
        novo_payment_id: pay.data.paymentId,
        payment_id_persistido: vFinal?.asaas_payment_id,
      });
    return json({
      success: true, reused: true, race_detected: true,
      venda_id: venda.id,
      asaas_payment_id: vFinal?.asaas_payment_id ?? null,
      asaas_invoice_url: vFinal?.asaas_invoice_url ?? null,
      asaas_bank_slip_url: vFinal?.asaas_bank_slip_url ?? null,
      asaas_pix_payload: vFinal?.asaas_pix_payload ?? null,
      asaas_due_date: vFinal?.asaas_due_date ?? null,
      cobranca_status: vFinal?.cobranca_status ?? null,
    });
  }

  await logEvent(supabase, venda.id, null, venda.cliente_id ?? null,
    "checkout_cobranca_criada", "Cobrança Asaas criada via checkout público", {
      asaas_payment_id: pay.data.paymentId,
      billing_type,
      parcelas: pricing.parcelas,
      preco_base: precoBase,
      valor_cobrado: pricing.valorTotal,
      due_date,
    });

  return json({
    success: true,
    venda_id: venda.id,
    asaas_payment_id: pay.data.paymentId,
    asaas_customer_id: asaasCustomerId,
    asaas_invoice_url: pay.data.invoiceUrl,
    asaas_bank_slip_url: pay.data.bankSlipUrl,
    asaas_pix_payload: pay.data.pixPayload,
    asaas_due_date: due_date,
    cobranca_status: "aguardando_pagamento",
    billing_type,
    /* 🆕 Frontend usa esses campos para mostrar o resumo final. */
    parcelas: pricing.parcelas,
    valor_cobrado: pricing.valorTotal,
    valor_parcela: pricing.valorParcela,
    preco_base: precoBase,
    encargos_reais: pricing.encargosReais,
  });
});
