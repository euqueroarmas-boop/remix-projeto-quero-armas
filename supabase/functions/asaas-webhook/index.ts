import { logSistemaBackend } from "../_shared/logSistema.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureClientAccess } from "../_shared/post-purchase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── HELPER: resolve customer_id from Asaas customer ID via mapping table ──
async function resolveCustomerByAsaasId(
  supabase: ReturnType<typeof createClient>,
  asaasCustomerId: string
): Promise<string | null> {
  if (!asaasCustomerId) return null;
  const { data } = await supabase
    .from("asaas_customer_map")
    .select("customer_id")
    .eq("asaas_customer_id", asaasCustomerId)
    .limit(1)
    .maybeSingle();
  return data?.customer_id || null;
}

// ── HELPER: resolve customer via payment chain (fallback) ──
async function resolveCustomerByPayment(
  supabase: ReturnType<typeof createClient>,
  asaasPaymentId: string
): Promise<{ customerId: string | null; contractId: string | null; paymentId: string | null }> {
  const result = { customerId: null as string | null, contractId: null as string | null, paymentId: null as string | null };
  if (!asaasPaymentId) return result;

  const { data: payRec } = await supabase
    .from("payments")
    .select("id, quote_id")
    .eq("asaas_payment_id", asaasPaymentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payRec) return result;
  result.paymentId = payRec.id;

  if (payRec.quote_id) {
    const { data: contractRec } = await supabase
      .from("contracts")
      .select("customer_id, id")
      .eq("quote_id", payRec.quote_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contractRec) {
      result.customerId = contractRec.customer_id;
      result.contractId = contractRec.id;
    }
  }
  return result;
}

// ── HELPER: ensure asaas_customer_map entry exists ──
async function ensureCustomerMapping(
  supabase: ReturnType<typeof createClient>,
  asaasCustomerId: string,
  internalCustomerId: string
) {
  if (!asaasCustomerId || !internalCustomerId) return;
  const { data: existing } = await supabase
    .from("asaas_customer_map")
    .select("id")
    .eq("asaas_customer_id", asaasCustomerId)
    .limit(1)
    .maybeSingle();
  if (!existing) {
    await supabase.from("asaas_customer_map").insert({
      asaas_customer_id: asaasCustomerId,
      customer_id: internalCustomerId,
    });
    console.log("[asaas-webhook] Mapeamento criado:", asaasCustomerId, "→", internalCustomerId);
  }
}

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

    // ══════════════════════════════════════════════════════════════
    // ── Handle INVOICE (Nota Fiscal) events — PRIMARY source ──
    // ══════════════════════════════════════════════════════════════
    const INVOICE_EVENTS = [
      "INVOICE_CREATED", "INVOICE_UPDATED", "INVOICE_SYNCHRONIZED",
      "INVOICE_AUTHORIZED", "INVOICE_PROCESSING_CANCELLATION",
      "INVOICE_CANCELED", "INVOICE_CANCELLATION_DENIED", "INVOICE_ERROR",
    ];

    if (INVOICE_EVENTS.includes(event)) {
      const invoice = body.invoice || body;
      const invoiceId = invoice?.id;
      console.log("[asaas-webhook] Evento fiscal recebido:", event, "Invoice ID:", invoiceId);

      if (invoiceId) {
        const STATUS_MAP: Record<string, string> = {
          INVOICE_CREATED: "criada",
          INVOICE_UPDATED: "atualizada",
          INVOICE_SYNCHRONIZED: "sincronizada",
          INVOICE_AUTHORIZED: "emitido",
          INVOICE_PROCESSING_CANCELLATION: "cancelamento_processando",
          INVOICE_CANCELED: "cancelada",
          INVOICE_CANCELLATION_DENIED: "cancelamento_negado",
          INVOICE_ERROR: "erro",
        };
        const newStatus = STATUS_MAP[event] || "criada";

        const invoiceNumber = invoice.invoiceNumber ? String(invoice.invoiceNumber) : invoice.number ? String(invoice.number) : null;
        const accessKey = invoice.accessKey || null;
        const pdfUrl = invoice.pdfUrl || invoice.invoiceUrl || null;
        const xmlUrl = invoice.xmlUrl || null;
        const invoiceSeries = invoice.series ? String(invoice.series) : null;
        const issueDate = invoice.issuedDate || invoice.effectiveDate || new Date().toISOString().split("T")[0];
        const amount = invoice.value || invoice.grossValue || 0;

        // ── RESOLVE CUSTOMER (mapping table first, then payment chain) ──
        let custId: string | null = null;
        let contractId: string | null = null;
        let paymentId: string | null = null;
        const asaasPaymentId = invoice.payment || invoice.paymentId || null;
        const asaasCustomerId = invoice.customer || null;

        // Strategy A: mapping table
        if (asaasCustomerId) {
          custId = await resolveCustomerByAsaasId(supabase, asaasCustomerId);
          if (custId) {
            console.log("[asaas-webhook] Cliente resolvido via mapeamento:", asaasCustomerId, "→", custId);
          }
        }

        // Strategy B: payment chain fallback
        if (!custId && asaasPaymentId) {
          const resolved = await resolveCustomerByPayment(supabase, asaasPaymentId);
          custId = resolved.customerId;
          contractId = resolved.contractId;
          paymentId = resolved.paymentId;
          if (custId) {
            console.log("[asaas-webhook] Cliente resolvido via payment chain:", asaasPaymentId, "→", custId);
            // Auto-populate mapping for future lookups
            if (asaasCustomerId) {
              await ensureCustomerMapping(supabase, asaasCustomerId, custId);
            }
          }
        }

        // If still no paymentId, resolve it separately
        if (!paymentId && asaasPaymentId) {
          const { data: payRec } = await supabase
            .from("payments").select("id").eq("asaas_payment_id", asaasPaymentId).limit(1).maybeSingle();
          if (payRec) paymentId = payRec.id;
        }

        if (!custId) {
          // ── REGRA ABSOLUTA: NÃO salvar NF sem customer_id validado ──
          console.error("[asaas-webhook] REJEITADO: Invoice event sem customer resolvido:", event, invoiceId);
          await logSistemaBackend({
            tipo: "webhook",
            status: "error",
            mensagem: `NF rejeitada: customer não resolvido para invoice ${invoiceId}`,
            payload: { event, invoice_id: invoiceId, asaas_customer: asaasCustomerId, asaas_payment: asaasPaymentId },
          });
          await supabase.from("integration_logs").insert({
            integration_name: "asaas",
            operation_name: "invoice_event_rejected_no_customer",
            request_payload: { event, invoice_id: invoiceId, asaas_customer: asaasCustomerId, asaas_payment: asaasPaymentId },
            status: "error",
            error_message: "Customer não resolvido — NF não persistida",
          });

          await supabase.from("asaas_webhooks").update({ processed: true }).eq("payload->>id", body.id || "");
          return new Response(JSON.stringify({ received: true, event, rejected: true, reason: "customer_not_resolved" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // ── UPSERT with INVOICE EVENT as PRIMARY source (can overwrite everything) ──
        const { data: existingDoc } = await supabase
          .from("fiscal_documents")
          .select("id")
          .eq("asaas_invoice_id", String(invoiceId))
          .limit(1)
          .maybeSingle();

        if (existingDoc) {
          await supabase.from("fiscal_documents")
            .update({
              status: newStatus,
              document_number: invoiceNumber || undefined,
              access_key: accessKey || undefined,
              file_url: pdfUrl || undefined,
              xml_url: xmlUrl || undefined,
              invoice_series: invoiceSeries || undefined,
              amount: amount || undefined,
              raw_payload: body,
              notes: `Atualizado via ${event} (fonte primária)`,
            })
            .eq("id", existingDoc.id);

          // Upsert invoice_files
          if (pdfUrl) {
            const { data: existPdf } = await supabase.from("invoice_files").select("id").eq("invoice_id", existingDoc.id).eq("type", "pdf").limit(1).maybeSingle();
            if (existPdf) {
              await supabase.from("invoice_files").update({ file_url: pdfUrl, filename: `NF-${invoiceNumber || invoiceId}.pdf` }).eq("id", existPdf.id);
            } else {
              await supabase.from("invoice_files").insert({ invoice_id: existingDoc.id, type: "pdf", file_url: pdfUrl, filename: `NF-${invoiceNumber || invoiceId}.pdf`, mime_type: "application/pdf" });
            }
          }
          if (xmlUrl) {
            const { data: existXml } = await supabase.from("invoice_files").select("id").eq("invoice_id", existingDoc.id).eq("type", "xml").limit(1).maybeSingle();
            if (existXml) {
              await supabase.from("invoice_files").update({ file_url: xmlUrl, filename: `NF-${invoiceNumber || invoiceId}.xml` }).eq("id", existXml.id);
            } else {
              await supabase.from("invoice_files").insert({ invoice_id: existingDoc.id, type: "xml", file_url: xmlUrl, filename: `NF-${invoiceNumber || invoiceId}.xml`, mime_type: "application/xml" });
            }
          }

          console.log("[asaas-webhook] Fiscal doc atualizado (INVOICE_EVENT, primário):", existingDoc.id, "→", newStatus);
        } else {
          const { data: insertedDoc } = await supabase.from("fiscal_documents").insert({
            customer_id: custId,
            payment_id: paymentId,
            contract_id: contractId,
            asaas_invoice_id: String(invoiceId),
            document_type: "nota_fiscal",
            document_number: invoiceNumber,
            issue_date: issueDate,
            amount,
            status: newStatus,
            file_url: pdfUrl,
            xml_url: xmlUrl,
            access_key: accessKey,
            invoice_series: invoiceSeries,
            service_reference: null,
            raw_payload: body,
            notes: `NF criada via ${event} (fonte primária)`,
          }).select("id").single();

          if (insertedDoc?.id) {
            const files: { invoice_id: string; type: string; file_url: string; filename: string; mime_type: string }[] = [];
            if (pdfUrl) files.push({ invoice_id: insertedDoc.id, type: "pdf", file_url: pdfUrl, filename: `NF-${invoiceNumber || invoiceId}.pdf`, mime_type: "application/pdf" });
            if (xmlUrl) files.push({ invoice_id: insertedDoc.id, type: "xml", file_url: xmlUrl, filename: `NF-${invoiceNumber || invoiceId}.xml`, mime_type: "application/xml" });
            if (files.length) await supabase.from("invoice_files").insert(files);
          }
          console.log("[asaas-webhook] Fiscal doc criado (INVOICE_EVENT, primário):", event);
        }

        await supabase.from("integration_logs").insert({
          integration_name: "asaas",
          operation_name: `invoice_event_${event.toLowerCase()}`,
          request_payload: { event, invoice_id: invoiceId, customer_id: custId, status: newStatus, source: "invoice_event_primary" },
          status: "success",
        });
      }

      await supabase.from("asaas_webhooks").update({ processed: true }).eq("payload->>id", body.id || "");
      return new Response(JSON.stringify({ received: true, event, type: "invoice_event" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ── PAYMENT EVENTS (secondary/fallback for fiscal) ──
    // ══════════════════════════════════════════════════════════════

    if (!payment?.id) {
      console.log("[asaas-webhook] Sem payment.id, ignorando.");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find payment record
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

    // Fallback: subscription payments
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

      if (paymentRecord) {
        await supabase.from("payments").update({ asaas_payment_id: payment.id }).eq("id", paymentRecord.id);
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
    await supabase.from("payments").update({ payment_status: newStatus }).eq("id", paymentRecord.id);

    // ── Auto-populate customer mapping when we have payment context ──
    if (payment.customer && paymentRecord.quote_id) {
      const { data: contractForMap } = await supabase
        .from("contracts")
        .select("customer_id")
        .eq("quote_id", paymentRecord.quote_id)
        .limit(1)
        .maybeSingle();
      if (contractForMap?.customer_id) {
        await ensureCustomerMapping(supabase, payment.customer, contractForMap.customer_id);
      }
    }

    // ── PAYMENT_CREATED: Backup provisioning ──
    if (event === "PAYMENT_CREATED" && paymentRecord.quote_id) {
      console.log("[asaas-webhook] PAYMENT_CREATED — verificando provisionamento de acesso...");
      const { data: contractCheck } = await supabase.from("contracts").select("customer_id").eq("quote_id", paymentRecord.quote_id).limit(1);
      let lgpdBlocked = false;
      if (contractCheck?.[0]?.customer_id) {
        const { data: custCheck } = await supabase.from("customers").select("status_cliente").eq("id", contractCheck[0].customer_id).single();
        if (custCheck?.status_cliente === "excluido_lgpd") {
          lgpdBlocked = true;
          console.log("[asaas-webhook] LGPD: cliente excluído, pulando provisionamento PAYMENT_CREATED");
        }
      }
      if (!lgpdBlocked) {
        try {
          const accessResult = await ensureClientAccess(supabase, paymentRecord.quote_id, "payment_webhook", { skipPaymentCheck: true });
          if (accessResult.success) {
            console.log("[asaas-webhook] Acesso provisionado via PAYMENT_CREATED:", accessResult.email);
            await logSistemaBackend({
              tipo: "webhook",
              status: "success",
              mensagem: "Acesso do cliente provisionado via PAYMENT_CREATED (backup)",
              payload: { quote_id: paymentRecord.quote_id, user_created: accessResult.user_created, user_recovered: accessResult.user_recovered, email: accessResult.email },
            });
            if (accessResult.user_created || accessResult.user_recovered) {
              const { data: contractRows } = await supabase.from("contracts").select("customer_id").eq("quote_id", paymentRecord.quote_id).limit(1);
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
          await logSistemaBackend({ tipo: "webhook", status: "warning", mensagem: `Provisionamento backup falhou (PAYMENT_CREATED): ${e instanceof Error ? e.message : String(e)}`, payload: { quote_id: paymentRecord.quote_id } });
        }
      }
    }

    // ── Payment confirmed: activate contract + create client account ──
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      console.log("[asaas-webhook] Pagamento confirmado! Ativando contrato e criando acesso...");

      if (paymentRecord.quote_id) {
        await supabase.from("contracts").update({ status: "ATIVO", service_status: "active", activated_at: new Date().toISOString() }).eq("quote_id", paymentRecord.quote_id);
        await supabase.from("quotes").update({ status: "active" }).eq("id", paymentRecord.quote_id);

        const { data: contractRows } = await supabase
          .from("contracts")
          .select("customer_id, contract_type, monthly_value, id")
          .eq("quote_id", paymentRecord.quote_id)
          .order("created_at", { ascending: false })
          .limit(1);
        const contractData = contractRows?.[0] ?? null;

        let customerInfo: Record<string, unknown> = {};
        if (contractData?.customer_id) {
          const { data: customer } = await supabase.from("customers").select("*").eq("id", contractData.customer_id).single();
          if (customer) customerInfo = customer;

          if (customer?.status_cliente === "excluido_lgpd") {
            console.log("[asaas-webhook] Cliente excluído LGPD — pulando provisionamento de acesso");
            await logSistemaBackend({ tipo: "webhook", status: "warning", mensagem: "Webhook recebido para cliente excluído LGPD — provisionamento bloqueado", payload: { customer_id: contractData.customer_id, event } });
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
                await logSistemaBackend({ tipo: "webhook", status: "success", mensagem: "Acesso completo liberado após confirmação de pagamento", payload: { quote_id: paymentRecord.quote_id, customer_id: contractData.customer_id, user_id: accessResult.user_id, user_created: accessResult.user_created, email: accessResult.email } });

                const pdfFunctionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-paid-contract-pdf`;
                await fetch(pdfFunctionUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")!, Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
                  body: JSON.stringify({ quote_id: paymentRecord.quote_id, generate_if_missing: true, send_email: true, access_source: "payment_webhook" }),
                });
              } else {
                await logSistemaBackend({ tipo: "admin", status: "warning", mensagem: "Pagamento confirmado, mas acesso ainda não pôde ser liberado automaticamente", payload: { quote_id: paymentRecord.quote_id, result: accessResult } });
              }
            } catch (e) {
              console.error("[asaas-webhook] Exceção ao garantir conta:", e);
              await logSistemaBackend({ tipo: "erro", status: "error", mensagem: "Exceção ao garantir conta automática", payload: { email: (customerInfo as any)?.email, error: String(e) } });
            }
          }
        }

        await supabase.from("integration_logs").insert({ integration_name: "asaas", operation_name: "invoice_generated", request_payload: { event, payment_id: payment.id, quote_id: paymentRecord.quote_id, value: payment.value, billing_period: payment.dueDate }, response_payload: { invoice_number: `NF-${Date.now()}`, generated_at: new Date().toISOString() }, status: "success" });
        await supabase.from("integration_logs").insert({ integration_name: "asaas", operation_name: "contract_activated", request_payload: { event, payment_id: payment.id, quote_id: paymentRecord.quote_id }, status: "success" });
        await supabase.from("integration_logs").insert({ integration_name: "wmti_notification", operation_name: "payment_confirmed_notification", request_payload: { customer: customerInfo, contract_type: contractData?.contract_type, monthly_value: contractData?.monthly_value || payment.value, payment_id: payment.id, quote_id: paymentRecord.quote_id, billing_type: payment.billingType, payment_date: new Date().toISOString() }, response_payload: { whatsapp_number: "5511963166915", notification_status: "logged", message: `Nova compra confirmada: ${(customerInfo as any)?.razao_social || "Cliente"} - R$ ${contractData?.monthly_value || payment.value} - ${contractData?.contract_type || "serviço"}` }, status: "success" });
        await supabase.from("admin_audit_logs").insert({ action: "payment_confirmed", target_type: "payment", target_id: paymentRecord.id, after_state: { event, quote_id: paymentRecord.quote_id, asaas_payment_id: payment.id, value: payment.value, customer: (customerInfo as any)?.razao_social || "N/A" } });

        console.log("[asaas-webhook] Contrato ativado para quote:", paymentRecord.quote_id);
      }
    }

    // ── Payment overdue ──
    if (event === "PAYMENT_OVERDUE" && paymentRecord.quote_id) {
      console.log("[asaas-webhook] Pagamento vencido. Marcando contrato como INADIMPLENTE.");
      await supabase.from("contracts").update({ status: "INADIMPLENTE", service_status: "overdue" }).eq("quote_id", paymentRecord.quote_id);
      await supabase.from("integration_logs").insert({ integration_name: "asaas", operation_name: "contract_overdue", request_payload: { event, payment_id: payment.id, quote_id: paymentRecord.quote_id }, status: "warning" });
    }

    // ══════════════════════════════════════════════════════════════
    // ── FISCAL DOCUMENT via PAYMENT (secondary — respects priority) ──
    // ══════════════════════════════════════════════════════════════
    if ((event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") && paymentRecord.quote_id) {
      try {
        const { data: contractForInvoice } = await supabase
          .from("contracts")
          .select("customer_id, contract_type, id")
          .eq("quote_id", paymentRecord.quote_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const custId = contractForInvoice?.[0]?.customer_id;
        const contractId = contractForInvoice?.[0]?.id;

        if (custId) {
          const asaasInvoiceId = payment.invoiceNumber || payment.id;

          // Idempotency: check if already exists
          const { data: existingInvoice } = await supabase
            .from("fiscal_documents")
            .select("id, status, document_number, access_key, invoice_series")
            .eq("asaas_invoice_id", asaasInvoiceId)
            .limit(1)
            .maybeSingle();

          if (existingInvoice) {
            // ── PRIORITY RULE: payment event CANNOT overwrite protected fields ──
            // Only enrich empty fields; never overwrite data set by invoice events
            const PROTECTED_STATUSES = ["emitido", "sincronizada", "cancelada", "cancelamento_processando", "cancelamento_negado", "erro"];
            const isProtected = PROTECTED_STATUSES.includes(existingInvoice.status);

            if (!isProtected) {
              // Only update status if current status is weak (criada, aguardando, pending)
              const enrichUpdates: Record<string, unknown> = {};
              if (!existingInvoice.document_number) {
                const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
                const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");
                if (ASAAS_API_KEY && ASAAS_BASE_URL) {
                  try {
                    const fiscalRes = await fetch(`${ASAAS_BASE_URL}/payments/${payment.id}/fiscalInfo`, { headers: { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" } });
                    if (fiscalRes.ok) {
                      const fd = await fiscalRes.json();
                      if (fd.invoiceNumber && !existingInvoice.document_number) enrichUpdates.document_number = String(fd.invoiceNumber);
                      if (fd.accessKey && !existingInvoice.access_key) enrichUpdates.access_key = fd.accessKey;
                    }
                  } catch { /* ignore */ }
                }
              }
              if (Object.keys(enrichUpdates).length) {
                enrichUpdates.notes = "Enriquecido via payment event (campos vazios)";
                await supabase.from("fiscal_documents").update(enrichUpdates).eq("id", existingInvoice.id);
                console.log("[asaas-webhook] Fiscal doc enriquecido (payment, secundário):", existingInvoice.id);
              } else {
                console.log("[asaas-webhook] Fiscal doc já existe, nada a enriquecer (payment secundário):", existingInvoice.id);
              }
            } else {
              console.log("[asaas-webhook] Fiscal doc protegido por invoice event, payment ignorado:", existingInvoice.id, existingInvoice.status);
            }

            await supabase.from("integration_logs").insert({
              integration_name: "asaas",
              operation_name: "fiscal_payment_skipped_priority",
              request_payload: { event, payment_id: payment.id, existing_status: existingInvoice.status, is_protected: isProtected },
              status: "info",
            });
          } else {
            // No existing doc → create initial record (payment as fallback origin)
            let pdfUrl: string | null = payment.invoiceUrl || payment.bankSlipUrl || null;
            let xmlUrl: string | null = null;
            let invoiceNumber: string | null = payment.invoiceNumber || null;
            let accessKey: string | null = null;

            const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
            const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");
            if (ASAAS_API_KEY && ASAAS_BASE_URL && payment.id) {
              try {
                const fiscalRes = await fetch(`${ASAAS_BASE_URL}/payments/${payment.id}/fiscalInfo`, { headers: { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" } });
                if (fiscalRes.ok) {
                  const fiscalData = await fiscalRes.json();
                  if (fiscalData.invoiceUrl) pdfUrl = fiscalData.invoiceUrl;
                  if (fiscalData.xmlUrl) xmlUrl = fiscalData.xmlUrl;
                  if (fiscalData.invoiceNumber) invoiceNumber = String(fiscalData.invoiceNumber);
                  if (fiscalData.accessKey) accessKey = fiscalData.accessKey;
                }
              } catch { /* ignore */ }
            }

            const { data: insertedDoc } = await supabase.from("fiscal_documents").insert({
              customer_id: custId,
              payment_id: paymentRecord.id,
              contract_id: contractId || null,
              asaas_invoice_id: asaasInvoiceId,
              document_type: "nota_fiscal",
              document_number: invoiceNumber,
              issue_date: new Date().toISOString().split("T")[0],
              amount: payment.value || 0,
              status: pdfUrl ? "emitido" : "aguardando",
              file_url: pdfUrl,
              xml_url: xmlUrl,
              access_key: accessKey,
              service_reference: contractForInvoice?.[0]?.contract_type || null,
              raw_payload: body,
              notes: "NF criada via payment event (fallback)",
            }).select("id").single();

            if (insertedDoc?.id) {
              const filesToInsert: { invoice_id: string; type: string; file_url: string; filename: string; mime_type: string }[] = [];
              if (pdfUrl) filesToInsert.push({ invoice_id: insertedDoc.id, type: "pdf", file_url: pdfUrl, filename: `NF-${invoiceNumber || asaasInvoiceId}.pdf`, mime_type: "application/pdf" });
              if (xmlUrl) filesToInsert.push({ invoice_id: insertedDoc.id, type: "xml", file_url: xmlUrl, filename: `NF-${invoiceNumber || asaasInvoiceId}.xml`, mime_type: "application/xml" });
              if (filesToInsert.length) await supabase.from("invoice_files").insert(filesToInsert);
            }

            console.log("[asaas-webhook] Fiscal doc criado (payment fallback):", custId);
            await supabase.from("integration_logs").insert({
              integration_name: "asaas",
              operation_name: "fiscal_document_created_payment_fallback",
              request_payload: { event, payment_id: payment.id, customer_id: custId, invoice_number: invoiceNumber, source: "payment_fallback" },
              status: "success",
            });
          }
        }
      } catch (fiscalErr) {
        console.error("[asaas-webhook] Erro ao persistir documento fiscal:", fiscalErr);
        await supabase.from("integration_logs").insert({ integration_name: "asaas", operation_name: "fiscal_document_error", request_payload: { event, payment_id: payment.id }, status: "error", error_message: fiscalErr instanceof Error ? fiscalErr.message : String(fiscalErr) });
      }
    }

    // Mark webhook as processed
    await supabase.from("asaas_webhooks").update({ processed: true }).eq("payload->>id", body.id);

    await supabase.from("integration_logs").insert({ integration_name: "asaas", operation_name: "webhook_processed", request_payload: { event, payment_id: payment.id }, response_payload: { new_status: newStatus, payment_record_id: paymentRecord.id }, status: "success" });

    return new Response(JSON.stringify({ received: true, status: newStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[asaas-webhook] Erro fatal:", message);
    await logSistemaBackend({ tipo: "webhook", status: "error", mensagem: `Webhook erro fatal: ${message}` });

    try {
      await supabase.from("integration_logs").insert({ integration_name: "asaas", operation_name: "webhook_error", status: "error", error_message: message });
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
