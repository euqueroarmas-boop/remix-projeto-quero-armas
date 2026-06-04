import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { buildPasswordChangedHtml, buildPasswordChangedText } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Notifica o cliente que a senha foi alterada com sucesso.
 * Disparado pela RedefinirSenhaPage após updateUser bem-sucedido.
 * Envia via send-smtp-email (gateway central).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, trace_id } = body;
    const traceId = trace_id || `pwd-changed-${crypto.randomUUID()}`;

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email", traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const subject = `🔒 Senha alterada — Portal WMTi`;

    const smtpRes = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: email,
        subject,
        html: buildPasswordChangedHtml({ email }),
        text: buildPasswordChangedText({ email }),
        trace_id: traceId,
      },
    });

    const ok = !smtpRes.error && smtpRes.data?.success;
    console.info(`[notify-password-changed][${traceId}]`, ok ? "sent" : "failed");

    if (!ok) {
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha envio confirmação senha: ${email}`, payload: { trace_id: traceId } });
    } else {
      await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Confirmação de alteração de senha enviada: ${email}`, payload: { trace_id: traceId, subject } });
    }

    return new Response(JSON.stringify({ success: ok, traceId }), {
      status: ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[notify-password-changed] error", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
