import { logSistemaBackend } from "../_shared/logSistema.ts";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Notifica o cliente que a senha foi alterada com sucesso.
 * Template Lovable Emails: senha-alterada
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdminOrInternal(req);
  if (!guard.ok) return guard.response;

  try {
    const { email, nome, trace_id } = await req.json();
    const traceId = trace_id || `pwd-changed-${crypto.randomUUID()}`;

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email", traceId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendTransactional({
      templateName: "senha-alterada",
      recipientEmail: email,
      idempotencyKey: traceId,
      templateData: {
        nome: nome || email.split("@")[0],
        resetUrl: "https://euqueroarmas.com.br/auth/recuperar-senha",
      },
    });

    if (result.ok) {
      await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Confirmação de alteração de senha enviada: ${email}`, payload: { trace_id: traceId } });
    } else {
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha envio confirmação senha: ${email}`, payload: { trace_id: traceId, error: result.error } });
    }

    return new Response(JSON.stringify({ success: result.ok, traceId }), {
      status: result.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
