import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeQrImage = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return jsonResponse({ error: "ASAAS_API_KEY not configured" }, 500);
    }

    const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");
    if (!ASAAS_BASE_URL) {
      return jsonResponse({ error: "ASAAS_BASE_URL not configured — refusing to default to sandbox in production" }, 500);
    }

    const body = await req.json();
    const {
      customer_name,
      customer_email,
      customer_cpf_cnpj,
      customer_phone,
      customer_mobile_phone,
      customer_postal_code,
      customer_address,
      customer_address_number,
      customer_complement,
      customer_province,
      customer_city,
      customer_state,
      customer_company,
      billing_type,
      value,
      description,
      quote_id,
    } = body;

    // PIX is not allowed for recurring subscriptions
    if (billing_type === "PIX") {
      return jsonResponse({ error: "PIX não é permitido para assinaturas recorrentes. Use Boleto ou Cartão de Crédito." }, 400);
    }

    console.log("[create-asaas-subscription] Iniciando...", { billing_type, value, quote_id });

    // ══════════════════════════════════════════════════════════
    // IDEMPOTENCY: Check for existing active payment/subscription
    // ══════════════════════════════════════════════════════════
    if (quote_id) {
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("id, asaas_payment_id, payment_status, billing_type, asaas_invoice_url")
        .eq("quote_id", quote_id)
        .not("asaas_payment_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (existingPayments && existingPayments.length > 0) {
        const paidStatuses = ["CONFIRMED", "RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
        const paidPayment = existingPayments.find((p: any) =>
          paidStatuses.includes(String(p.payment_status).toUpperCase())
        );
        if (paidPayment) {
          console.log("[create-asaas-subscription] BLOQUEADO: pedido já pago", paidPayment.id);
          return jsonResponse({
            success: true,
            invoiceUrl: paidPayment.asaas_invoice_url,
            invoice_url: paidPayment.asaas_invoice_url,
            asaasPaymentId: paidPayment.asaas_payment_id,
            status: "confirmed",
            reused: true,
            already_paid: true,
          }, 200);
        }

        const sameMethodPending = existingPayments.find((p: any) =>
          p.billing_type === billing_type && p.asaas_invoice_url
        );
        if (sameMethodPending) {
          console.log("[create-asaas-subscription] Reutilizando cobrança existente:", sameMethodPending.asaas_payment_id);
          return jsonResponse({
            success: true,
            invoiceUrl: sameMethodPending.asaas_invoice_url,
            invoice_url: sameMethodPending.asaas_invoice_url,
            asaasPaymentId: sameMethodPending.asaas_payment_id,
            status: String(sameMethodPending.payment_status || "pending").toLowerCase(),
            reused: true,
          }, 200);
        }
      }
    }

    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "create_subscription_start",
      request_payload: { customer_name, customer_email, billing_type, value, quote_id },
      status: "started",
    });

    // Build full customer payload
    const cleanPhone = (v?: string) => v ? v.replace(/\D/g, "") : undefined;
    const cleanCep = (v?: string) => v ? v.replace(/\D/g, "") : undefined;

    const customerPayload: Record<string, unknown> = {
      name: customer_name,
      email: customer_email,
      cpfCnpj: customer_cpf_cnpj.replace(/\D/g, ""),
    };
    if (customer_phone) customerPayload.phone = cleanPhone(customer_phone);
    if (customer_mobile_phone) customerPayload.mobilePhone = cleanPhone(customer_mobile_phone);
    if (customer_postal_code) customerPayload.postalCode = cleanCep(customer_postal_code);
    if (customer_address) customerPayload.address = customer_address;
    if (customer_address_number) customerPayload.addressNumber = customer_address_number;
    if (customer_complement) customerPayload.complement = customer_complement;
    if (customer_province) customerPayload.province = customer_province;
    if (customer_city) customerPayload.cityName = customer_city;
    if (customer_state) customerPayload.state = customer_state;
    if (customer_company) customerPayload.company = customer_company;

    const asaasHeaders = {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      "User-Agent": "WMTi-Integration/1.0",
    };

    console.log("[create-asaas-subscription] Criando cliente no Asaas... ENV:", ASAAS_BASE_URL.includes("sandbox") ? "SANDBOX" : "PRODUCAO");
    const customerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify(customerPayload),
    });

    const customerData = await customerRes.json();
    let asaasCustomerId = customerData.id;

    if (!customerRes.ok && !asaasCustomerId) {
      const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${customerPayload.cpfCnpj}`, {
        headers: { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" },
      });
      const searchData = await searchRes.json();
      if (!searchData.data?.[0]?.id) {
        await supabase.from("integration_logs").insert({
          integration_name: "asaas",
          operation_name: "create_customer_failed",
          request_payload: customerPayload,
          response_payload: customerData,
          status: "error",
          error_message: "Failed to create/find Asaas customer",
        });
        return jsonResponse({ error: "Falha ao criar/localizar cliente no Asaas", details: customerData }, 400);
      }
      asaasCustomerId = searchData.data[0].id;

      // Update existing customer with full checkout data
      try {
        await fetch(`${ASAAS_BASE_URL}/customers/${asaasCustomerId}`, {
          method: "PUT",
          headers: asaasHeaders,
          body: JSON.stringify(customerPayload),
        });
        console.log("[create-asaas-subscription] Cliente atualizado no Asaas:", asaasCustomerId);
      } catch (updateErr) {
        console.error("[create-asaas-subscription] Erro ao atualizar cliente:", updateErr);
      }
    }

    // ── Calculate dates ──
    const now = new Date();
    const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const nextDueDate = nextDue.toISOString().split("T")[0];

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 36);
    const endDateStr = endDate.toISOString().split("T")[0];

    // ── Create subscription (recurrent) ──
    const subscriptionPayload: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: billing_type,
      value,
      cycle: "MONTHLY",
      nextDueDate,
      endDate: endDateStr,
      description: description || "Contrato WMTi — Assinatura mensal",
      maxPayments: 36,
    };

    console.log("[create-asaas-subscription] Criando assinatura...", JSON.stringify(subscriptionPayload));
    const subRes = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify(subscriptionPayload),
    });

    const subData = await subRes.json();
    console.log("[create-asaas-subscription] Resposta assinatura:", JSON.stringify(subData));

    if (!subRes.ok) {
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "create_subscription_failed",
        request_payload: subscriptionPayload,
        response_payload: subData,
        status: "error",
        error_message: `Asaas returned ${subRes.status}`,
      });
      return jsonResponse({ error: "Falha ao criar assinatura", details: subData }, 400);
    }

    // ── Get first payment for redirect ──
    let invoiceUrl: string | null = null;
    let pixQrCodeImage: string | null = null;
    let pixCopyPaste: string | null = null;
    let firstPaymentId: string | null = null;

    // List payments for this subscription to get the first one
    try {
      const paymentsRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subData.id}/payments`, {
        headers: { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" },
      });
      const paymentsData = await paymentsRes.json();
      const firstPayment = paymentsData.data?.[0];

      if (firstPayment) {
        firstPaymentId = firstPayment.id;
        invoiceUrl = firstPayment.invoiceUrl || firstPayment.bankSlipUrl || null;

        // No PIX for subscriptions — skip QR code fetch
      }
    } catch (listErr) {
      console.error("[create-asaas-subscription] Erro ao listar pagamentos da assinatura:", listErr);
    }

    // ── Update database ──
    if (quote_id) {
      const { data: latestPayment } = await supabase
        .from("payments")
        .select("id")
        .eq("quote_id", quote_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const payload = {
        asaas_payment_id: firstPaymentId || subData.id,
        payment_method: billing_type,
        payment_status: "PENDING",
        billing_type,
        due_date: nextDueDate,
        asaas_invoice_url: invoiceUrl,
      };

      if (latestPayment?.id) {
        await supabase.from("payments").update(payload).eq("id", latestPayment.id);
      } else {
        await supabase.from("payments").insert({ quote_id, ...payload });
      }
    }

    const normalizedResponse = {
      success: true,
      billingType: billing_type,
      invoiceUrl,
      pixQrCodeImage,
      pixCopyPaste,
      asaasPaymentId: firstPaymentId || subData.id,
      subscriptionId: subData.id,
      status: "pending",
      endDate: endDateStr,
      cycle: "MONTHLY",
    };

    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "create_subscription_success",
      request_payload: subscriptionPayload,
      response_payload: normalizedResponse,
      status: "success",
    });

    console.log("[create-asaas-subscription] Sucesso:", JSON.stringify(normalizedResponse));
    return jsonResponse(normalizedResponse, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[create-asaas-subscription] Erro fatal:", message);

    try {
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "create_subscription_error",
        status: "error",
        error_message: message,
      });
    } catch { /* ignore */ }

    return jsonResponse({ error: message }, 500);
  }
});
