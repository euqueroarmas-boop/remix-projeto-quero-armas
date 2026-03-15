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

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ASAAS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") || "https://api-sandbox.asaas.com/v3";

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

    // 1. Create or find customer in Asaas
    const customerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify({
        name: customer_name,
        email: customer_email,
        cpfCnpj: customer_cpf_cnpj.replace(/\D/g, ""),
      }),
    });

    const customerData = await customerRes.json();
    if (!customerRes.ok && !customerData.id) {
      // Try to find existing customer
      const searchRes = await fetch(
        `${ASAAS_BASE_URL}/customers?cpfCnpj=${customer_cpf_cnpj.replace(/\D/g, "")}`,
        {
          headers: { access_token: ASAAS_API_KEY },
        }
      );
      const searchData = await searchRes.json();
      if (!searchData.data?.[0]?.id) {
        return new Response(
          JSON.stringify({ error: "Failed to create/find Asaas customer", details: customerData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      customerData.id = searchData.data[0].id;
    }

    // 2. Create payment
    const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerData.id,
        billingType: billing_type,
        value: value,
        dueDate: due_date,
        description: description || "Contrato WMTi",
      }),
    });

    const paymentData = await paymentRes.json();
    console.log("[create-asaas-payment] Resposta do Asaas:", JSON.stringify(paymentData));

    if (!paymentRes.ok) {
      console.error("[create-asaas-payment] Falha ao criar cobrança:", JSON.stringify(paymentData));
      return new Response(
        JSON.stringify({ error: "Failed to create payment", details: paymentData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoiceUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl || null;

    if (!invoiceUrl) {
      console.error("[create-asaas-payment] Asaas não retornou URL de pagamento. Payment ID:", paymentData.id);
      return new Response(
        JSON.stringify({ error: "Asaas did not return a payment URL", payment_id: paymentData.id }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Update payment record in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (quote_id) {
      await supabase
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
    }

    console.log("[create-asaas-payment] Cobrança criada com sucesso. URL:", invoiceUrl);

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
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
