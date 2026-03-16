import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ASAAS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") || "https://sandbox.asaas.com/api/v3";

    const body = await req.json();
    const {
      customer_name,
      customer_email,
      customer_cpf_cnpj,
      billing_type,
      value,
      due_date,
      description,
      quote_id,
    } = body;

    console.log("[create-asaas-payment] Iniciando...", { billing_type, value, quote_id });

    // Log request
    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "create_payment_start",
      request_payload: { customer_name, customer_email, billing_type, value, due_date, quote_id },
      status: "started",
    });

    // 1. Create or find customer in Asaas
    const customerPayload = {
      name: customer_name,
      email: customer_email,
      cpfCnpj: customer_cpf_cnpj.replace(/\D/g, ""),
    };

    console.log("[create-asaas-payment] Criando cliente no Asaas...");
    const customerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(customerPayload),
    });

    const customerData = await customerRes.json();
    console.log("[create-asaas-payment] Resposta cliente:", JSON.stringify(customerData));

    let asaasCustomerId = customerData.id;

    if (!customerRes.ok && !asaasCustomerId) {
      // Try to find existing customer
      console.log("[create-asaas-payment] Cliente não criado, buscando existente...");
      const searchRes = await fetch(
        `${ASAAS_BASE_URL}/customers?cpfCnpj=${customer_cpf_cnpj.replace(/\D/g, "")}`,
        { headers: { access_token: ASAAS_API_KEY } }
      );
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
        return new Response(
          JSON.stringify({ error: "Failed to create/find Asaas customer", details: customerData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      asaasCustomerId = searchData.data[0].id;
    }

    // Log customer creation
    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "customer_resolved",
      request_payload: customerPayload,
      response_payload: { asaas_customer_id: asaasCustomerId },
      status: "success",
    });

    // 2. Create payment
    const paymentPayload = {
      customer: asaasCustomerId,
      billingType: billing_type,
      value: value,
      dueDate: due_date,
      description: description || "Contrato WMTi",
    };

    console.log("[create-asaas-payment] Criando cobrança...", JSON.stringify(paymentPayload));
    const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentRes.json();
    console.log("[create-asaas-payment] Resposta pagamento:", JSON.stringify(paymentData));

    if (!paymentRes.ok) {
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "create_payment_failed",
        request_payload: paymentPayload,
        response_payload: paymentData,
        status: "error",
        error_message: `Asaas returned ${paymentRes.status}`,
      });
      return new Response(
        JSON.stringify({ error: "Failed to create payment", details: paymentData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoiceUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl || null;

    if (!invoiceUrl) {
      console.error("[create-asaas-payment] Asaas não retornou URL. Payment ID:", paymentData.id);
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "create_payment_no_url",
        request_payload: paymentPayload,
        response_payload: paymentData,
        status: "warning",
        error_message: "Asaas did not return invoiceUrl",
      });
      return new Response(
        JSON.stringify({ error: "Asaas did not return a payment URL", payment_id: paymentData.id }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Update payment record in database
    if (quote_id) {
      const { error: dbErr } = await supabase
        .from("payments")
        .update({
          asaas_payment_id: paymentData.id,
          payment_method: billing_type,
          payment_status: paymentData.status || "PENDING",
          billing_type: billing_type,
          due_date: due_date,
          asaas_invoice_url: invoiceUrl,
        })
        .eq("quote_id", quote_id);

      if (dbErr) {
        console.error("[create-asaas-payment] Erro ao atualizar payment no DB:", dbErr);
      }
    }

    // Log success
    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "create_payment_success",
      request_payload: paymentPayload,
      response_payload: {
        payment_id: paymentData.id,
        invoice_url: invoiceUrl,
        status: paymentData.status,
      },
      status: "success",
    });

    console.log("[create-asaas-payment] Cobrança criada. URL:", invoiceUrl);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentData.id,
        invoice_url: invoiceUrl,
        status: paymentData.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[create-asaas-payment] Erro fatal:", message);

    try {
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "create_payment_error",
        status: "error",
        error_message: message,
      });
    } catch {}

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
