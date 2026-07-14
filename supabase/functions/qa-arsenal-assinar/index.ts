// qa-arsenal-assinar
// Adesão e renovação do Arsenal Inteligente Premium.
// Preço lido de qa_arsenal_planos (ativo=true) — sem hardcode.
//
// Regras:
//   • Gratuidade por CPF, uma única vez: 3 meses se o CPF tem serviço Quero
//     Armas pago; 1 mês para assinante direto. Nesse caso NÃO gera cobrança.
//   • CPF que já usou gratuidade (ou renovação): gera cobrança na Asaas —
//     CREDIT_CARD em parcelas (installment) via página da Asaas,
//     PIX/BOLETO em cobrança anual única.
//   • Aceite do termo de adesão é obrigatório (registra data/hora + IP).
//
// Body: { forma: 'CREDIT_CARD' | 'PIX' | 'BOLETO', aceite: true }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ASAAS_USER_AGENT,
  asaasHeaders,
  createOrReuseQaAsaasCustomer,
  defaultDueDate,
  digitsOnly,
  getAsaasEnv,
  safeAsaasErr,
} from "../_shared/qaAsaas.ts";

interface Plano { valor_anual: number; parcelas_max: number }

async function getActivePlano(sb: ReturnType<typeof createClient>): Promise<Plano> {
  const { data } = await sb
    .from("qa_arsenal_planos")
    .select("valor_anual, parcelas_max")
    .eq("ativo", true)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Plano | null) ?? { valor_anual: 297, parcelas_max: 12 };
}

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

function addMonths(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  const forma = String(body?.forma || "");
  if (!["CREDIT_CARD", "PIX", "BOLETO"].includes(forma)) return json({ error: "forma_invalida" }, 400);
  if (body?.aceite !== true) return json({ error: "aceite_obrigatorio" }, 400);

  const admin = createClient(url, service);

  // Plano ativo (preço/parcelas vêm de qa_arsenal_planos, não hardcoded)
  const plano = await getActivePlano(admin);
  const valorAnual = plano.valor_anual;
  const parcelas = plano.parcelas_max;
  const valorParcela = Math.round((valorAnual / parcelas) * 100) / 100;

  // 2) Localiza qa_clientes do usuário (user_id direto ou cliente_auth_links)
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
  if (!cpf) return json({ error: "cpf_ausente_no_cadastro" }, 422);

  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  // 3) Assinatura vigente? (gratuidade/ativa dentro do período, ou cobrança pendente)
  const { data: vigente } = await admin
    .from("qa_arsenal_assinaturas")
    .select("id, status, periodo_fim")
    .eq("cpf", cpf)
    .in("status", ["gratuidade", "ativa", "aguardando_pagamento"])
    .gte("periodo_fim", hojeISO)
    .order("periodo_fim", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vigente && vigente.status !== "aguardando_pagamento") {
    return json({ error: "assinatura_ja_vigente", status: vigente.status, periodo_fim: vigente.periodo_fim }, 409);
  }

  // 4) Gratuidade: só se o CPF nunca teve NENHUMA assinatura (regra: 1x por CPF)
  const { count: historico } = await admin
    .from("qa_arsenal_assinaturas")
    .select("id", { count: "exact", head: true })
    .eq("cpf", cpf);

  if ((historico ?? 0) === 0) {
    // Tem serviço pago? → 3 meses; senão assinante direto → 1 mês
    const { data: vendaPaga } = await admin
      .from("qa_vendas")
      .select("id")
      .eq("cliente_id", cli.id_legado)
      .or("status.eq.PAGO,cobranca_status.eq.confirmada")
      .limit(1)
      .maybeSingle();

    const meses = vendaPaga ? 3 : 1;
    const origem = vendaPaga ? "servico_contratado" : "assinatura_direta";
    const fim = addMonths(hoje, meses);

    const { data: nova, error: insErr } = await admin
      .from("qa_arsenal_assinaturas")
      .insert({
        cliente_id: cli.id,
        cpf,
        status: "gratuidade",
        origem_gratuidade: origem,
        periodo_inicio: hojeISO,
        periodo_fim: fim,
        forma_pagamento: forma,
        valor_anual: valorAnual,
        aceite_contrato_em: new Date().toISOString(),
        aceite_contrato_ip: ip,
      })
      .select("id")
      .single();
    if (insErr) return json({ error: "db_insert_failed", detail: insErr.message }, 500);

    return json({
      success: true,
      modo: "gratuidade",
      meses_gratis: meses,
      periodo_fim: fim,
      assinatura_id: nova.id,
    });
  }

  // 5) CPF já usou gratuidade → cobrança imediata (adesão paga ou renovação)
  const env = getAsaasEnv();
  if ("error" in env) return json({ error: env.error }, 500);

  const customer = await createOrReuseQaAsaasCustomer(
    { id: cli.id, nome_completo: cli.nome_completo, cpf, email: cli.email, celular: cli.celular },
    env,
  );
  if (!customer.ok) return json(customer.body, customer.status);

  // Reaproveita cobrança pendente se já existir (evita duplicar payment na Asaas)
  if (vigente?.status === "aguardando_pagamento") {
    const { data: pend } = await admin
      .from("qa_arsenal_assinaturas")
      .select("id, asaas_invoice_url, asaas_payment_id, periodo_fim")
      .eq("id", vigente.id)
      .maybeSingle();
    if (pend?.asaas_payment_id) {
      return json({
        success: true,
        modo: "cobranca_pendente",
        assinatura_id: pend.id,
        invoice_url: pend.asaas_invoice_url,
        periodo_fim: pend.periodo_fim,
      });
    }
  }

  const dueDate = defaultDueDate(3);
  const payload: Record<string, unknown> = {
    customer: customer.customerId,
    billingType: forma,
    dueDate,
    description: "Arsenal Inteligente Premium — assinatura anual",
    externalReference: `arsenal_premium:${cli.id}`,
  };
  if (forma === "CREDIT_CARD") {
    payload.installmentCount = parcelas;
    payload.installmentValue = valorParcela;
  } else {
    payload.value = valorAnual;
  }

  let payment: any;
  try {
    const r = await fetch(`${env.baseUrl}/payments`, {
      method: "POST",
      headers: asaasHeaders(env.key),
      body: JSON.stringify(payload),
    });
    payment = await r.json().catch(() => ({}));
    if (!r.ok || !payment?.id) {
      return json({ error: "asaas_payment_failed", details: safeAsaasErr(payment) }, 502);
    }
  } catch (e) {
    return json({ error: "asaas_network", detail: e instanceof Error ? e.message : "unknown" }, 502);
  }

  // PIX: busca payload copia-e-cola + QR para exibição imediata no painel
  let pixPayload: string | null = null;
  let pixImage: string | null = null;
  if (forma === "PIX") {
    try {
      const r = await fetch(`${env.baseUrl}/payments/${payment.id}/pixQrCode`, {
        headers: { access_token: env.key, "User-Agent": ASAAS_USER_AGENT },
      });
      if (r.ok) {
        const d = await r.json();
        pixPayload = d?.payload ?? null;
        pixImage = d?.encodedImage ?? null;
      }
    } catch { /* não bloqueia a adesão */ }
  }

  const periodoFim = addDays(new Date(`${dueDate}T00:00:00`), 365);
  const { data: nova, error: insErr } = await admin
    .from("qa_arsenal_assinaturas")
    .insert({
      cliente_id: cli.id,
      cpf,
      status: "aguardando_pagamento",
      periodo_inicio: hojeISO,
      periodo_fim: periodoFim,
      forma_pagamento: forma,
      valor_anual: valorAnual,
      asaas_payment_id: payment.id,
      asaas_invoice_url: payment.invoiceUrl ?? null,
      aceite_contrato_em: new Date().toISOString(),
      aceite_contrato_ip: ip,
    })
    .select("id")
    .single();
  if (insErr) return json({ error: "db_insert_failed", detail: insErr.message }, 500);

  return json({
    success: true,
    modo: "cobranca",
    assinatura_id: nova.id,
    forma,
    valor_anual: valorAnual,
    parcelas: forma === "CREDIT_CARD" ? parcelas : 1,
    invoice_url: payment.invoiceUrl ?? null,
    bank_slip_url: payment.bankSlipUrl ?? null,
    pix_payload: pixPayload,
    pix_encoded_image: pixImage,
    due_date: dueDate,
  });
});
