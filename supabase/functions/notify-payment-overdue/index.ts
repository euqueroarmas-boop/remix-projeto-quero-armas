import { logSistemaBackend } from "../_shared/logSistema.ts";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

/**
 * Notifica o cliente que a cobrança está vencida.
 * Template Lovable Emails: pagamento-atrasado
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdminOrInternal(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const { customer_email, customer_name, value, due_date, invoice_url, trace_id, payment_id } = body;
    const traceId = trace_id || `pmt-overdue-${payment_id || crypto.randomUUID()}`;

    if (!customer_email || !customer_name || !value) {
      return new Response(JSON.stringify({ error: "Missing required fields", traceId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const venceuEm = due_date ? new Date(due_date + "T12:00:00") : null;
    const diasAtraso = venceuEm
      ? Math.max(0, Math.floor((Date.now() - venceuEm.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const result = await sendTransactional({
      templateName: "pagamento-atrasado",
      recipientEmail: customer_email,
      idempotencyKey: traceId,
      templateData: {
        nome: customer_name,
        valor: Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        venceuEm: venceuEm ? venceuEm.toLocaleDateString("pt-BR") : "—",
        diasAtraso: String(diasAtraso),
        linkPagamento: invoice_url || "https://euqueroarmas.com.br/area-do-cliente/financeiro",
      },
    });

    if (result.ok) {
      await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Aviso de pagamento vencido enviado: ${customer_email}`, payload: { trace_id: traceId } });
    } else {
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha envio pagamento vencido: ${customer_email}`, payload: { trace_id: traceId, error: result.error } });
    }

    return new Response(JSON.stringify({ success: result.ok, traceId }), {
      status: result.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
