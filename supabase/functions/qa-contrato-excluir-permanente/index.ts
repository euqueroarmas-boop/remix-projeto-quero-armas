import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: perfil } = await admin
      .from("qa_usuarios_perfis")
      .select("perfil")
      .eq("user_id", user.id)
      .maybeSingle();
    if (perfil?.perfil !== "administrador") {
      return json({ error: "Acesso restrito a administradores" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const contratoId = String(body?.contrato_id || "").trim();
    if (!contratoId) return json({ error: "contrato_id obrigatório" }, 400);

    // Apaga dependências primeiro (sem FK cascade)
    await admin.from("qa_contract_signatures").delete().eq("contract_id", contratoId);
    await admin.from("qa_contract_aceites_log").delete().eq("contract_id", contratoId);
    await admin.from("qa_contract_items").delete().eq("contract_id", contratoId);
    await admin.from("qa_contract_events").delete().eq("contract_id", contratoId);
    await admin.from("qa_notificacao_eventos").delete().eq("contrato_id", contratoId);

    const { error: delErr } = await admin.from("qa_contracts").delete().eq("id", contratoId);
    if (delErr) return json({ error: delErr.message }, 500);

    await admin.from("qa_logs_auditoria").insert({
      acao: "contrato_excluido_permanente",
      entidade_tipo: "qa_contracts",
      entidade_id: contratoId,
      user_id: user.id,
      detalhes_json: { origem: "central_adesao_historico" },
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
