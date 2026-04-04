import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "SETTLED"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { quote_id } = await req.json();
    if (!quote_id) {
      return new Response(JSON.stringify({ error: "quote_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find payment record
    const { data: payment } = await supabase
      .from("payments")
      .select("id, asaas_payment_id, payment_status, billing_type, asaas_invoice_url")
      .eq("quote_id", quote_id)
      .not("asaas_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!payment) {
      return new Response(JSON.stringify({ payment_status: null, not_found: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If already confirmed in our DB, return immediately
    const currentUpper = String(payment.payment_status || "").toUpperCase();
    if (PAID_STATUSES.has(currentUpper)) {
      return new Response(JSON.stringify({
        payment_status: payment.payment_status,
        already_confirmed: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query Asaas API for real status
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");
    if (!ASAAS_BASE_URL) {
      return new Response(JSON.stringify({
        payment_status: payment.payment_status,
        error: "ASAAS_BASE_URL not configured",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({
        payment_status: payment.payment_status,
        error: "ASAAS_API_KEY not configured",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const asaasRes = await fetch(`${ASAAS_BASE_URL}/payments/${payment.asaas_payment_id}`, {
      headers: { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" },
    });

    if (!asaasRes.ok) {
      console.error("[check-payment-status] Asaas API error:", asaasRes.status);
      return new Response(JSON.stringify({
        payment_status: payment.payment_status,
        asaas_error: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const asaasData = await asaasRes.json();
    const asaasStatus = String(asaasData.status || "").toUpperCase();
    console.log("[check-payment-status] Asaas status:", asaasStatus, "DB status:", payment.payment_status);

    // If Asaas says paid but our DB says pending, reconcile now
    if (PAID_STATUSES.has(asaasStatus) && !PAID_STATUSES.has(currentUpper)) {
      console.log("[check-payment-status] Reconciling payment", payment.id, "→ CONFIRMED");

      await supabase
        .from("payments")
        .update({ payment_status: "CONFIRMED" })
        .eq("id", payment.id);

      // Also activate contract + quote
      const { data: contractRows } = await supabase
        .from("contracts")
        .select("id, quote_id")
        .eq("quote_id", quote_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (contractRows?.[0]) {
        await supabase
          .from("contracts")
          .update({ status: "ATIVO" })
          .eq("id", contractRows[0].id);
      }

      await supabase
        .from("quotes")
        .update({ status: "active" })
        .eq("id", quote_id);

      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "payment_reconciled_by_poll",
        request_payload: { quote_id, asaas_payment_id: payment.asaas_payment_id, asaas_status: asaasStatus },
        status: "success",
      });

      return new Response(JSON.stringify({
        payment_status: "CONFIRMED",
        reconciled: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Asaas status for response
    let mappedStatus = payment.payment_status;
    if (asaasStatus === "OVERDUE") mappedStatus = "OVERDUE";

    return new Response(JSON.stringify({
      payment_status: mappedStatus,
      asaas_status: asaasStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-payment-status] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
