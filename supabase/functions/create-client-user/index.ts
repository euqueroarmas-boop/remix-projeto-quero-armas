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
    const { password: adminPwd, customer_id, email, password, name } = await req.json();

    // Validate admin password
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD || adminPwd !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create auth user with admin API (auto-confirms email)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email },
    });

    if (authError) {
      await logSistemaBackend({
        tipo: "admin",
        status: "error",
        mensagem: "Erro ao criar usuário do cliente",
        payload: { email, error: authError.message },
      });
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Link user_id to customer if customer_id provided
    if (customer_id) {
      await supabase
        .from("customers")
        .update({ user_id: userId })
        .eq("id", customer_id);

      // Create client event
      await supabase.from("client_events").insert({
        customer_id,
        event_type: "cadastro",
        title: "Acesso ao portal criado",
        description: `Credenciais criadas para ${email}`,
      });
    }

    await logSistemaBackend({
      tipo: "admin",
      status: "success",
      mensagem: "Usuário do cliente criado com sucesso",
      payload: { email, user_id: userId, customer_id },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await logSistemaBackend({
      tipo: "admin",
      status: "error",
      mensagem: "Erro inesperado ao criar usuário",
      payload: { error: error.message },
    });
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
