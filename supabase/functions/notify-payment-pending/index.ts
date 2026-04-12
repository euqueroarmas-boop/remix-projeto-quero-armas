import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { buildPaymentPendingHtml, buildPaymentPendingText } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Notifica o cliente que um novo boleto/cobrança foi gerado.
 * Disparado pelo asaas-webhook no evento PAYMENT_CREATED.
 * Envia via send-smtp-email (gateway central).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { customer_email, customer_name, value, due_date, billing_type, invoice_url, trace_id } = body;
    const traceId = trace_id || `pmt-pending-${crypto.randomUUID()}`;

    if (!customer_email || !customer_name || !value) {
      return new Response(JSON.stringify({ error: "Missing required fields", traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const billingLabel = billing_type === "CREDIT_CARD" ? "Cartão de Crédito"
      : billing_type === "BOLETO" ? "Boleto Bancário"
      : billing_type === "PIX" ? "PIX"
      : billing_type || "N/A";

    const valueFormatted = `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const dueDateFormatted = due_date
      ? new Date(due_date + "T12:00:00").toLocaleDateString("pt-BR")
      : "N/A";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const subject = `💳 Nova cobrança gerada — WMTi`;

    const smtpRes = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: customer_email,
        subject,
        html: buildPaymentPendingHtml({ customerName: customer_name, value: valueFormatted, dueDate: dueDateFormatted, billingType: billingLabel, invoiceUrl: invoice_url }),
        text: buildPaymentPendingText({ customerName: customer_name, value: valueFormatted, dueDate: dueDateFormatted, billingType: billingLabel, invoiceUrl: invoice_url }),
        trace_id: traceId,
      },
    });

    const ok = !smtpRes.error && smtpRes.data?.success;
    console.info(`[notify-payment-pending][${traceId}]`, ok ? "sent" : "failed", JSON.stringify(smtpRes.data || smtpRes.error));

    if (!ok) {
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha envio pagamento pendente: ${customer_email}`, payload: { trace_id: traceId, error: smtpRes.error || smtpRes.data } });
    } else {
      await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Aviso de pagamento pendente enviado: ${customer_email}`, payload: { trace_id: traceId, subject } });
    }

    return new Response(JSON.stringify({ success: ok, traceId }), {
      status: ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[notify-payment-pending] error", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
