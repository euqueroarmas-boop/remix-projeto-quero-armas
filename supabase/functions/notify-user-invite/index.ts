import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { buildUserInviteHtml, buildUserInviteText } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Envia credenciais de acesso ao portal para um novo usuário.
 * Disparado por create-client-user após criação bem-sucedida.
 * Envia via send-smtp-email (gateway central).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { customer_email, customer_name, temp_password, portal_url, trace_id } = body;
    const traceId = trace_id || `user-invite-${crypto.randomUUID()}`;

    if (!customer_email || !customer_name || !temp_password) {
      return new Response(JSON.stringify({ error: "Missing required fields", traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalPortalUrl = portal_url || "https://wmti.com.br/area-do-cliente";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const subject = `🔑 Seu acesso ao Portal WMTi foi criado`;

    const smtpRes = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: customer_email,
        subject,
        html: buildUserInviteHtml({ customerName: customer_name, email: customer_email, tempPassword: temp_password, portalUrl: finalPortalUrl }),
        text: buildUserInviteText({ customerName: customer_name, email: customer_email, tempPassword: temp_password, portalUrl: finalPortalUrl }),
        trace_id: traceId,
      },
    });

    const ok = !smtpRes.error && smtpRes.data?.success;
    console.info(`[notify-user-invite][${traceId}]`, ok ? "sent" : "failed");

    if (!ok) {
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha envio convite usuário: ${customer_email}`, payload: { trace_id: traceId } });
    } else {
      await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Convite de acesso enviado: ${customer_email}`, payload: { trace_id: traceId, subject } });
    }

    return new Response(JSON.stringify({ success: ok, traceId }), {
      status: ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[notify-user-invite] error", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
