// qa-cliente-cobranca-inline
// Central de dados de cobrança Asaas para a Central Financeira do cliente.
//
// Actions:
//   gerar_por_forma  — cria ou reutiliza payment Asaas no billing type solicitado.
//                      PIX → QR code. BOLETO → linha digitável. CREDIT_CARD → invoiceUrl.
//                      O cliente pode trocar de forma livremente; a cobrança original
//                      não é cancelada — qualquer payment pago ativa a venda via webhook.
//   reemitir_boleto  — atualiza vencimento para hoje+3d, aguarda Asaas regenerar barcode.
//   pix              — (legado) busca QR do payment principal.
//   boleto           — (legado) busca linha digitável do payment principal.
//   both             — (legado) busca PIX + boleto do payment principal.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function addDias(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();

  const url     = Deno.env.get("SUPABASE_URL")!;
  const anon    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ASAAS_API_KEY  = Deno.env.get("ASAAS_API_KEY");
  const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");

  // 1) Valida JWT
  let userId = "";
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!r.ok) return json({ error: "invalid_token" }, 401);
    const u = await r.json();
    userId = u?.id || "";
    if (!userId) return json({ error: "invalid_token" }, 401);
  } catch {
    return json({ error: "invalid_token" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const vendaId = Number(body?.venda_id);
  const action  = String(body?.action || "both");
  if (!Number.isFinite(vendaId) || vendaId <= 0) return json({ error: "venda_id_required" }, 400);

  const admin = createClient(url, service);

  // 2) Resolve qa_clientes do usuário
  let cli: { id: unknown; id_legado: unknown } | null = null;
  {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado")
      .eq("user_id", userId)
      .maybeSingle();
    cli = data;
  }
  if (!cli) {
    const { data: link } = await admin
      .from("cliente_auth_links")
      .select("qa_cliente_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (link?.qa_cliente_id) {
      const { data } = await admin
        .from("qa_clientes")
        .select("id, id_legado")
        .eq("id", link.qa_cliente_id)
        .maybeSingle();
      cli = data;
    }
  }
  if (!cli) return json({ error: "cliente_not_found" }, 403);

  // 3) Localiza venda e valida ownership
  const { data: venda } = await admin
    .from("qa_vendas")
    .select("id, id_legado, cliente_id, asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_due_date, status, cobranca_status, valor_a_pagar")
    .eq("id_legado", vendaId)
    .maybeSingle();
  if (!venda) return json({ error: "venda_not_found" }, 404);
  if (Number(venda.cliente_id) !== Number(cli.id_legado)) return json({ error: "forbidden" }, 403);
  if (!venda.asaas_payment_id) return json({ error: "sem_cobranca_asaas" }, 409);

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) return json({ error: "asaas_not_configured" }, 500);

  const headers = { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" };
  const paymentId = venda.asaas_payment_id;

  const out: Record<string, unknown> = {
    venda_id: venda.id_legado,
    asaas_payment_id: paymentId,
    asaas_invoice_url: venda.asaas_invoice_url,
    asaas_bank_slip_url: venda.asaas_bank_slip_url,
    asaas_due_date: venda.asaas_due_date,
  };

  try {
    // ── NOVA ACTION: gerar_por_forma ──────────────────────────────────────────
    if (action === "gerar_por_forma") {
      const forma = String(body?.forma || "").toUpperCase();
      if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(forma)) {
        return json({ error: "forma_invalida" }, 400);
      }
      const parcelas = Math.max(1, Math.min(12, Math.round(Number(body?.parcelas) || 1)));
      const valor    = Number(venda.valor_a_pagar || 0);
      if (valor <= 0) return json({ error: "valor_invalido" }, 400);

      // Busca o payment principal para obter customer ID e billing type atual
      let existingCustomerId:   string | null = null;
      let existingBillingType:  string | null = null;
      let existingStatus:       string | null = null;

      try {
        const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, { headers });
        if (r.ok) {
          const pd = await r.json();
          existingCustomerId  = pd?.customer    ?? null;
          existingBillingType = pd?.billingType ?? null;
          existingStatus      = pd?.status      ?? null;
          out.asaas_invoice_url     = pd?.invoiceUrl   ?? out.asaas_invoice_url;
          out.asaas_bank_slip_url   = pd?.bankSlipUrl  ?? out.asaas_bank_slip_url;
        }
      } catch { /* ignora */ }

      let targetPaymentId:    string | null = null;
      let targetInvoiceUrl:   string | null = null;
      let targetBankSlipUrl:  string | null = null;

      // Tenta reutilizar o payment principal se o billing type bater
      if (
        existingBillingType === forma &&
        ["PENDING", "OVERDUE"].includes(existingStatus || "") &&
        forma !== "CREDIT_CARD"  // CC: sempre cria novo para refletir installmentCount escolhido
      ) {
        targetPaymentId   = paymentId;
        targetInvoiceUrl  = String(out.asaas_invoice_url  || "");
        targetBankSlipUrl = String(out.asaas_bank_slip_url || "");
      }

      // Busca payment alternativo já criado para este billing type (exceto CC)
      if (!targetPaymentId && forma !== "CREDIT_CARD") {
        const extRef = `qa_alt:${venda.id_legado}:${forma}`;
        try {
          const r = await fetch(
            `${ASAAS_BASE_URL}/payments?externalReference=${encodeURIComponent(extRef)}`,
            { headers },
          );
          if (r.ok) {
            const d = await r.json();
            const found = (d?.data || []).find((p: any) =>
              ["PENDING", "OVERDUE"].includes(p.status),
            );
            if (found?.id) {
              targetPaymentId   = found.id;
              targetInvoiceUrl  = found.invoiceUrl  ?? null;
              targetBankSlipUrl = found.bankSlipUrl ?? null;
            }
          }
        } catch { /* ignora */ }
      }

      // Cria novo payment se ainda não encontrado
      if (!targetPaymentId && existingCustomerId) {
        const createPayload: Record<string, unknown> = {
          customer:          existingCustomerId,
          billingType:       forma,
          dueDate:           addDias(3),
          externalReference: `qa_alt:${venda.id_legado}:${forma}`,
          description:       `Cobrança QA #${venda.id_legado}`,
        };

        if (forma === "CREDIT_CARD" && parcelas > 1) {
          const parcelVal = Math.round((valor / parcelas) * 100) / 100;
          createPayload.installmentCount = parcelas;
          createPayload.installmentValue = parcelVal;
        } else {
          createPayload.value = valor;
        }

        const rCreate = await fetch(`${ASAAS_BASE_URL}/payments`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        const created = await rCreate.json().catch(() => ({}));
        if (!rCreate.ok || !created?.id) {
          const errMsg = (created?.errors?.[0]?.description) || (created?.description) || rCreate.status;
          return json({ error: "criacao_cobranca_falhou", detail: String(errMsg).slice(0, 300) }, 502);
        }
        targetPaymentId   = created.id;
        targetInvoiceUrl  = created.invoiceUrl  ?? null;
        targetBankSlipUrl = created.bankSlipUrl ?? null;
      }

      if (!targetPaymentId) {
        return json({ error: "nao_foi_possivel_gerar_cobranca" }, 502);
      }

      out.target_payment_id   = targetPaymentId;
      out.asaas_invoice_url   = targetInvoiceUrl  || out.asaas_invoice_url;
      out.asaas_bank_slip_url = targetBankSlipUrl || out.asaas_bank_slip_url;

      // Busca dados específicos da forma
      if (forma === "PIX") {
        const r = await fetch(`${ASAAS_BASE_URL}/payments/${targetPaymentId}/pixQrCode`, { headers });
        if (r.ok) {
          const d = await r.json();
          out.pix_payload       = d?.payload      ?? null;
          out.pix_encoded_image = d?.encodedImage ?? null;
          out.pix_expiration    = d?.expirationDate ?? null;
        } else {
          out.pix_error = `status_${r.status}`;
        }
      } else if (forma === "BOLETO") {
        // Boleto recém-criado pode precisar de alguns segundos
        if (targetPaymentId !== paymentId) {
          await new Promise(r => setTimeout(r, 1500));
        }
        const r = await fetch(`${ASAAS_BASE_URL}/payments/${targetPaymentId}/identificationField`, { headers });
        if (r.ok) {
          const d = await r.json();
          out.boleto_identification_field = d?.identificationField ?? null;
          out.boleto_barCode              = d?.barCode             ?? null;
          out.boleto_nossoNumero          = d?.nossoNumero         ?? null;
        } else {
          out.boleto_error = `status_${r.status}`;
        }
        // Busca bank_slip_url se não veio na criação
        if (!out.asaas_bank_slip_url) {
          const rp = await fetch(`${ASAAS_BASE_URL}/payments/${targetPaymentId}`, { headers });
          if (rp.ok) {
            const pd = await rp.json();
            out.asaas_bank_slip_url = pd?.bankSlipUrl ?? null;
            out.asaas_invoice_url   = pd?.invoiceUrl  ?? out.asaas_invoice_url;
          }
        }
      }
      // CREDIT_CARD: invoice_url já está em out.asaas_invoice_url — frontend abre direto

      return json({ success: true, ...out });
    }

    // ── ACTION: reemitir_boleto ───────────────────────────────────────────────
    if (action === "reemitir_boleto") {
      const novaDueDate = addDias(3);

      const rUpd = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: novaDueDate, billingType: "BOLETO" }),
      });
      if (!rUpd.ok) {
        const detail = await rUpd.text().catch(() => "");
        return json({ ...out, error: "reemissao_falhou", detail }, 422);
      }

      // Aguarda Asaas regenerar o código de barras
      await new Promise(r => setTimeout(r, 2500));

      const rBol = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/identificationField`, { headers });
      out.asaas_due_date = novaDueDate;
      if (rBol.ok) {
        const d = await rBol.json();
        out.boleto_identification_field = d?.identificationField ?? null;
        out.boleto_nossoNumero          = d?.nossoNumero         ?? null;
        out.boleto_barCode              = d?.barCode             ?? null;
      } else {
        const detail = await rBol.text().catch(() => "");
        out.boleto_error        = `status_${rBol.status}`;
        out.boleto_error_detail = detail?.slice(0, 300) ?? null;
      }

      await admin
        .from("qa_vendas")
        .update({ asaas_due_date: novaDueDate, cobranca_status: "PENDING" })
        .eq("id_legado", vendaId);

      return json({ success: true, reemitido: true, ...out });
    }

    // ── ACTIONS LEGADAS ───────────────────────────────────────────────────────
    if (action === "pix" || action === "both") {
      const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`, { headers });
      if (r.ok) {
        const d = await r.json();
        out.pix_payload       = d?.payload      ?? null;
        out.pix_encoded_image = d?.encodedImage ?? null;
        out.pix_expiration    = d?.expirationDate ?? null;
      } else {
        out.pix_error = `status_${r.status}`;
      }
    }
    if (action === "boleto" || action === "both") {
      const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/identificationField`, { headers });
      if (r.ok) {
        const d = await r.json();
        out.boleto_identification_field = d?.identificationField ?? null;
        out.boleto_nossoNumero          = d?.nossoNumero         ?? null;
        out.boleto_barCode              = d?.barCode             ?? null;
      } else {
        let billing: string | null = null;
        try {
          const p = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, { headers });
          if (p.ok) { const pd = await p.json(); billing = pd?.billingType ?? null; }
        } catch { /* ignore */ }
        out.boleto_error  = billing && billing !== "BOLETO"
          ? `nao_e_boleto_${billing.toLowerCase()}`
          : `status_${r.status}`;
        out.billing_type = billing;
      }
    }
  } catch (e) {
    return json({ ...out, network_error: e instanceof Error ? e.message : "unknown" }, 502);
  }

  return json({ success: true, ...out });
});
