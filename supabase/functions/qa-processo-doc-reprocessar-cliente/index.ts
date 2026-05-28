// ============================================================================
// qa-processo-doc-reprocessar-cliente
// ----------------------------------------------------------------------------
// Cliente logado pode reenfileirar a validação IA APENAS de documento próprio
// já enviado. Usado pelo Assistente após salvar uma decisão/ajuste cadastral.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7).trim();

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "invalid_token" }, 401);
    const authUserId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const processoId = String(body?.processo_id || "").trim();
    const documentoId = String(body?.documento_id || "").trim();
    if (!processoId || !documentoId) return json({ error: "processo_id_e_documento_id_obrigatorios" }, 400);

    const admin = createClient(url, service);
    const { data: doc, error: docErr } = await admin
      .from("qa_processo_documentos")
      .select("id, processo_id, cliente_id, arquivo_storage_key")
      .eq("id", documentoId)
      .eq("processo_id", processoId)
      .maybeSingle();
    if (docErr) return json({ error: docErr.message }, 500);
    if (!doc) return json({ error: "documento_not_found" }, 404);
    if (!doc.arquivo_storage_key) return json({ error: "documento_sem_arquivo" }, 400);

    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);

    const targetClienteId = processo.cliente_id ?? doc.cliente_id ?? null;
    if (!targetClienteId) return json({ error: "cliente_indefinido" }, 400);

    const { data: cliente } = await admin
      .from("qa_clientes")
      .select("id, user_id, excluido")
      .eq("id", targetClienteId)
      .maybeSingle();
    if (!cliente) return json({ error: "cliente_not_found" }, 404);
    if ((cliente as any).excluido) return json({ error: "cliente_excluido" }, 403);

    const isDirectOwner = (cliente as any).user_id === authUserId;
    let isLinkedOwner = false;
    if (!isDirectOwner) {
      const { data: link } = await admin
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", authUserId)
        .eq("qa_cliente_id", targetClienteId)
        .maybeSingle();
      isLinkedOwner = !!link;
    }
    if (!isDirectOwner && !isLinkedOwner) return json({ error: "forbidden" }, 403);

    const { error: upErr } = await admin
      .from("qa_processo_documentos")
      .update({
        status: "em_analise",
        validacao_ia_status: "fila",
        validacao_ia_erro: null,
        motivo_rejeicao: null,
      })
      .eq("id", documentoId)
      .eq("processo_id", processoId);
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      documento_id: documentoId,
      tipo_evento: "documento_reprocessado_pelo_cliente",
      descricao: "Cliente salvou decisão cadastral e reenviou o documento para validação.",
      ator: "cliente",
      dados_json: { motivo: body?.motivo || "decisao_cadastral" },
    } as any);

    // @ts-ignore EdgeRuntime
    (globalThis as any).EdgeRuntime?.waitUntil(
      fetch(`${url}/functions/v1/qa-processo-doc-validar-ia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${service}`,
          "x-internal-call": "1",
        },
        body: JSON.stringify({
          processo_id: processoId,
          documento_id: documentoId,
          storage_path: doc.arquivo_storage_key,
        }),
      }).then((r) => r.text()).catch((e) => console.error("IA dispatch cliente err:", e)),
    );

    return json({ success: true, status: "em_analise" });
  } catch (e: any) {
    console.error("[qa-processo-doc-reprocessar-cliente]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
