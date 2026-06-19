// FASE 2C-3 — qa-checkout-status (PÚBLICA, anon)
//
// Polling do status de cobrança do Pipeline B (qa_vendas).
// Autorizado pelo checkout_token devolvido em qa-checkout-criar-venda.
// NÃO toca payments/contracts/quotes. A reconciliação real continua sendo
// feita por qa-asaas-webhook; este endpoint apenas faz self-heal idempotente
// do protocolo oficial quando a venda já está paga.

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
      "id, cliente_id, status, valor_a_pagar, asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, asaas_due_date, cobranca_status, cobranca_origem, checkout_token_hash, checkout_token_expires_at, cobranca_gerada_em",
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

  // Protocolo oficial (QA{SIGLA}{ANO}{SEQ}). Se a cobrança já está paga
  // mas o webhook ainda não deixou o número gravado, gera aqui de forma
  // idempotente para a tela final nunca cair no identificador temporário.
  let numero_protocolo: string | null = null;
  try {
    const { data: proto } = await supabase
      .from("qa_protocolos")
      .select("numero")
      .eq("venda_id", venda_id)
      .maybeSingle();
    numero_protocolo = (proto?.numero as string) || null;
    if (!numero_protocolo && pago) {
      const { data: generated } = await supabase.rpc("qa_gerar_protocolo", {
        p_venda_id: venda_id,
      });
      numero_protocolo = (generated as string) || null;
    }
  } catch { /* best-effort */ }

  // Credenciais temporárias do Arsenal — só quando pago, dentro do TTL
  // e ainda não foram consumidas. Gated pelo checkout_token (já validado acima).
  let portal_credenciais: {
    email: string;
    senha_temporaria: string;
    expira_em: string;
  } | null = null;
  if (pago && (venda as any).cliente_id) {
    try {
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("email, senha_temporaria, senha_temporaria_expira_em")
        .eq("id", (venda as any).cliente_id)
        .maybeSingle();
      if (
        cli?.email &&
        cli?.senha_temporaria &&
        cli?.senha_temporaria_expira_em &&
        new Date(cli.senha_temporaria_expira_em as string).getTime() > Date.now()
      ) {
        portal_credenciais = {
          email: cli.email as string,
          senha_temporaria: cli.senha_temporaria as string,
          expira_em: cli.senha_temporaria_expira_em as string,
        };
      }
    } catch { /* best-effort */ }
  }

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
    atualizado_em: venda.cobranca_gerada_em || null,
    numero_protocolo,
    portal_credenciais,
  });
});
