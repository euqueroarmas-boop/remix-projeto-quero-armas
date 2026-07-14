// qa-arsenal-cartao
// Tokeniza cartão de crédito no Asaas e armazena o token na assinatura ativa
// do Arsenal Inteligente Premium do cliente autenticado.
//
// Body: { holderName, number, expiryMonth, expiryYear, ccv, cep, addressNumber }

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
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

  const holderName    = String(body?.holderName    || "").trim();
  const number        = String(body?.number        || "").replace(/\D/g, "");
  const expiryMonth   = String(body?.expiryMonth   || "").padStart(2, "0");
  const expiryYear    = String(body?.expiryYear    || "");
  const ccv           = String(body?.ccv           || "").trim();
  const cep           = digitsOnly(body?.cep);
  const addressNumber = String(body?.addressNumber || "").trim();

  if (!holderName || number.length < 13 || !expiryMonth || expiryYear.length < 2 || !ccv || cep.length < 8 || !addressNumber) {
    return json({ error: "campos_obrigatorios", detalhe: "Preencha todos os campos do cartão." }, 400);
  }

  const admin = createClient(url, service);

  // Localiza qa_clientes pelo user_id (ou via cliente_auth_links)
  let cli: any = null;
  {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular")
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
        .select("id, id_legado, nome_completo, cpf, email, celular")
        .eq("id", link.qa_cliente_id)
        .maybeSingle();
      cli = data;
    }
  }
  if (!cli) return json({ error: "cliente_not_found" }, 403);
  const cpf = digitsOnly(cli.cpf);
  if (!cpf) return json({ error: "cpf_ausente" }, 422);

  // Assinatura ativa (qualquer status não cancelado)
  const { data: ass } = await admin
    .from("qa_arsenal_assinaturas")
    .select("id, status")
    .eq("cpf", cpf)
    .in("status", ["gratuidade", "ativa", "aguardando_pagamento"])
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ass) return json({ error: "sem_assinatura_ativa" }, 404);

  const env = getAsaasEnv();
  if ("error" in env) return json({ error: env.error }, 500);

  const customer = await createOrReuseQaAsaasCustomer(
    { id: cli.id, nome_completo: cli.nome_completo, cpf, email: cli.email, celular: cli.celular },
    env,
  );
  if (!customer.ok) return json(customer.body, customer.status);

  const tokenizePayload = {
    customer: customer.customerId,
    creditCard: { holderName, number, expiryMonth, expiryYear, ccv },
    creditCardHolderInfo: {
      name: holderName,
      email: cli.email || "",
      cpfCnpj: cpf,
      postalCode: cep,
      addressNumber,
      phone: cli.celular ? digitsOnly(cli.celular) : undefined,
    },
  };

  let tokenData: any;
  try {
    const r = await fetch(`${env.baseUrl}/creditCards/tokenize`, {
      method: "POST",
      headers: asaasHeaders(env.key),
      body: JSON.stringify(tokenizePayload),
    });
    tokenData = await r.json().catch(() => ({}));
    if (!r.ok || !tokenData?.creditCardToken) {
      const errs = safeAsaasErr(tokenData);
      return json({ error: "tokenizacao_falhou", detalhe: errs.description || "Asaas rejeitou o cartão." }, 422);
    }
  } catch (e) {
    return json({ error: "asaas_network", detalhe: e instanceof Error ? e.message : "unknown" }, 502);
  }

  // Extrai últimos 4 dígitos do número mascarado (ex: "5162**8829")
  const last4 = tokenData.creditCardNumber
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

  return json({
    success: true,
    brand:   tokenData.creditCardBrand ?? null,
    last4,
    holder:  holderName,
    expiry,
  });
});
