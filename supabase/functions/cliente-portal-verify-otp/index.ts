import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  hashOtpCode,
  logAcesso,
  normalizeEmail,
} from "../_shared/clienteLookup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OTP_SALT = Deno.env.get("OTP_SALT") || "qa-portal-otp-v1";
const MAX_ATTEMPTS = 5;

function generatePassword(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[arr[i] % chars.length];
  return p + "!2";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = req.headers.get("x-forwarded-for") || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    const body = await req.json().catch(() => ({}));
    const { otp_id, code } = body as { otp_id?: string; code?: string };

    if (!otp_id || !code) {
      return new Response(JSON.stringify({ error: "Token e código são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: otp, error: otpErr } = await supabase
      .from("cliente_otp_codes")
      .select("id, email, code_hash, qa_cliente_id, customer_id, attempts, consumed_at, expires_at")
      .eq("id", otp_id)
      .maybeSingle();

    if (otpErr || !otp) {
      return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (otp.consumed_at) {
      return new Response(JSON.stringify({ error: "Código já utilizado. Solicite um novo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Código expirado. Solicite um novo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((otp.attempts || 0) >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({ error: "Limite de tentativas excedido. Solicite um novo código." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedHash = await hashOtpCode(String(code).trim(), OTP_SALT);
    if (expectedHash !== otp.code_hash) {
      await supabase.from("cliente_otp_codes").update({ attempts: (otp.attempts || 0) + 1 }).eq("id", otp.id);
      await logAcesso(supabase, {
        evento: "otp_falha",
        email: otp.email,
        qa_cliente_id: otp.qa_cliente_id,
        customer_id: otp.customer_id,
        status: "invalid",
        ip,
        user_agent: ua,
      });
      return new Response(JSON.stringify({ error: "Código incorreto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = normalizeEmail(otp.email);

    // Marca OTP como consumido
    await supabase.from("cliente_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

    // Verifica vínculo
    const { data: linkRows } = await supabase
      .from("cliente_auth_links")
      .select("id, status, user_id, email_pendente")
      .or([
        otp.qa_cliente_id ? `qa_cliente_id.eq.${otp.qa_cliente_id}` : "",
        otp.customer_id ? `customer_id.eq.${otp.customer_id}` : "",
      ].filter(Boolean).join(","))
      .order("created_at", { ascending: false })
      .limit(1);

    const link = linkRows && linkRows.length ? linkRows[0] : null;

    // Se link awaiting_admin → bloqueia liberação automática
    if (link?.status === "awaiting_admin") {
      await logAcesso(supabase, {
        evento: "otp_validado_awaiting_admin",
        email,
        qa_cliente_id: otp.qa_cliente_id,
        customer_id: otp.customer_id,
        status: "awaiting_admin",
        ip, user_agent: ua,
      });
      return new Response(JSON.stringify({
        success: true,
        awaiting_admin: true,
        message: "E-mail validado. Sua solicitação foi enviada para aprovação. Você receberá uma confirmação assim que liberada.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (link?.status === "blocked") {
      return new Response(JSON.stringify({ error: "Acesso bloqueado. Entre em contato com o suporte." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Localiza ou cria auth user
    let authUser: any = null;

    // tenta por user_id existente
    const tryUserIds = [link?.user_id].filter(Boolean) as string[];
    for (const uid of tryUserIds) {
      const { data } = await supabase.auth.admin.getUserById(uid);
      if (data?.user) { authUser = data.user; break; }
    }

    // tenta por email
    if (!authUser) {
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        const found = data?.users?.find((u: any) => normalizeEmail(u.email) === email);
        if (found) { authUser = found; break; }
        if ((data?.users?.length || 0) < 200) break;
      }
    }

    const newPassword = generatePassword();
    let isNew = false;

    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          auto_created: true,
          created_via: "portal_self_activation",
          temp_password: newPassword,
          password_change_required: true,
        },
      });
      if (error || !data.user) {
        return new Response(JSON.stringify({ error: error?.message || "Erro ao criar acesso" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authUser = data.user;
      isNew = true;
    } else {
      // redefine senha temporária
      const existingMeta = authUser.user_metadata && typeof authUser.user_metadata === "object" ? authUser.user_metadata : {};
      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          ...existingMeta,
          temp_password: newPassword,
          password_change_required: true,
          last_self_activation: new Date().toISOString(),
        },
      });
      if (!error && data?.user) authUser = data.user;
    }

    // Sincroniza tabelas
    if (otp.qa_cliente_id) {
      await supabase.from("qa_clientes").update({
        user_id: authUser.id,
        customer_id: otp.customer_id || null,
        email: email,
      }).eq("id", otp.qa_cliente_id);
    }
    if (otp.customer_id) {
      await supabase.from("customers").update({ user_id: authUser.id, email }).eq("id", otp.customer_id);
    }

    // Atualiza vínculo
    if (link) {
      await supabase.from("cliente_auth_links").update({
        user_id: authUser.id,
        email,
        email_pendente: null,
        status: "active",
        activated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      }).eq("id", link.id);
    } else {
      await supabase.from("cliente_auth_links").insert({
        qa_cliente_id: otp.qa_cliente_id,
        customer_id: otp.customer_id,
        user_id: authUser.id,
        email,
        status: "active",
        activated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      });
    }

    await logAcesso(supabase, {
      evento: isNew ? "acesso_criado" : "acesso_ativado",
      email,
      qa_cliente_id: otp.qa_cliente_id,
      customer_id: otp.customer_id,
      user_id: authUser.id,
      status: "active",
      ip, user_agent: ua,
    });

    return new Response(JSON.stringify({
      success: true,
      email,
      temp_password: newPassword,
      user_id: authUser.id,
      message: "Acesso liberado! Use o e-mail e a senha temporária para entrar no portal.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[cliente-portal-verify-otp] fatal", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});