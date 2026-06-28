// qa-enviar-email-template
// Endpoint administrativo genérico para disparar qualquer template
// transacional Lovable Emails (registry em
// _shared/transactional-email-templates/registry.ts). Permite que a UI
// de admin acione templates sem trigger automático nativo (contrato-recusado,
// orcamento-resposta, ticket-suporte, falha-cartao manual, etc).
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

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

  const templateName = String(body?.templateName || "").trim();
  const recipientEmail = String(body?.recipientEmail || "").trim().toLowerCase();
  const templateData = body?.templateData && typeof body.templateData === "object"
    ? body.templateData
    : {};
  const idempotencyKey = String(
    body?.idempotencyKey || `${templateName}-${recipientEmail}-${Date.now()}`,
  );

  if (!templateName) return json({ error: "templateName_obrigatorio" }, 400);
  if (!/^\S+@\S+\.\S+$/.test(recipientEmail)) return json({ error: "email_invalido" }, 400);

  const result = await sendTransactional({
    templateName,
    recipientEmail,
    idempotencyKey,
    templateData,
  });

  return json({ ok: result.ok, queued: result.queued, error: result.error });
});