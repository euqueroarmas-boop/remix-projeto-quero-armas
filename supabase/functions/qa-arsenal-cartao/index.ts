// qa-arsenal-cartao
// Dois modos:
//   action: "tokenizar"              — tokeniza cartão novo digitado pelo usuário
//   action: "vincular_do_pagamento"  — extrai token do pagamento já existente (sem form)
//
// Body tokenizar: { action?, holderName, number, expiryMonth, expiryYear, ccv }
// Body vincular:  { action: "vincular_do_pagamento" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  asaasHeaders,
  createOrReuseQaAsaasCustomer,
  digitsOnly,
  getAsaasEnv,
  safeAsaasErr,
} from "../_shared/qaAsaas.ts";

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

async function resolveCliente(admin: ReturnType<typeof createClient>, userId: string) {
  {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data as any;
  }
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
      .select("id, id_legado, nome_completo, cpf, email, celular")
      .eq("id", link.qa_cliente_id)
      .maybeSingle();
    if (data) return data as any;
  }
  return null;
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

  const action = String(body?.action || "tokenizar");
  const admin  = createClient(url, service);

  const cli = await resolveCliente(admin, userId);
  if (!cli) return json({ error: "cliente_not_found" }, 403);
  const cpf = digitsOnly(cli.cpf);
  if (!cpf) return json({ error: "cpf_ausente" }, 422);

  // Assinatura ativa mais recente
  const { data: ass } = await admin
    .from("qa_arsenal_assinaturas")
    .select("id, status, forma_pagamento, asaas_payment_id")
    .eq("cpf", cpf)
    .in("status", ["gratuidade", "ativa", "aguardando_pagamento"])
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ass) return json({ error: "sem_assinatura_ativa" }, 404);

  const env = getAsaasEnv();
  if ("error" in env) return json({ error: env.error }, 500);

  // ── Modo 1: vincular token do pagamento já existente ─────────────────────────
  if (action === "vincular_do_pagamento") {
    if (!ass.asaas_payment_id || ass.forma_pagamento !== "CREDIT_CARD") {
      return json({ error: "sem_pagamento_cartao", detalhe: "A assinatura não foi paga via cartão de crédito." }, 409);
    }
    let payment: any;
    try {
      const r = await fetch(`${env.baseUrl}/payments/${ass.asaas_payment_id}`, {
        headers: asaasHeaders(env.key),
      });
      payment = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: "asaas_payment_error" }, 502);
    } catch (e) {
      return json({ error: "asaas_network", detalhe: e instanceof Error ? e.message : "unknown" }, 502);
    }

    const cc = payment?.creditCard;
    if (!cc?.creditCardToken) {
      return json({ error: "token_nao_disponivel", detalhe: "Token de cartão não encontrado neste pagamento." }, 404);
    }

    const last4 = cc.creditCardNumber ? cc.creditCardNumber.replace(/\*/g, "").slice(-4) : "????";

    await admin.from("qa_arsenal_assinaturas").update({
      asaas_credit_card_token:  cc.creditCardToken,
      asaas_credit_card_brand:  cc.creditCardBrand  ?? null,
      asaas_credit_card_last4:  last4,
      asaas_credit_card_holder: cc.creditCardHolderName ?? null,
      asaas_credit_card_expiry: null,
    }).eq("id", ass.id);

    return json({ success: true, brand: cc.creditCardBrand ?? null, last4, holder: cc.creditCardHolderName ?? null, expiry: null });
  }

  // ── Modo 2: tokenizar cartão digitado (sem CEP/endereço — campos opcionais) ──
  const holderName  = String(body?.holderName  || "").trim();
  const number      = String(body?.number      || "").replace(/\D/g, "");
  const expiryMonth = String(body?.expiryMonth || "").padStart(2, "0");
  const expiryYear  = String(body?.expiryYear  || "");
  const ccv         = String(body?.ccv         || "").trim();

  if (!holderName || number.length < 13 || !expiryMonth || expiryYear.length < 2 || !ccv) {
    return json({ error: "campos_obrigatorios", detalhe: "Preencha nome, número, validade e CVV." }, 400);
  }

  const customer = await createOrReuseQaAsaasCustomer(
    { id: cli.id, nome_completo: cli.nome_completo, cpf, email: cli.email, celular: cli.celular },
    env,
  );
  if (!customer.ok) return json(customer.body, customer.status);

  let tokenData: any;
  try {
    const r = await fetch(`${env.baseUrl}/creditCards/tokenize`, {
      method: "POST",
      headers: asaasHeaders(env.key),
      body: JSON.stringify({
        customer: customer.customerId,
        creditCard: { holderName, number, expiryMonth, expiryYear, ccv },
      }),
    });
    tokenData = await r.json().catch(() => ({}));
    if (!r.ok || !tokenData?.creditCardToken) {
      const errs = safeAsaasErr(tokenData);
      return json({ error: "tokenizacao_falhou", detalhe: errs.description || "Asaas rejeitou os dados do cartão." }, 422);
    }
  } catch (e) {
    return json({ error: "asaas_network", detalhe: e instanceof Error ? e.message : "unknown" }, 502);
  }

  const last4  = tokenData.creditCardNumber
    ? tokenData.creditCardNumber.replace(/\*/g, "").slice(-4)
    : number.slice(-4);
  const expiry = `${expiryMonth}/${expiryYear.slice(-2)}`;

  const { error: updErr } = await admin
    .from("qa_arsenal_assinaturas")
    .update({
      asaas_credit_card_token:  tokenData.creditCardToken,
      asaas_credit_card_brand:  tokenData.creditCardBrand  ?? null,
      asaas_credit_card_last4:  last4,
      asaas_credit_card_holder: holderName,
      asaas_credit_card_expiry: expiry,
    })
    .eq("id", ass.id);
  if (updErr) return json({ error: "db_update_failed", detalhe: updErr.message }, 500);

  return json({ success: true, brand: tokenData.creditCardBrand ?? null, last4, holder: holderName, expiry });
});
