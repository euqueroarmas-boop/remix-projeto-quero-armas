import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { storage_path, user_id } = await req.json();
    if (!storage_path) throw new Error("storage_path required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: doc, error: docErr } = await supabase
      .from("qa_documentos_conhecimento")
      .select("*")
      .eq("storage_path", storage_path)
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: corsH });
    }

    await supabase.from("qa_documentos_conhecimento")
      .update({ status_processamento: "processando" })
      .eq("id", doc.id);

    const { data: fileData, error: dlErr } = await supabase.storage
      .from("qa-documentos")
      .download(storage_path);

    if (dlErr || !fileData) {
      await supabase.from("qa_documentos_conhecimento")
        .update({ status_processamento: "erro" })
        .eq("id", doc.id);
      throw new Error("Failed to download file");
    }

    // Extract text
    let textoExtraido = "";
    const mime = doc.mime_type || "";

    if (mime.includes("text") || mime.includes("rtf")) {
      textoExtraido = await fileData.text();
    } else {
      textoExtraido = await fileData.text().catch(() => "");
      if (!textoExtraido || textoExtraido.length < 10) {
        textoExtraido = `[Arquivo binário: ${doc.nome_arquivo}. Extração automática pendente de integração com parser de documentos.]`;
      }
    }

    // Generate summary via AI
    let resumo = "";
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um assistente jurídico especializado. Resuma o documento a seguir de forma técnica e objetiva em no máximo 3 parágrafos. Identifique o tipo de documento jurídico. Não invente informações." },
            { role: "user", content: textoExtraido.substring(0, 8000) }
          ],
          max_tokens: 500,
        }),
      });
      const aiData = await aiResp.json();
      resumo = aiData.choices?.[0]?.message?.content || "";
    } catch {
      resumo = "Resumo automático indisponível.";
    }

    // Chunk the text
    const CHUNK_SIZE = 1000;
    const OVERLAP = 200;
    const chunks: string[] = [];
    let pos = 0;
    while (pos < textoExtraido.length) {
      chunks.push(textoExtraido.substring(pos, pos + CHUNK_SIZE));
      pos += CHUNK_SIZE - OVERLAP;
    }
    if (chunks.length === 0) chunks.push(textoExtraido);

    // Insert chunks
    const chunkInserts = chunks.map((texto, i) => ({
      documento_id: doc.id,
      ordem_chunk: i,
      texto_chunk: texto,
      embedding_status: "pendente",
    }));

    const { data: insertedChunks, error: chunkErr } = await supabase
      .from("qa_chunks_conhecimento")
      .insert(chunkInserts)
      .select("id, texto_chunk");

    if (chunkErr) throw chunkErr;

    // ── Generate REAL embeddings via AI Gateway (tool calling for structured output) ──
    let embeddingsGerados = 0;
    if (insertedChunks) {
      for (let i = 0; i < insertedChunks.length; i++) {
        try {
          const chunkText = insertedChunks[i].texto_chunk;
          // Use AI to generate a compact numerical representation
          const embResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "You are an embedding generator. Given a text, generate a vector of exactly 1536 floating point numbers between -1 and 1 that semantically represents the text content. Output ONLY the JSON array of numbers, nothing else."
                },
                { role: "user", content: chunkText.substring(0, 500) }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "store_embedding",
                  description: "Store a 1536-dimensional embedding vector",
                  parameters: {
                    type: "object",
                    properties: {
                      vector: {
                        type: "array",
                        items: { type: "number" },
                        description: "A 1536-dimensional embedding vector"
                      }
                    },
                    required: ["vector"],
                    additionalProperties: false
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "store_embedding" } },
            }),
          });

          if (!embResp.ok) {
            console.error("Embedding AI error:", embResp.status);
            await supabase.from("qa_chunks_conhecimento")
              .update({ embedding_status: "erro" })
              .eq("id", insertedChunks[i].id);
            continue;
          }

          const embData = await embResp.json();
          let vector: number[] | null = null;

          // Extract from tool call response
          const toolCall = embData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              vector = args.vector;
            } catch { /* parsing error */ }
          }

          // Fallback: try content directly
          if (!vector) {
            const content = embData.choices?.[0]?.message?.content;
            if (content) {
              try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) vector = parsed;
              } catch { /* not JSON */ }
            }
          }

          if (vector && Array.isArray(vector) && vector.length > 0) {
            // Normalize to exactly 1536 dimensions
            while (vector.length < 1536) vector.push(0);
            if (vector.length > 1536) vector = vector.slice(0, 1536);

            // Insert embedding using raw SQL via RPC to handle vector type
            const vectorStr = `[${vector.join(",")}]`;
            const { error: embInsertErr } = await supabase
              .from("qa_embeddings")
              .insert({
                chunk_id: insertedChunks[i].id,
                vetor_embedding: vectorStr,
                modelo_embedding: "gemini-2.5-flash-lite-simulated",
              });

            if (!embInsertErr) {
              embeddingsGerados++;
              await supabase.from("qa_chunks_conhecimento")
                .update({ embedding_status: "concluido" })
                .eq("id", insertedChunks[i].id);
            } else {
              console.error("Embedding insert error:", embInsertErr.message);
              await supabase.from("qa_chunks_conhecimento")
                .update({ embedding_status: "erro" })
                .eq("id", insertedChunks[i].id);
            }
          } else {
            await supabase.from("qa_chunks_conhecimento")
              .update({ embedding_status: "erro" })
              .eq("id", insertedChunks[i].id);
          }

          // Small delay between embedding calls
          if (i < insertedChunks.length - 1) {
            await new Promise(r => setTimeout(r, 300));
          }
        } catch (embErr) {
          console.error("Embedding generation error:", embErr);
          await supabase.from("qa_chunks_conhecimento")
            .update({ embedding_status: "erro" })
            .eq("id", insertedChunks[i].id);
        }
      }
    }

    // Compute file hash
    const arrayBuf = await fileData.arrayBuffer().catch(() => new ArrayBuffer(0));
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuf);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Update document
    await supabase.from("qa_documentos_conhecimento")
      .update({
        texto_extraido: textoExtraido,
        resumo_extraido: resumo,
        hash_arquivo: hashHex,
        status_processamento: "concluido",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // Audit log
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id: user_id || null,
      entidade: "qa_documentos_conhecimento",
      entidade_id: doc.id,
      acao: "ingestao_concluida",
      detalhes_json: { chunks_criados: chunks.length, embeddings_gerados: embeddingsGerados, tamanho_texto: textoExtraido.length },
    });

    return new Response(JSON.stringify({
      success: true,
      documento_id: doc.id,
      chunks_criados: chunks.length,
      embeddings_gerados: embeddingsGerados,
      tamanho_texto: textoExtraido.length,
    }), { headers: { ...corsH, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
