import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function processDocument(storage_path: string, user_id: string | null) {
  const supabase = getSupabase();

  const { data: doc, error: docErr } = await supabase
    .from("qa_documentos_conhecimento")
    .select("*")
    .eq("storage_path", storage_path)
    .maybeSingle();

  if (docErr || !doc) {
    console.error("Doc not found:", storage_path);
    return;
  }

  // Mark as processing
  await supabase.from("qa_documentos_conhecimento")
    .update({ status_processamento: "processando", updated_at: new Date().toISOString() })
    .eq("id", doc.id);

  try {
    // Step 1: Download file
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("qa-documentos")
      .download(storage_path);

    if (dlErr || !fileData) {
      throw new Error("download_failed: " + (dlErr?.message || "no data"));
    }

    // Step 2: Extract text
    let textoExtraido = "";
    const mime = doc.mime_type || "";

    if (mime.includes("text") || mime.includes("rtf")) {
      textoExtraido = await fileData.text();
    } else {
      // For PDFs and binary, try text extraction first
      try {
        textoExtraido = await fileData.text();
      } catch {
        textoExtraido = "";
      }
      
      const cleaned = textoExtraido.replace(/\s+/g, " ").trim();
      if (!cleaned || cleaned.length < 50) {
        // Try vision API for scanned PDFs
        try {
          const arrayBuf = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf.slice(0, 500000))));
          
          const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Extract all text content from this document image. Return only the extracted text, nothing else." },
                { role: "user", content: [
                  { type: "text", text: "Extract all text from this document:" },
                  { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
                ]}
              ],
              max_tokens: 4000,
            }),
          });

          if (visionResp.ok) {
            const visionData = await visionResp.json();
            const extracted = visionData.choices?.[0]?.message?.content || "";
            if (extracted.length > cleaned.length) {
              textoExtraido = extracted;
            }
          }
        } catch (e) {
          console.error("Vision extraction failed:", e);
        }

        if (!textoExtraido || textoExtraido.replace(/\s+/g, " ").trim().length < 10) {
          textoExtraido = `[Arquivo binário: ${doc.nome_arquivo}. Conteúdo não pôde ser extraído automaticamente.]`;
        }
      }
    }

    // Step 3: Compute file hash
    let hashHex = "";
    try {
      const arrayBuf = await fileData.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuf);
      hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {
      hashHex = "hash_unavailable";
    }

    // Step 4: Update with extracted text (mark as partially done)
    await supabase.from("qa_documentos_conhecimento")
      .update({
        texto_extraido: textoExtraido,
        hash_arquivo: hashHex,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // Step 5: Generate summary via AI
    let resumo = "";
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Você é um assistente jurídico. Resuma o documento a seguir em no máximo 2 parágrafos curtos. Seja objetivo." },
            { role: "user", content: textoExtraido.substring(0, 4000) }
          ],
          max_tokens: 300,
        }),
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        resumo = aiData.choices?.[0]?.message?.content || "Resumo indisponível.";
      } else {
        const status = aiResp.status;
        resumo = `Resumo indisponível (erro ${status}).`;
        console.error("AI summary error:", status);
      }
    } catch (e) {
      resumo = "Resumo indisponível (erro de conexão).";
      console.error("AI summary exception:", e);
    }

    // Step 6: Chunk text
    const CHUNK_SIZE = 800;
    const OVERLAP = 150;
    const chunks: string[] = [];
    let pos = 0;
    while (pos < textoExtraido.length) {
      chunks.push(textoExtraido.substring(pos, pos + CHUNK_SIZE));
      pos += CHUNK_SIZE - OVERLAP;
    }
    if (chunks.length === 0) chunks.push(textoExtraido);

    // Step 7: Insert chunks
    const chunkInserts = chunks.map((texto, i) => ({
      documento_id: doc.id,
      ordem_chunk: i,
      texto_chunk: texto,
      embedding_status: "pendente",
    }));

    const { error: chunkErr } = await supabase
      .from("qa_chunks_conhecimento")
      .insert(chunkInserts);

    if (chunkErr) {
      console.error("Chunk insert error:", chunkErr.message);
    }

    // Step 8: Mark as complete (skip embeddings in this call to avoid timeout)
    await supabase.from("qa_documentos_conhecimento")
      .update({
        resumo_extraido: resumo,
        status_processamento: "concluido",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // Step 9: Audit log
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id: user_id || null,
      entidade: "qa_documentos_conhecimento",
      entidade_id: doc.id,
      acao: "ingestao_concluida",
      detalhes_json: { chunks_criados: chunks.length, tamanho_texto: textoExtraido.length },
    }).catch(() => {});

    console.log(`Document ${doc.id} processed: ${chunks.length} chunks, text: ${textoExtraido.length} chars`);

    // Step 10: Trigger embeddings generation asynchronously (separate function call)
    try {
      await supabase.functions.invoke("qa-generate-embeddings", {
        body: { documento_id: doc.id },
      });
    } catch {
      console.log("Embeddings generation will be retried separately");
    }

  } catch (err) {
    console.error("Processing failed for", doc.id, ":", err.message);
    
    await supabase.from("qa_documentos_conhecimento")
      .update({
        status_processamento: "erro",
        resumo_extraido: `Erro no processamento: ${err.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // Audit log for error
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id: user_id || null,
      entidade: "qa_documentos_conhecimento",
      entidade_id: doc.id,
      acao: "ingestao_erro",
      detalhes_json: { erro: err.message },
    }).catch(() => {});
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { storage_path, user_id } = await req.json();
    if (!storage_path) {
      return new Response(JSON.stringify({ error: "storage_path required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Return immediately, process in background
    EdgeRuntime.waitUntil(processDocument(storage_path, user_id));

    return new Response(JSON.stringify({
      success: true,
      message: "Processamento iniciado em background",
    }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
