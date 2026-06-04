// Reenvia o e-mail de boas-vindas Arsenal (conta gratuita) para um cliente já criado.
// Usa EXCLUSIVAMENTE o gateway SMTP existente (send-smtp-email).
// Acesso: admin OU x-internal-token.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";
import { qaArsenalWelcomeHtml, qaArsenalWelcomeText } from "../_shared/qaEmailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireAdminOrInternal(req);
  if (!guard.ok) return guard.response;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const email = String(body?.email || "").trim().toLowerCase();
  const nomeOverride = body?.nome ? String(body.nome).trim() : null;
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "email_invalido" }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Busca nome no qa_clientes (fallback para override / email)
  let nome = nomeOverride;
  if (!nome) {
    const { data } = await admin
      .from("qa_clientes")
      .select("nome_completo")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    nome = (data?.nome_completo as string | undefined) || email.split("@")[0];
  }

  const html = qaArsenalWelcomeHtml({ name: nome!, email, servicoInteresse: null });
  const text = qaArsenalWelcomeText({ name: nome!, email, servicoInteresse: null });

  const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";
  if (!internalToken) return json({ ok: false, reason: "missing_internal_token" }, 500);

  const { data: smtpData, error: smtpErr } = await admin.functions.invoke("send-smtp-email", {
    headers: { "x-internal-token": internalToken },
    body: {
      to: email,
      subject: "Bem-vindo ao Arsenal — Quero Armas",
      html,
      text,
      from_name: "Quero Armas",
    },
  });

  if (smtpErr) {
    console.error("[reenviar-boas-vindas] send-smtp-email error:", smtpErr.message);
    return json({ ok: false, reason: "smtp_failed", message: smtpErr.message }, 502);
  }

  return json({ ok: true, to: email, nome, smtp: smtpData ?? null });
});