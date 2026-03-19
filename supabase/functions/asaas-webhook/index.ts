import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { event, payment } = body;

    console.log("[asaas-webhook] Evento recebido:", event, "Payment ID:", payment?.id);
    await logSistemaBackend({ tipo: "webhook", status: "info", mensagem: `Webhook recebido: ${event}`, payload: { event, paymentId: payment?.id } });

    // Log webhook event
    await supabase.from("asaas_webhooks").insert({
      event: event,
      payload: body,
      processed: false,
    });

    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "webhook_received",
      request_payload: body,
      status: "received",
    });

    // ── Handle subscription events ──
    if (event === "SUBSCRIPTION_CREATED" || event === "SUBSCRIPTION_UPDATED") {
      console.log("[asaas-webhook] Evento de assinatura:", event);
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: `subscription_${event.toLowerCase()}`,
        request_payload: body,
        status: "success",
      });
      return new Response(JSON.stringify({ received: true, event }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment?.id) {
      console.log("[asaas-webhook] Sem payment.id, ignorando.");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find payment record — try by payment ID first, then by subscription ID
    let paymentRecord: { id: string; quote_id: string | null } | null = null;

    const { data: byPaymentId } = await supabase
      .from("payments")
      .select("id, quote_id")
      .eq("asaas_payment_id", payment.id)
      .maybeSingle();

    paymentRecord = byPaymentId;

    // Fallback: subscription payments may be stored under subscription ID
    if (!paymentRecord && payment.subscription) {
      const { data: bySubId } = await supabase
        .from("payments")
        .select("id, quote_id")
        .eq("asaas_payment_id", payment.subscription)
        .maybeSingle();
      paymentRecord = bySubId;

      // Update the record with the actual payment ID for future lookups
      if (paymentRecord) {
        await supabase
          .from("payments")
          .update({ asaas_payment_id: payment.id })
          .eq("id", paymentRecord.id);
      }
    }

    if (!paymentRecord) {
      console.log("[asaas-webhook] Pagamento não encontrado para asaas_payment_id:", payment.id);
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "webhook_payment_not_found",
        request_payload: { asaas_payment_id: payment.id, subscription: payment.subscription, event },
        status: "warning",
        error_message: "Payment record not found in database",
      });
      return new Response(JSON.stringify({ received: true, note: "payment not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Asaas events to status
    let newStatus: string;
    switch (event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        newStatus = "CONFIRMED";
        break;
      case "PAYMENT_CREATED":
        newStatus = "PENDING";
        break;
      case "PAYMENT_UPDATED":
        newStatus = payment.status || "PENDING";
        break;
      case "PAYMENT_OVERDUE":
        newStatus = "OVERDUE";
        break;
      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED":
      case "PAYMENT_REFUND_IN_PROGRESS":
        newStatus = "CANCELLED";
        break;
      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "PAYMENT_CHARGEBACK_DISPUTE":
        newStatus = "CHARGEBACK";
        break;
      case "PAYMENT_AWAITING_RISK_ANALYSIS":
        newStatus = "AWAITING_RISK_ANALYSIS";
        break;
      default:
        newStatus = payment.status || event;
    }

    console.log("[asaas-webhook] Atualizando pagamento", paymentRecord.id, "→ status:", newStatus);

    // Update payment status
    await supabase
      .from("payments")
      .update({ payment_status: newStatus })
      .eq("id", paymentRecord.id);

    // ── Payment confirmed: activate contract + log invoice ──
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      console.log("[asaas-webhook] Pagamento confirmado! Ativando contrato e registrando NF...");

      if (paymentRecord.quote_id) {
        // Activate contract
        await supabase
          .from("contracts")
          .update({ status: "ATIVO" })
          .eq("quote_id", paymentRecord.quote_id);

        await supabase
          .from("quotes")
          .update({ status: "active" })
          .eq("id", paymentRecord.quote_id);

        // Fetch customer data for notification
        const { data: contractData } = await supabase
          .from("contracts")
          .select("customer_id, contract_type, monthly_value")
          .eq("quote_id", paymentRecord.quote_id)
          .single();

        let customerInfo: Record<string, unknown> = {};
        if (contractData?.customer_id) {
          const { data: customer } = await supabase
            .from("customers")
            .select("*")
            .eq("id", contractData.customer_id)
            .single();
          if (customer) customerInfo = customer;
        }

        // Log invoice generation
        await supabase.from("integration_logs").insert({
          integration_name: "asaas",
          operation_name: "invoice_generated",
          request_payload: {
            event,
            payment_id: payment.id,
            quote_id: paymentRecord.quote_id,
            value: payment.value,
            billing_period: payment.dueDate,
          },
          response_payload: {
            invoice_number: `NF-${Date.now()}`,
            generated_at: new Date().toISOString(),
          },
          status: "success",
        });

        // Log contract activation
        await supabase.from("integration_logs").insert({
          integration_name: "asaas",
          operation_name: "contract_activated",
          request_payload: {
            event,
            payment_id: payment.id,
            quote_id: paymentRecord.quote_id,
          },
          status: "success",
        });

        // Log payment notification with full details for admin
        await supabase.from("integration_logs").insert({
          integration_name: "wmti_notification",
          operation_name: "payment_confirmed_notification",
          request_payload: {
            customer: customerInfo,
            contract_type: contractData?.contract_type,
            monthly_value: contractData?.monthly_value || payment.value,
            payment_id: payment.id,
            quote_id: paymentRecord.quote_id,
            billing_type: payment.billingType,
            payment_date: new Date().toISOString(),
          },
          response_payload: {
            whatsapp_number: "5511963166915",
            notification_status: "logged",
            message: `Nova compra confirmada: ${(customerInfo as any)?.razao_social || "Cliente"} - R$ ${contractData?.monthly_value || payment.value} - ${contractData?.contract_type || "serviço"}`,
          },
          status: "success",
        });

        console.log("[asaas-webhook] Contrato ativado, NF registrada e notificação gerada para quote:", paymentRecord.quote_id);
      }
    }

    // ── Payment overdue: mark contract as INADIMPLENTE ──
    if (event === "PAYMENT_OVERDUE" && paymentRecord.quote_id) {
      console.log("[asaas-webhook] Pagamento vencido. Marcando contrato como INADIMPLENTE.");
      await supabase
        .from("contracts")
        .update({ status: "INADIMPLENTE" })
        .eq("quote_id", paymentRecord.quote_id);

      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "contract_overdue",
        request_payload: { event, payment_id: payment.id, quote_id: paymentRecord.quote_id },
        status: "warning",
      });
    }

    // Mark webhook as processed
    await supabase
      .from("asaas_webhooks")
      .update({ processed: true })
      .eq("payload->>id", body.id);

    // Log success
    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "webhook_processed",
      request_payload: { event, payment_id: payment.id },
      response_payload: { new_status: newStatus, payment_record_id: paymentRecord.id },
      status: "success",
    });

    return new Response(JSON.stringify({ received: true, status: newStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[asaas-webhook] Erro fatal:", message);

    try {
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "webhook_error",
        status: "error",
        error_message: message,
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
