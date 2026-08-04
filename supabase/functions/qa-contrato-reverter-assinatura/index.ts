import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Reverte um contrato ASSINADO para "aguardando assinatura", preservando o
// registro (rastro jurídico) e liberando a regeneração com o cadastro corrigido.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

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
    const motivo = String(body?.motivo || "").trim() || "Reversão administrativa para correção de dados";
    if (!contratoId) return json({ error: "contrato_id obrigatório" }, 400);

    const { data: contrato } = await admin
      .from("qa_contracts")
      .select("id, status, venda_id, cliente_id, customer_signed_pdf_path, customer_signed_sha256")
      .eq("id", contratoId)
      .maybeSingle();
    if (!contrato) return json({ error: "Contrato não encontrado" }, 404);

    const snapshot = {
      status_anterior: contrato.status,
      customer_signed_pdf_path: contrato.customer_signed_pdf_path,
      customer_signed_sha256: contrato.customer_signed_sha256,
    };

    const { error: upErr } = await admin
      .from("qa_contracts")
      .update({
        status: "generated_pending_company_signature",
        customer_signed_pdf_path: null,
        customer_signed_sha256: null,
        customer_uploaded_at: null,
        validation_status: null,
      })
      .eq("id", contratoId);
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("qa_contract_events").insert({
      contract_id: contratoId,
      event_type: "assinatura_revertida_admin",
      event_payload: { ...snapshot, motivo, admin_user_id: user.id, admin_email: user.email },
    });

    await admin.from("qa_logs_auditoria").insert({
      acao: "contrato_assinatura_revertida",
      entidade_tipo: "qa_contracts",
      entidade_id: contratoId,
      user_id: user.id,
      detalhes_json: { ...snapshot, motivo, origem: "central_adesao_historico" },
    });

    // Regenera a PROCURAÇÃO junto com a reversão do contrato: se o contrato
    // voltou para assinatura é porque os dados do cadastro mudaram, e a
    // procuração antiga carrega o snapshot errado.
    let procuracao: unknown = null;
    try {
      const { data: pRes, error: pErr } = await admin.functions.invoke("qa-gerar-procuracao", {
        body: {
          cliente_id: contrato.cliente_id,
          venda_id: contrato.venda_id,
          force_regenerate: true,
        },
      });
      procuracao = pErr ? { ok: false, error: pErr.message } : pRes;
    } catch (e) {
      procuracao = { ok: false, error: (e as Error).message };
    }

    return json({ ok: true, status: "generated_pending_company_signature", procuracao });
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
