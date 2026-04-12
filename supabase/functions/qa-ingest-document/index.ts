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

function sanitizeText(text: string): string {
  // Remove null bytes and other problematic unicode
  return text.replace(/\0/g, "").replace(/\\u0000/g, "");
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
      throw new Error("Falha no download do arquivo");
    }

    // Step 2: Extract text - handle PDFs properly
    let textoExtraido = "";
    const mime = doc.mime_type || "";

    if (mime.includes("text") || mime.includes("rtf")) {
      textoExtraido = sanitizeText(await fileData.text());
    } else {
      // For PDFs: attempt raw text extraction
      try {
        const rawText = await fileData.text();
        // Filter out binary garbage - keep only printable chars
        const printable = rawText.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF\n\r\t]/g, " ");
        const cleaned = printable.replace(/\s+/g, " ").trim();
        if (cleaned.length > 100) {
          textoExtraido = sanitizeText(cleaned);
        }
      } catch {
        // binary file, can't extract as text
      }

      // If text extraction yielded little, use Vision API
      if (textoExtraido.length < 100) {
        try {
          // Read file as array buffer for base64
          const arrayBuf = await fileData.arrayBuffer();
          // Limit to 500KB for the vision API
          const limitedBuf = arrayBuf.slice(0, 500000);
          const bytes = new Uint8Array(limitedBuf);
          
          // Convert to base64 manually
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "user", content: [
                  { type: "text", text: "Extraia todo o texto deste documento PDF. Retorne apenas o texto extraído, sem comentários." },
                  { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } }
                ]}
              ],
              max_tokens: 4000,
            }),
          });

          if (visionResp.ok) {
            const visionData = await visionResp.json();
            const extracted = visionData.choices?.[0]?.message?.content || "";
            if (extracted.length > 50) {
              textoExtraido = sanitizeText(extracted);
            }
          } else {
            console.log("Vision API status:", visionResp.status);
          }
        } catch (e) {
          console.error("Vision extraction failed:", e);
        }
      }

      // Final fallback
      if (!textoExtraido || textoExtraido.length < 20) {
        textoExtraido = `[Documento: ${doc.nome_arquivo}. Tipo: ${mime}. Tamanho: ${doc.tamanho_bytes} bytes. Extração de texto não foi possível - documento pode ser imagem escaneada ou protegido.]`;
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

    // Step 4: Save extracted text immediately
    await supabase.from("qa_documentos_conhecimento")
      .update({
        texto_extraido: textoExtraido,
        hash_arquivo: hashHex,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // Step 5: Generate summary (graceful on 402/credits)
    let resumo = "Resumo pendente.";
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
            { role: "system", content: "Resuma o documento jurídico a seguir em no máximo 2 parágrafos. Seja objetivo." },
            { role: "user", content: textoExtraido.substring(0, 3000) }
          ],
          max_tokens: 250,
        }),
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        resumo = aiData.choices?.[0]?.message?.content || "Resumo gerado sem conteúdo.";
      } else {
        console.log("AI summary status:", aiResp.status);
        resumo = aiResp.status === 402 
          ? "Resumo indisponível (créditos IA esgotados). O texto foi extraído com sucesso."
          : `Resumo indisponível (erro ${aiResp.status}).`;
      }
    } catch {
      resumo = "Resumo indisponível (erro de conexão).";
    }

    // Step 6: Chunk text (sanitized)
    const safeText = sanitizeText(textoExtraido);
    const CHUNK_SIZE = 800;
    const OVERLAP = 150;
    const chunks: string[] = [];
    let pos = 0;
    while (pos < safeText.length) {
      chunks.push(safeText.substring(pos, pos + CHUNK_SIZE));
      pos += CHUNK_SIZE - OVERLAP;
    }
    if (chunks.length === 0) chunks.push(safeText);

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
      // Try inserting chunks one by one as fallback
      let insertedCount = 0;
      for (const chunk of chunkInserts) {
        const { error } = await supabase.from("qa_chunks_conhecimento").insert(chunk);
        if (!error) insertedCount++;
      }
      console.log(`Fallback: inserted ${insertedCount}/${chunkInserts.length} chunks`);
    }

    // Step 8: Mark as complete
    await supabase.from("qa_documentos_conhecimento")
      .update({
        resumo_extraido: resumo,
        status_processamento: "concluido",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    console.log(`Document ${doc.id} processed OK: ${chunks.length} chunks, ${textoExtraido.length} chars`);

    // Step 9: Audit log (no .catch() chaining issue)
    try {
      await supabase.from("qa_logs_auditoria").insert({
        usuario_id: user_id || null,
        entidade: "qa_documentos_conhecimento",
        entidade_id: doc.id,
        acao: "ingestao_concluida",
        detalhes_json: { chunks_criados: chunks.length, tamanho_texto: textoExtraido.length },
      });
    } catch {
      // audit log is non-critical
    }

    // Step 10: Trigger embeddings asynchronously
    try {
      const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-generate-embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ documento_id: doc.id }),
      });
      console.log("Embeddings trigger status:", resp.status);
    } catch {
      console.log("Embeddings generation will be retried separately");
    }

  } catch (err) {
    console.error("Processing failed for", doc.id, ":", err.message);

    await supabase.from("qa_documentos_conhecimento")
      .update({
        status_processamento: "erro",
        resumo_extraido: `Erro: ${err.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    try {
      await supabase.from("qa_logs_auditoria").insert({
        usuario_id: user_id || null,
        entidade: "qa_documentos_conhecimento",
        entidade_id: doc.id,
        acao: "ingestao_erro",
        detalhes_json: { erro: err.message },
      });
    } catch {
      // non-critical
    }
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
