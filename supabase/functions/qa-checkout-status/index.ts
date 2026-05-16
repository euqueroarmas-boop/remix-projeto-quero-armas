// FASE 2C-3 — qa-checkout-status (PÚBLICA, anon, READ-ONLY)
//
// Polling do status de cobrança do Pipeline B (qa_vendas).
// Autorizado pelo checkout_token devolvido em qa-checkout-criar-venda.
// NÃO toca payments/contracts/quotes. NÃO faz UPDATE/INSERT.
// A reconciliação real continua sendo feita por qa-asaas-webhook.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { constantTimeEqual, sha256Hex } from "../_shared/qaAsaas.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const venda_id = Number(body?.venda_id);
  const checkout_token = String(body?.checkout_token || "");
  if (!Number.isFinite(venda_id) || venda_id <= 0) return json({ error: "venda_id_required" }, 400);
  if (!checkout_token || checkout_token.length < 16 || checkout_token.length > 256) {
    return json({ error: "checkout_token_required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: venda, error } = await supabase
    .from("qa_vendas")
    .select(
      "id, status, valor_a_pagar, asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, asaas_due_date, cobranca_status, cobranca_origem, checkout_token_hash, checkout_token_expires_at, updated_at, cobranca_gerada_em",
    )
    .eq("id", venda_id)
    .maybeSingle();
  if (error) return json({ error: "db_error", detail: error.message }, 500);
  if (!venda) return json({ error: "venda_not_found" }, 404);

  if ((venda.cobranca_origem || "") !== "checkout_site") {
    return json({ error: "venda_nao_eh_checkout_publico" }, 403);
  }

  const submittedHash = await sha256Hex(checkout_token);
  if (!venda.checkout_token_hash || !constantTimeEqual(submittedHash, venda.checkout_token_hash)) {
    return json({ error: "checkout_token_invalido" }, 401);
  }
  if (!venda.checkout_token_expires_at || new Date(venda.checkout_token_expires_at).getTime() < Date.now()) {
    return json({ error: "checkout_token_expirado" }, 401);
  }

  const statusUpper = String(venda.status || "").toUpperCase().trim();
  const cobStatus = String(venda.cobranca_status || "").toLowerCase();
  const pago = statusUpper === "PAGO" || cobStatus === "confirmada";

  return json({
    ok: true,
    venda_id: venda.id,
    pago,
    status: venda.status,
    cobranca_status: venda.cobranca_status,
    asaas_payment_id: venda.asaas_payment_id,
    asaas_invoice_url: venda.asaas_invoice_url,
    asaas_bank_slip_url: venda.asaas_bank_slip_url,
    asaas_pix_payload: venda.asaas_pix_payload,
    asaas_due_date: venda.asaas_due_date,
    valor: venda.valor_a_pagar,
    atualizado_em: venda.updated_at || venda.cobranca_gerada_em || null,
  });
});