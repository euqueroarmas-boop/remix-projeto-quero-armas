// ─────────────────────────────────────────────────────────────
// qa-chat-aprovar-resposta
//   POST { mensagem_id, acao: "aprovar" | "rejeitar" }
//   Staff-only. Cria documento em qa_documentos_conhecimento
//   (papel=aprendizado, tipo=qa_aprovado, referencia_preferencial=true),
//   pré-preenche texto_extraido, faz chunking + dispara embeddings.
// ─────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { requireQAStaff } = await import("../_shared/qaAuth.ts");
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;
    const staffUserId = guard.userId;

    const { mensagem_id, acao, conteudo_corrigido } = await req.json();
    if (!mensagem_id || !["aprovar", "rejeitar"].includes(acao)) {
      return json({ error: "mensagem_id e acao (aprovar|rejeitar) obrigatórios" }, 400);
    }
    const conteudoCorrigido =
      typeof conteudo_corrigido === "string" && conteudo_corrigido.trim().length > 0
        ? conteudo_corrigido.trim()
        : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Carrega a mensagem
    const { data: msg, error: msgErr } = await supabase
      .from("qa_chat_mensagens")
      .select("id, sessao_id, cliente_id, role, content, fontes, created_at, aprovada_kb")
      .eq("id", mensagem_id)
      .maybeSingle();
    if (msgErr || !msg) return json({ error: "mensagem não encontrada" }, 404);
    if (msg.role !== "assistant") return json({ error: "apenas respostas da IA podem ser aprovadas" }, 400);

    if (acao === "rejeitar") {
      const { error } = await supabase
        .from("qa_chat_mensagens")
        .update({
          aprovada_kb: false,
          aprovada_por: staffUserId,
          aprovada_em: new Date().toISOString(),
        })
        .eq("id", mensagem_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, acao: "rejeitada" });
    }

    // ─── APROVAR ────────────────────────────────────────────
    // Pergunta = última mensagem user anterior na mesma sessão
    const { data: perguntaRow } = await supabase
      .from("qa_chat_mensagens")
      .select("content")
      .eq("sessao_id", msg.sessao_id)
      .eq("role", "user")
      .lt("created_at", msg.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const pergunta = (perguntaRow?.content || "").trim() || "Pergunta não localizada";
    const resposta = (conteudoCorrigido ?? String(msg.content || "")).trim();

    const textoExtraido = `Pergunta: ${pergunta}\n\nResposta: ${resposta}`;
    const titulo = `QA: ${pergunta.substring(0, 80).replace(/\s+/g, " ").trim()}`;
    const syntheticPath = `qa-aprovado/${msg.id}.txt`;

    // 1) cria o documento (texto já pronto — pula OCR)
    const { data: novoDoc, error: docErr } = await supabase
      .from("qa_documentos_conhecimento")
      .insert({
        titulo,
        tipo_documento: "qa_aprovado",
        papel_documento: "aprendizado",
        nome_arquivo: `${msg.id}.txt`,
        storage_path: syntheticPath,
        mime_type: "text/plain",
        tipo_origem: "chat_aprovado",
        texto_extraido: textoExtraido,
        resumo_extraido: pergunta.substring(0, 500),
        metodo_extracao: "chat_aprovado",
        status_processamento: "criando_chunks",
        status_validacao: "validado",
        ativo: true,
        ativo_na_ia: true,
        visivel_cliente: true,
        referencia_preferencial: true,
        enviado_por: staffUserId,
        metadados_json: {
          origem: "chat_aprovado",
          mensagem_id: msg.id,
          sessao_id: msg.sessao_id,
          cliente_id: msg.cliente_id,
          fontes_originais: msg.fontes ?? [],
          aprovado_por: staffUserId,
          aprovado_em: new Date().toISOString(),
          corrigido_manualmente: !!conteudoCorrigido,
        },
      })
      .select("id")
      .single();
    if (docErr || !novoDoc) return json({ error: docErr?.message || "erro ao criar documento" }, 500);

    const docId = novoDoc.id as string;

    // 2) chunking (mesma lógica de qa-ingest-document)
    const CHUNK_SIZE = 800;
    const OVERLAP = 150;
    const chunks: string[] = [];
    let pos = 0;
    while (pos < textoExtraido.length) {
      chunks.push(textoExtraido.substring(pos, pos + CHUNK_SIZE));
      pos += CHUNK_SIZE - OVERLAP;
    }
    if (chunks.length === 0) chunks.push(textoExtraido);

    const inserts = chunks.map((texto, i) => ({
      documento_id: docId,
      ordem_chunk: i,
      texto_chunk: texto,
      embedding_status: "pendente",
    }));
    const { error: chunkErr } = await supabase
      .from("qa_chunks_conhecimento")
      .insert(inserts);
    if (chunkErr) {
      console.warn("chunk insert bulk failed, tentando individual:", chunkErr.message);
      for (const c of inserts) {
        await supabase.from("qa_chunks_conhecimento").insert(c);
      }
    }

    await supabase
      .from("qa_documentos_conhecimento")
      .update({ status_processamento: "gerando_embeddings", updated_at: new Date().toISOString() })
      .eq("id", docId);

    // 3) dispara embeddings (fire-and-forget via waitUntil)
    const authToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const triggerEmbeddings = (async () => {
      try {
        const resp = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-generate-embeddings`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ documento_id: docId }),
          },
        );
        console.log("[qa-chat-aprovar] embeddings trigger:", resp.status);
      } catch (e) {
        console.warn("[qa-chat-aprovar] embeddings trigger error:", e);
      }
    })();
    (globalThis as any).EdgeRuntime?.waitUntil?.(triggerEmbeddings);

    // 4) marca mensagem como aprovada
    const updatePayload: Record<string, unknown> = {
      aprovada_kb: true,
      aprovada_por: staffUserId,
      aprovada_em: new Date().toISOString(),
      doc_kb_id: docId,
    };
    if (conteudoCorrigido) updatePayload.conteudo_corrigido = conteudoCorrigido;
    const { error: updErr } = await supabase
      .from("qa_chat_mensagens")
      .update(updatePayload)
      .eq("id", mensagem_id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ success: true, acao: "aprovada", doc_kb_id: docId, chunks: chunks.length });
  } catch (e: any) {
    console.error("qa-chat-aprovar-resposta error:", e);
    return json({ error: e?.message ?? "erro" }, 500);
  }
});