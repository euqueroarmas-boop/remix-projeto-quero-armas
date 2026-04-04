import { logSistemaBackend } from "../_shared/logSistema.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureClientAccess } from "../_shared/post-purchase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify Asaas webhook token — MANDATORY in production
  const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (!ASAAS_WEBHOOK_TOKEN) {
    console.error("[asaas-webhook] ASAAS_WEBHOOK_TOKEN não configurado — rejeitando requisição");
    return new Response(JSON.stringify({ error: "Webhook token not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const incomingToken = req.headers.get("asaas-access-token");
  if (!incomingToken || incomingToken !== ASAAS_WEBHOOK_TOKEN) {
    console.error("[asaas-webhook] Token de webhook inválido ou ausente. Recebido:", incomingToken ? "***" : "null");
    await logSistemaBackend({ tipo: "webhook", status: "error", mensagem: "Webhook rejeitado — token inválido" });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { event, payment } = body;

    console.log("[asaas-webhook] Evento recebido:", event, "Payment ID:", payment?.id);
    await logSistemaBackend({ tipo: "webhook", status: "info", mensagem: `Webhook recebido: ${event}`, payload: { event, paymentId: payment?.id } });

    // ── IDEMPOTENCY CHECK ──
    // Use event + payment.id as idempotency key
    const idempotencyKey = `${event}:${payment?.id || body.id || "unknown"}`;
    const { data: existingWebhook } = await supabase
      .from("asaas_webhooks")
      .select("id, processed")
      .eq("event", event)
      .eq("payload->>id", body.id || "")
      .limit(1);

    if (existingWebhook?.[0]?.processed) {
      console.log("[asaas-webhook] Evento já processado (idempotência):", idempotencyKey);
      return new Response(JSON.stringify({ received: true, idempotent: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Find payment record — try by payment ID first, then by subscription ID.
    let paymentRecord: { id: string; quote_id: string | null } | null = null;

    const { data: byPaymentIdRows } = await supabase
      .from("payments")
      .select("id, quote_id, created_at")
      .eq("asaas_payment_id", payment.id)
      .order("created_at", { ascending: false })
      .limit(1);

    paymentRecord = byPaymentIdRows?.[0]
      ? { id: byPaymentIdRows[0].id, quote_id: byPaymentIdRows[0].quote_id }
      : null;

    // Fallback: subscription payments may be stored under subscription ID
    if (!paymentRecord && payment.subscription) {
      const { data: bySubIdRows } = await supabase
        .from("payments")
        .select("id, quote_id, created_at")
        .eq("asaas_payment_id", payment.subscription)
        .order("created_at", { ascending: false })
        .limit(1);

      paymentRecord = bySubIdRows?.[0]
        ? { id: bySubIdRows[0].id, quote_id: bySubIdRows[0].quote_id }
        : null;

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

    // ── PAYMENT_CREATED: Backup provisioning (in case create-asaas-payment didn't do it) ──
    if (event === "PAYMENT_CREATED" && paymentRecord.quote_id) {
      console.log("[asaas-webhook] PAYMENT_CREATED — verificando provisionamento de acesso...");
      try {
        const accessResult = await ensureClientAccess(supabase, paymentRecord.quote_id, "payment_webhook", { skipPaymentCheck: true });
        if (accessResult.success) {
          console.log("[asaas-webhook] Acesso provisionado via PAYMENT_CREATED:", accessResult.email);
          await logSistemaBackend({
            tipo: "webhook",
            status: "success",
            mensagem: "Acesso do cliente provisionado via PAYMENT_CREATED (backup)",
            payload: {
              quote_id: paymentRecord.quote_id,
              user_created: accessResult.user_created,
              user_recovered: accessResult.user_recovered,
              email: accessResult.email,
            },
          });

          if (accessResult.user_created || accessResult.user_recovered) {
            const { data: contractRows } = await supabase
              .from("contracts")
              .select("customer_id")
              .eq("quote_id", paymentRecord.quote_id)
              .limit(1);
            if (contractRows?.[0]?.customer_id) {
              await supabase.from("admin_audit_logs").insert({
                action: accessResult.user_created ? "auto_user_created" : "auto_user_recovered",
                target_type: "customer",
                target_id: contractRows[0].customer_id,
                after_state: { ...accessResult, source: "webhook_payment_created" },
              });
            }
          }
        }
      } catch (e) {
        console.error("[asaas-webhook] Erro ao provisionar via PAYMENT_CREATED:", e);
        await logSistemaBackend({
          tipo: "webhook",
          status: "warning",
          mensagem: `Provisionamento backup falhou (PAYMENT_CREATED): ${e instanceof Error ? e.message : String(e)}`,
          payload: { quote_id: paymentRecord.quote_id },
        });
      }
    }

    // ── Payment confirmed: activate contract + create client account ──
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      console.log("[asaas-webhook] Pagamento confirmado! Ativando contrato e criando acesso...");

      if (paymentRecord.quote_id) {
        // Activate contract + set service_status
        await supabase
          .from("contracts")
          .update({ status: "ATIVO", service_status: "active", activated_at: new Date().toISOString() })
          .eq("quote_id", paymentRecord.quote_id);

        await supabase
          .from("quotes")
          .update({ status: "active" })
          .eq("id", paymentRecord.quote_id);

        // Fetch customer data
        const { data: contractRows } = await supabase
          .from("contracts")
          .select("customer_id, contract_type, monthly_value, id")
          .eq("quote_id", paymentRecord.quote_id)
          .order("created_at", { ascending: false })
          .limit(1);
        const contractData = contractRows?.[0] ?? null;

        let customerInfo: Record<string, unknown> = {};
        if (contractData?.customer_id) {
          const { data: customer } = await supabase
            .from("customers")
            .select("*")
            .eq("id", contractData.customer_id)
            .single();
          if (customer) customerInfo = customer;

          // ── LGPD GUARD: Skip provisioning for deleted clients ──
          if (customer?.status_cliente === "excluido_lgpd") {
            console.log("[asaas-webhook] Cliente excluído LGPD — pulando provisionamento de acesso");
            await logSistemaBackend({
              tipo: "webhook",
              status: "warning",
              mensagem: "Webhook recebido para cliente excluído LGPD — provisionamento bloqueado",
              payload: { customer_id: contractData.customer_id, event },
            });
          } else {

          try {
            const accessResult = await ensureClientAccess(supabase, paymentRecord.quote_id, "payment_webhook");
            if (accessResult.success) {
              await supabase.from("admin_audit_logs").insert({
                action: accessResult.user_created ? "auto_user_created" : accessResult.user_recovered ? "auto_user_recovered" : "auto_user_verified",
                target_type: "customer",
                target_id: contractData.customer_id,
                after_state: { ...accessResult, source: "webhook_payment_confirmed" },
              });

              await logSistemaBackend({
                tipo: "webhook",
                status: "success",
                mensagem: "Acesso completo liberado após confirmação de pagamento",
                payload: {
                  quote_id: paymentRecord.quote_id,
                  customer_id: contractData.customer_id,
                  user_id: accessResult.user_id,
                  user_created: accessResult.user_created,
                  email: accessResult.email,
                },
              });

              const pdfFunctionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-paid-contract-pdf`;
              await fetch(pdfFunctionUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
                },
                body: JSON.stringify({
                  quote_id: paymentRecord.quote_id,
                  generate_if_missing: true,
                  send_email: true,
                  access_source: "payment_webhook",
                }),
              });
            } else {
              await logSistemaBackend({
                tipo: "admin",
                status: "warning",
                mensagem: "Pagamento confirmado, mas acesso ainda não pôde ser liberado automaticamente",
                payload: { quote_id: paymentRecord.quote_id, result: accessResult },
              });
            }
          } catch (e) {
            console.error("[asaas-webhook] Exceção ao garantir conta:", e);
            await logSistemaBackend({
              tipo: "erro",
              status: "error",
              mensagem: "Exceção ao garantir conta automática",
              payload: { email: (customerInfo as any)?.email, error: String(e) },
            });
          }
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

        // Log payment notification
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

        // Audit log for payment confirmation
        await supabase.from("admin_audit_logs").insert({
          action: "payment_confirmed",
          target_type: "payment",
          target_id: paymentRecord.id,
          after_state: {
            event,
            quote_id: paymentRecord.quote_id,
            asaas_payment_id: payment.id,
            value: payment.value,
            customer: (customerInfo as any)?.razao_social || "N/A",
          },
        });

        console.log("[asaas-webhook] Contrato ativado, conta criada e NF registrada para quote:", paymentRecord.quote_id);
      }
    }

    // ── Payment overdue: mark contract as INADIMPLENTE ──
    if (event === "PAYMENT_OVERDUE" && paymentRecord.quote_id) {
      console.log("[asaas-webhook] Pagamento vencido. Marcando contrato como INADIMPLENTE.");
      await supabase
        .from("contracts")
        .update({ status: "INADIMPLENTE", service_status: "overdue" })
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
    await logSistemaBackend({ tipo: "webhook", status: "error", mensagem: `Webhook erro fatal: ${message}` });

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
