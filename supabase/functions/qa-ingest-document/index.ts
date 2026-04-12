import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractText } from "https://esm.sh/unpdf@0.12.1";

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
  return text
    .replace(/\0/g, "")
    .replace(/\\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Check if extracted text is real human-readable content, not binary garbage */
function isTextValid(text: string): boolean {
  if (!text || text.length < 50) return false;
  // Reject if starts with PDF header
  if (text.trimStart().startsWith("%PDF")) return false;
  // Count alphabetic chars vs total
  const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  const ratio = letters / text.length;
  // Real text should have at least 30% letters
  if (ratio < 0.3) return false;
  // Check for excessive PDF structure markers
  const pdfMarkers = (text.match(/\b(endobj|endstream|obj|Type|Page|Font|Filter)\b/g) || []).length;
  if (pdfMarkers > 10) return false;
  return true;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function extractPdfWithUnpdf(rawBytes: Uint8Array): Promise<string> {
  try {
    const { text } = await extractText(new Uint8Array(rawBytes), { mergePages: true });
    return sanitizeText(text);
  } catch (e) {
    console.error("unpdf extraction failed:", e);
    return "";
  }
}

async function extractPdfWithVisionApi(rawBytes: Uint8Array, mime: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("No LOVABLE_API_KEY for Vision fallback");
    return "";
  }
  try {
    // Limit to 4MB for the API call
    const limitedBytes = rawBytes.slice(0, 4_000_000);
    const base64 = arrayBufferToBase64(limitedBytes.buffer);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todo o texto deste documento PDF. Retorne APENAS o texto extraído, sem comentários." },
              { type: "image_url", image_url: { url: `data:${mime || "application/pdf"};base64,${base64}` } }
            ]
          }
        ],
        max_tokens: 8000,
      }),
    });

    if (!resp.ok) {
      console.error("Vision API status:", resp.status);
      return resp.status === 402 ? "__402__" : "";
    }
    const data = await resp.json();
    const extracted = data.choices?.[0]?.message?.content || "";
    return sanitizeText(extracted);
  } catch (e) {
    console.error("Vision extraction error:", e);
    return "";
  }
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

  await supabase.from("qa_documentos_conhecimento")
    .update({ status_processamento: "processando", updated_at: new Date().toISOString() })
    .eq("id", doc.id);

  try {
    // Step 1: Download file
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("qa-documentos")
      .download(storage_path);

    if (dlErr || !fileData) throw new Error("Falha no download do arquivo");

    const rawArrayBuf = await fileData.arrayBuffer();
    const rawBytes = new Uint8Array(rawArrayBuf);
    const mime = doc.mime_type || "";

    // Step 2: Extract text
    let textoExtraido = "";
    let extractionMethod = "none";

    if (mime.includes("text") || mime.includes("rtf")) {
      // Plain text files
      textoExtraido = sanitizeText(new TextDecoder().decode(rawBytes));
      extractionMethod = "text-decode";
    } else {
      // PDF or binary document — use unpdf for native extraction
      console.log("Attempting unpdf native extraction...");
      const nativeText = await extractPdfWithUnpdf(rawBytes);

      if (isTextValid(nativeText)) {
        textoExtraido = nativeText;
        extractionMethod = "unpdf-native";
        console.log(`unpdf OK: ${nativeText.length} chars`);
      } else {
        // Fallback: Vision API (OCR) for scanned PDFs
        console.log("Native extraction yielded invalid text. Trying Vision API OCR...");
        const visionText = await extractPdfWithVisionApi(rawBytes, mime);

        if (visionText === "__402__") {
          // AI credits exhausted — mark as failed with clear reason
          extractionMethod = "vision-402";
          textoExtraido = "";
        } else if (isTextValid(visionText)) {
          textoExtraido = visionText;
          extractionMethod = "vision-ocr";
          console.log(`Vision OCR OK: ${visionText.length} chars`);
        } else {
          extractionMethod = "failed";
          textoExtraido = "";
        }
      }
    }

    // Hard cap
    if (textoExtraido.length > 200000) {
      textoExtraido = textoExtraido.substring(0, 200000);
    }

    // Step 3: Validate extracted text quality
    if (!isTextValid(textoExtraido)) {
      const failReason = extractionMethod === "vision-402"
        ? "Extração nativa não encontrou texto legível e o OCR por IA está indisponível (saldo insuficiente). Reprocesse quando o saldo for recarregado."
        : "Texto extraído é ilegível ou corrompido. O PDF pode ser escaneado/imagem e requer OCR.";

      await supabase.from("qa_documentos_conhecimento")
        .update({
          status_processamento: "texto_invalido",
          resumo_extraido: failReason,
          texto_extraido: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      console.log(`Document ${doc.id} marked as texto_invalido: ${extractionMethod}`);

      try {
        await supabase.from("qa_logs_auditoria").insert({
          usuario_id: user_id || null,
          entidade: "qa_documentos_conhecimento",
          entidade_id: doc.id,
          acao: "ingestao_texto_invalido",
          detalhes_json: { extractionMethod, textLength: textoExtraido.length },
        });
      } catch { /* non-critical */ }
      return;
    }

    // Step 4: Compute file hash
    let hashHex = "";
    try {
      const hashBuffer = await crypto.subtle.digest("SHA-256", rawArrayBuf);
      hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {
      hashHex = "hash_unavailable";
    }

    // Step 5: Save extracted text
    await supabase.from("qa_documentos_conhecimento")
      .update({
        texto_extraido: textoExtraido,
        hash_arquivo: hashHex,
        metodo_extracao: extractionMethod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // Step 6: Generate summary (graceful on 402)
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
        resumo = aiResp.status === 402
          ? "Resumo indisponível (saldo de IA insuficiente). O texto foi extraído com sucesso."
          : `Resumo indisponível (erro ${aiResp.status}).`;
      }
    } catch {
      resumo = "Resumo indisponível (erro de conexão).";
    }

    // Step 7: Delete any old corrupted chunks for this document before creating new ones
    await supabase.from("qa_chunks_conhecimento")
      .delete()
      .eq("documento_id", doc.id);

    // Step 8: Chunk text
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

    // Step 9: Insert chunks
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
      let insertedCount = 0;
      for (const chunk of chunkInserts) {
        const { error } = await supabase.from("qa_chunks_conhecimento").insert(chunk);
        if (!error) insertedCount++;
      }
      console.log(`Fallback: inserted ${insertedCount}/${chunkInserts.length} chunks`);
    }

    // Step 10: Mark as complete
    await supabase.from("qa_documentos_conhecimento")
      .update({
        resumo_extraido: resumo,
        status_processamento: "concluido",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    console.log(`Document ${doc.id} processed OK (${extractionMethod}): ${chunks.length} chunks, ${textoExtraido.length} chars`);

    // Step 11: Audit log
    try {
      await supabase.from("qa_logs_auditoria").insert({
        usuario_id: user_id || null,
        entidade: "qa_documentos_conhecimento",
        entidade_id: doc.id,
        acao: "ingestao_concluida",
        detalhes_json: { chunks_criados: chunks.length, tamanho_texto: textoExtraido.length, extractionMethod },
      });
    } catch { /* non-critical */ }

    // Step 12: Trigger embeddings
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
    } catch { /* non-critical */ }
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
