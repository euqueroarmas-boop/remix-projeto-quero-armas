import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DocumentKind = "text" | "pdf" | "docx" | "image" | "unsupported";

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function sanitizeText(text: string): string {
  return text
    .replace(/ /g, "")
    .replace(/\u0000/g, "")
    .replace(/[ --]/g, " ")
    .replace(/�/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFileExtension(name?: string | null): string {
  if (!name || !name.includes(".")) return "";
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function detectDocumentKind(mime: string, fileName?: string | null): DocumentKind {
  const normalizedMime = (mime || "").toLowerCase();
  const extension = getFileExtension(fileName);

  if (normalizedMime.startsWith("text/") || normalizedMime.includes("rtf") || extension === ".txt" || extension === ".rtf") return "text";
  if (normalizedMime.includes("pdf") || extension === ".pdf") return "pdf";
  if (normalizedMime.includes("wordprocessingml.document") || extension === ".docx") return "docx";
  if (normalizedMime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return "image";
  return "unsupported";
}

function isTextValid(text: string, minLen = 30): boolean {
  if (!text || text.length < minLen) return false;
  if (text.trimStart().startsWith("%PDF")) return false;
  const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  if (letters / text.length < 0.12) return false;
  const pdfMarkers = (text.match(/(endobj|endstream|obj|Type|Page|Font|Filter)/g) || []).length;
  if (pdfMarkers > 10) return false;
  return true;
}

async function updateDocStatus(supabase: ReturnType<typeof getSupabase>, docId: string, status: string, extra: Record<string, unknown> = {}) {
  await supabase.from("qa_documentos_conhecimento")
    .update({ status_processamento: status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", docId);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function extractWithVisionApi(rawBytes: Uint8Array, mime: string, prompt: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("No LOVABLE_API_KEY for extraction");
    return "";
  }

  try {
    // Limit to 4MB for the API
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
              { type: "text", text: `${prompt} Retorne APENAS o texto extraído, sem comentários.` },
              { type: "image_url", image_url: { url: `data:${mime || "application/pdf"};base64,${base64}` } },
            ],
          },
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

async function extractDocxSimple(rawBytes: Uint8Array): Promise<string> {
  // Simple DOCX text extraction without heavy libraries
  // DOCX is a ZIP containing XML files - extract text from document.xml
  try {
    const { default: mammoth } = await import("https://esm.sh/mammoth@1.8.0?bundle");
    const { value } = await mammoth.extractRawText({ arrayBuffer: rawBytes.buffer as ArrayBuffer });
    return sanitizeText(value || "");
  } catch (e) {
    console.error("docx extraction failed, falling back to Vision:", e);
    return "";
  }
}

async function audit(supabase: ReturnType<typeof getSupabase>, action: string, docId: string, userId: string | null, details: Record<string, unknown>) {
  try {
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id: userId || null,
      entidade: "qa_documentos_conhecimento",
      entidade_id: docId,
      acao: action,
      detalhes_json: details,
    });
  } catch { /* non-critical */ }
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

  await updateDocStatus(supabase, doc.id, "verificando_arquivo");

  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("qa-documentos")
      .download(storage_path);

    if (dlErr || !fileData) throw new Error("Falha no download do arquivo");

    const rawArrayBuf = await fileData.arrayBuffer();
    const rawBytes = new Uint8Array(rawArrayBuf);
    const mime = doc.mime_type || "";
    const documentKind = detectDocumentKind(mime, doc.nome_arquivo || storage_path);

    let textoExtraido = "";
    let extractionMethod = "none";

    console.log(`Processing ${doc.id}: kind=${documentKind}, mime=${mime}, size=${rawBytes.length}`);

    if (documentKind === "text") {
      await updateDocStatus(supabase, doc.id, "extraindo_texto");
      textoExtraido = sanitizeText(new TextDecoder().decode(rawBytes));
      extractionMethod = "text-decode";

    } else if (documentKind === "docx") {
      await updateDocStatus(supabase, doc.id, "extraindo_texto");
      textoExtraido = await extractDocxSimple(rawBytes);
      if (!isTextValid(textoExtraido)) {
        await updateDocStatus(supabase, doc.id, "rodando_ocr");
        textoExtraido = await extractWithVisionApi(rawBytes, mime || "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Extraia todo o texto legível deste documento.");
        extractionMethod = textoExtraido === "__402__" ? "vision-402" : "vision-docx";
      } else {
        extractionMethod = "docx-mammoth";
      }

    } else if (documentKind === "image") {
      await updateDocStatus(supabase, doc.id, "rodando_ocr");
      textoExtraido = await extractWithVisionApi(rawBytes, mime || "image/jpeg", "Extraia todo o texto legível desta imagem.");
      extractionMethod = textoExtraido === "__402__" ? "vision-402" : "vision-image-ocr";

    } else if (documentKind === "pdf") {
      // Use Vision API directly - unpdf causes CPU Time exceeded in edge functions
      await updateDocStatus(supabase, doc.id, "rodando_ocr");
      console.log(`PDF ${doc.id}: using Vision API directly (${rawBytes.length} bytes)`);
      textoExtraido = await extractWithVisionApi(rawBytes, "application/pdf", "Extraia todo o texto legível deste documento PDF. Capture todos os campos, números, datas e informações relevantes.");
      extractionMethod = textoExtraido === "__402__" ? "vision-402" : "vision-pdf";

    } else {
      extractionMethod = "unsupported-format";
    }

    // Clean up __402__ marker
    if (textoExtraido === "__402__") textoExtraido = "";

    if (textoExtraido.length > 200000) {
      textoExtraido = textoExtraido.substring(0, 200000);
    }

    if (!isTextValid(textoExtraido)) {
      const failReason = extractionMethod.includes("402")
        ? "OCR por IA indisponível (saldo insuficiente). Reprocesse quando o saldo for recarregado."
        : extractionMethod === "unsupported-format"
        ? "Formato não suportado. Envie em PDF, DOCX, TXT, PNG, JPG ou WEBP."
        : "Texto extraído é ilegível ou insuficiente para uso jurídico.";

      await updateDocStatus(supabase, doc.id, "texto_invalido", {
        resumo_extraido: failReason,
        texto_extraido: null,
        metodo_extracao: extractionMethod,
      });
      await audit(supabase, "ingestao_texto_invalido", doc.id, user_id, { extractionMethod, textLength: textoExtraido.length, documentKind });
      return;
    }

    let hashHex = "";
    try {
      const hashBuffer = await crypto.subtle.digest("SHA-256", rawArrayBuf);
      hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch { hashHex = "hash_unavailable"; }

    await updateDocStatus(supabase, doc.id, "gerando_resumo", {
      texto_extraido: textoExtraido,
      hash_arquivo: hashHex,
      metodo_extracao: extractionMethod,
    });

    // Summary + chunking in parallel
    const resumoPromise = (async () => {
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
              { role: "user", content: textoExtraido.substring(0, 3000) },
            ],
            max_tokens: 250,
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          return aiData.choices?.[0]?.message?.content || "Resumo sem conteúdo.";
        }
        return `Resumo indisponível (erro ${aiResp.status}).`;
      } catch { return "Resumo indisponível (erro de conexão)."; }
    })();

    await updateDocStatus(supabase, doc.id, "criando_chunks");
    await supabase.from("qa_chunks_conhecimento").delete().eq("documento_id", doc.id);

    const CHUNK_SIZE = 800, OVERLAP = 150;
    const chunks: string[] = [];
    let pos = 0;
    while (pos < textoExtraido.length) {
      chunks.push(textoExtraido.substring(pos, pos + CHUNK_SIZE));
      pos += CHUNK_SIZE - OVERLAP;
    }
    if (chunks.length === 0) chunks.push(textoExtraido);

    const chunkInserts = chunks.map((texto, i) => ({
      documento_id: doc.id,
      ordem_chunk: i,
      texto_chunk: texto,
      embedding_status: "pendente",
    }));

    const { error: chunkErr } = await supabase.from("qa_chunks_conhecimento").insert(chunkInserts);
    if (chunkErr) {
      console.error("Chunk insert error:", chunkErr.message);
      let ok = 0;
      for (const c of chunkInserts) {
        const { error } = await supabase.from("qa_chunks_conhecimento").insert(c);
        if (!error) ok++;
      }
      console.log(`Fallback: ${ok}/${chunkInserts.length} chunks`);
    }

    const resumo = await resumoPromise;

    await updateDocStatus(supabase, doc.id, "gerando_embeddings", { resumo_extraido: resumo });

    await audit(supabase, "ingestao_concluida", doc.id, user_id, {
      chunks_criados: chunks.length,
      tamanho_texto: textoExtraido.length,
      extractionMethod,
      documentKind,
    });

    // Trigger embeddings
    try {
      const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-generate-embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ documento_id: doc.id }),
      });
      console.log("Embeddings trigger:", resp.status);
    } catch { console.log("Embeddings will be retried separately"); }

    await updateDocStatus(supabase, doc.id, "concluido", { resumo_extraido: resumo });
    console.log(`Document ${doc.id} completed: method=${extractionMethod}, chunks=${chunks.length}`);

  } catch (err: any) {
    console.error("Processing failed for", doc.id, ":", err.message);
    await updateDocStatus(supabase, doc.id, "erro", { resumo_extraido: `Erro: ${err.message}` });
    await audit(supabase, "ingestao_erro", doc.id, user_id, { erro: err.message });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { storage_path, user_id } = await req.json();
    if (!storage_path) {
      return new Response(JSON.stringify({ error: "storage_path required" }), {
        status: 400,
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    (globalThis as any).EdgeRuntime?.waitUntil(processDocument(storage_path, user_id));

    return new Response(JSON.stringify({ success: true, message: "Processamento iniciado" }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
