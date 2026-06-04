import { logSistemaBackend } from "../_shared/logSistema.ts";
import { corsHeaders, createServiceClient, ensureClientAccess } from "../_shared/post-purchase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quote_id } = await req.json();
    if (!quote_id) {
      return new Response(JSON.stringify({ success: false, error: "quote_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();
    const result = await ensureClientAccess(supabase, quote_id, "access_recovery");

    await logSistemaBackend({
      tipo: "admin",
      status: result.success ? "success" : "warning",
      mensagem: result.success ? "Acesso do cliente garantido" : "Acesso do cliente pendente",
      payload: { quote_id, ...result },
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    await logSistemaBackend({
      tipo: "erro",
      status: "error",
      mensagem: "Erro ao garantir acesso do cliente",
      payload: { error: message },
    });

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});