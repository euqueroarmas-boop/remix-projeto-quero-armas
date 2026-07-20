// send-smtp-email — SHIM para o motor Lovable Emails.
//
// A implementação original abria conexão SMTP direta. Foi desativada:
// agora encaminha para `send-transactional-email` usando o template
// genérico `arsenal-generic`, aproveitando fila pgmq, retries, logs
// em email_send_log e suppression list do motor Lovable.
//
// Contrato mantido para compatibilidade com todos os callers legados:
//   body: { to, subject, html, text?, from_name?, trace_id? }
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  const to = String(body?.to || "").trim().toLowerCase();
  const subject = String(body?.subject || "Arsenal Inteligente");
  const html = String(body?.html || "");
  const traceId = String(body?.trace_id || `smtp-shim-${crypto.randomUUID()}`);

  if (!/^\S+@\S+\.\S+$/.test(to)) return json({ error: "email_invalido", traceId }, 400);

  const result = await sendTransactional({
    templateName: "arsenal-generic",
    recipientEmail: to,
    idempotencyKey: traceId,
    templateData: { subject, html },
  });

  await logSistemaBackend({
    tipo: "email",
    status: result.ok ? "success" : "error",
    mensagem: `[smtp-shim → lovable] ${to} :: ${subject}`,
    payload: { trace_id: traceId, queued: result.queued, error: result.error },
  });

  return json({
    success: result.ok,
    queued: result.queued,
    traceId,
    messageId: traceId,
    engine: "lovable-emails",
    error: result.error,
  }, result.ok ? 200 : 500);
});
