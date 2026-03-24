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

  try {
    const { quote_id } = await req.json();
    if (!quote_id) {
      return new Response(JSON.stringify({ error: "quote_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify payment is confirmed
    const { data: payment } = await supabase
      .from("payments")
      .select("payment_status")
      .eq("quote_id", quote_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!payment || (payment.payment_status !== "CONFIRMED" && payment.payment_status !== "RECEIVED")) {
      return new Response(JSON.stringify({ error: "Pagamento não confirmado", status: "pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find customer via contract
    const { data: contract } = await supabase
      .from("contracts")
      .select("customer_id")
      .eq("quote_id", quote_id)
      .single();

    if (!contract?.customer_id) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find customer
    const { data: customer } = await supabase
      .from("customers")
      .select("user_id, email")
      .eq("id", contract.customer_id)
      .single();

    if (!customer?.user_id) {
      return new Response(JSON.stringify({ error: "Conta ainda não criada", status: "user_pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user metadata to find temp password
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(customer.user_id);

    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = userData.user.user_metadata || {};
    const tempPassword = meta.temp_password || null;
    const passwordChangeRequired = meta.password_change_required || false;

    return new Response(
      JSON.stringify({
        success: true,
        email: customer.email,
        temp_password: tempPassword,
        password_change_required: passwordChangeRequired,
        user_created: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[get-client-credentials] Erro:", message);
    await logSistemaBackend({
      tipo: "erro",
      status: "error",
      mensagem: "Erro ao buscar credenciais do cliente",
      payload: { error: message },
    });
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
