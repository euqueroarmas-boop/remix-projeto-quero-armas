import { logSistemaBackend } from "../_shared/logSistema.ts";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

/**
 * Notifica o cliente que um novo boleto/cobrança foi gerado.
 * Template Lovable Emails: cobranca-gerada
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdminOrInternal(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const { customer_email, customer_name, value, due_date, billing_type, invoice_url, descricao, trace_id, payment_id } = body;
    const traceId = trace_id || `pmt-pending-${payment_id || crypto.randomUUID()}`;

    if (!customer_email || !customer_name || !value) {
      return new Response(JSON.stringify({ error: "Missing required fields", traceId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const billingLabel = billing_type === "CREDIT_CARD" ? "Cartão de Crédito"
      : billing_type === "BOLETO" ? "Boleto Bancário"
      : billing_type === "PIX" ? "PIX" : (billing_type || "Cobrança");

    const result = await sendTransactional({
      templateName: "cobranca-gerada",
      recipientEmail: customer_email,
      idempotencyKey: traceId,
      templateData: {
        nome: customer_name,
        valor: Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        vencimento: due_date ? new Date(due_date + "T12:00:00").toLocaleDateString("pt-BR") : "—",
        descricao: descricao || billingLabel,
        linkPagamento: invoice_url || "https://euqueroarmas.com.br/area-do-cliente/financeiro",
      },
    });

    if (result.ok) {
      await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Aviso de cobrança enviado: ${customer_email}`, payload: { trace_id: traceId } });
    } else {
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha envio cobrança: ${customer_email}`, payload: { trace_id: traceId, error: result.error } });
    }

    return new Response(JSON.stringify({ success: result.ok, traceId }), {
      status: result.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
