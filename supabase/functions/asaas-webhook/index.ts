import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { event, payment } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log webhook
    await supabase.from("asaas_webhooks").insert({
      event: event,
      payload: body,
      processed: false,
    });

    if (!payment?.id) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find payment record
    const { data: paymentRecord } = await supabase
      .from("payments")
      .select("id, quote_id")
      .eq("asaas_payment_id", payment.id)
      .single();

    if (!paymentRecord) {
      return new Response(JSON.stringify({ received: true, note: "payment not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newStatus = payment.status;

    // Map Asaas events to our status
    switch (event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        newStatus = "CONFIRMED";
        break;
      case "PAYMENT_OVERDUE":
        newStatus = "OVERDUE";
        break;
      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED":
        newStatus = "CANCELLED";
        break;
      default:
        newStatus = payment.status || event;
    }

    // Update payment status
    await supabase
      .from("payments")
      .update({ payment_status: newStatus })
      .eq("id", paymentRecord.id);

    // If confirmed, activate contract
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      if (paymentRecord.quote_id) {
        await supabase
          .from("contracts")
          .update({ status: "ATIVO" })
          .eq("quote_id", paymentRecord.quote_id);

        await supabase
          .from("quotes")
          .update({ status: "active" })
          .eq("id", paymentRecord.quote_id);
      }
    }

    // Mark webhook as processed
    await supabase
      .from("asaas_webhooks")
      .update({ processed: true })
      .eq("payload->>id", body.id);

    return new Response(JSON.stringify({ received: true, status: newStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
