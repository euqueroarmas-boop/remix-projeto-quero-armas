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
  return text
    .replace(/\0/g, "")
    .replace(/\\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTextValid(text: string): boolean {
  if (!text || text.length < 30) return false;
  if (text.trimStart().startsWith("%PDF")) return false;
  const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  const ratio = letters / text.length;
  if (ratio < 0.2) return false;
  return true;
}

function stripHtmlToText(html: string): string {
  // Remove script/style blocks
  let clean = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, "");
  clean = clean.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  clean = clean.replace(/<header[\s\S]*?<\/header>/gi, "");
  clean = clean.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  clean = clean.replace(/<aside[\s\S]*?<\/aside>/gi, "");
  // Remove HTML tags
  clean = clean.replace(/<[^>]+>/g, " ");
  // Decode common entities
  clean = clean.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í").replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú").replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ").replace(/&ccedil;/gi, "ç")
    .replace(/&#\d+;/g, " ");
  return sanitizeText(clean);
}

async function updateStatus(supabase: any, doc_id: string, status: string) {
  await supabase.from("qa_documentos_conhecimento")
    .update({ status_processamento: status, updated_at: new Date().toISOString() })
    .eq("id", doc_id);
}

async function processUrl(url: string, titulo: string, tipo_documento: string, user_id: string, doc_id: string) {
  const supabase = getSupabase();

  await updateStatus(supabase, doc_id, "acessando_url");

  try {
    // Fetch URL
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QueroArmasBot/1.0)" },
      redirect: "follow",
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

    const contentType = resp.headers.get("content-type") || "";
    let textoExtraido = "";
    let metodoExtracao = "none";
    let mimeDetected = "text/html";

    if (contentType.includes("application/pdf")) {
      // PDF from URL
      mimeDetected = "application/pdf";
      const { extractText } = await import("https://esm.sh/unpdf@0.12.1");
      const rawBuf = await resp.arrayBuffer();
      const rawBytes = new Uint8Array(rawBuf);

      try {
        const { text } = await extractText(new Uint8Array(rawBytes), { mergePages: true });
        textoExtraido = sanitizeText(text);
        metodoExtracao = "unpdf-native";
      } catch {
        metodoExtracao = "pdf-failed";
      }

      // Vision fallback for scanned PDFs
      if (!isTextValid(textoExtraido)) {
        const apiKey = Deno.env.get("LOVABLE_API_KEY");
        if (apiKey) {
          try {
            const limitedBytes = rawBytes.slice(0, 4_000_000);
            const binary = Array.from(limitedBytes).map(b => String.fromCharCode(b)).join("");
            const base64 = btoa(binary);

            const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{
                  role: "user",
                  content: [
                    { type: "text", text: "Extraia todo o texto deste documento PDF. Retorne APENAS o texto extraído, sem comentários." },
                    { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } }
                  ]
                }],
                max_tokens: 8000,
              }),
            });

            if (visionResp.ok) {
              const vData = await visionResp.json();
              const vText = sanitizeText(vData.choices?.[0]?.message?.content || "");
              if (isTextValid(vText)) {
                textoExtraido = vText;
                metodoExtracao = "vision-ocr";
              }
            }
          } catch (e) {
            console.error("Vision fallback failed:", e);
          }
        }
      }
    } else {
      // HTML or text content
      const rawText = await resp.text();

      if (contentType.includes("text/plain") || contentType.includes("text/rtf")) {
        textoExtraido = sanitizeText(rawText);
        metodoExtracao = "text-plain";
        mimeDetected = "text/plain";
      } else {
        // HTML — extract text content
        textoExtraido = stripHtmlToText(rawText);
        metodoExtracao = "html-strip";
        mimeDetected = "text/html";
      }
    }

    await updateStatus(supabase, doc_id, "extraindo_texto");

    // Hard cap
    if (textoExtraido.length > 200000) {
      textoExtraido = textoExtraido.substring(0, 200000);
    }

    if (!isTextValid(textoExtraido)) {
      await supabase.from("qa_documentos_conhecimento")
        .update({
          status_processamento: "texto_invalido",
          resumo_extraido: "Texto extraído da URL é ilegível ou insuficiente.",
          metodo_extracao: metodoExtracao,
          mime_type: mimeDetected,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc_id);

      await supabase.from("qa_logs_auditoria").insert({
        usuario_id: user_id || null,
        entidade: "qa_documentos_conhecimento",
        entidade_id: doc_id,
        acao: "ingestao_url_texto_invalido",
        detalhes_json: { url, metodoExtracao, textLength: textoExtraido.length },
      }).catch(() => {});
      return;
    }

    // Hash
    let hashHex = "";
    try {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(textoExtraido));
      hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch { hashHex = "hash_unavailable"; }

    // Save text
    await supabase.from("qa_documentos_conhecimento")
      .update({
        texto_extraido: textoExtraido,
        hash_arquivo: hashHex,
        mime_type: mimeDetected,
        metodo_extracao: metodoExtracao,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc_id);

    await updateStatus(supabase, doc_id, "gerando_resumo");
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

    await updateStatus(supabase, doc_id, "criando_chunks");
    await supabase.from("qa_chunks_conhecimento").delete().eq("documento_id", doc_id);

    // Chunk text
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

    // Insert chunks
    const chunkInserts = chunks.map((texto, i) => ({
      documento_id: doc_id,
      ordem_chunk: i,
      texto_chunk: texto,
      embedding_status: "pendente",
    }));

    const { error: chunkErr } = await supabase.from("qa_chunks_conhecimento").insert(chunkInserts);
    if (chunkErr) {
      let inserted = 0;
      for (const chunk of chunkInserts) {
        const { error } = await supabase.from("qa_chunks_conhecimento").insert(chunk);
        if (!error) inserted++;
      }
      console.log(`Fallback: inserted ${inserted}/${chunkInserts.length} chunks`);
    }

    // Mark complete
    await supabase.from("qa_documentos_conhecimento")
      .update({
        resumo_extraido: resumo,
        status_processamento: "concluido",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc_id);

    console.log(`URL doc ${doc_id} processed OK (${metodoExtracao}): ${chunks.length} chunks, ${textoExtraido.length} chars`);

    // Audit log
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id: user_id || null,
      entidade: "qa_documentos_conhecimento",
      entidade_id: doc_id,
      acao: "ingestao_url_concluida",
      detalhes_json: { url, chunks_criados: chunks.length, tamanho_texto: textoExtraido.length, metodoExtracao },
    }).catch(() => {});

    await updateStatus(supabase, doc_id, "gerando_embeddings");
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-generate-embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ documento_id: doc_id }),
      });
    } catch {
      console.log("Embeddings will be retried separately");
    }

  } catch (err) {
    console.error("URL processing failed:", err.message);
    await supabase.from("qa_documentos_conhecimento")
      .update({
        status_processamento: "erro",
        resumo_extraido: `Erro: ${err.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc_id);

    await supabase.from("qa_logs_auditoria").insert({
      usuario_id: user_id || null,
      entidade: "qa_documentos_conhecimento",
      entidade_id: doc_id,
      acao: "ingestao_url_erro",
      detalhes_json: { url, erro: err.message },
    }).catch(() => {});
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { url, titulo, tipo_documento, user_id } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Validate URL
    try { new URL(url); } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // Create document record
    const docTitle = titulo || new URL(url).pathname.split("/").pop() || "Documento importado por link";
    const { data: newDoc, error: insertErr } = await supabase.from("qa_documentos_conhecimento")
      .insert({
        titulo: docTitle,
        nome_arquivo: url,
        storage_path: `link/${Date.now()}_${encodeURIComponent(new URL(url).hostname)}`,
        mime_type: "text/html",
        tamanho_bytes: null,
        enviado_por: user_id || null,
        tipo_documento: tipo_documento || "outro",
        status_processamento: "pendente",
        status_validacao: "nao_validado",
        url_origem: url,
        tipo_origem: "link_publico",
      })
      .select("id")
      .single();

    if (insertErr) throw new Error(insertErr.message);

    EdgeRuntime.waitUntil(processUrl(url, docTitle, tipo_documento || "outro", user_id || "", newDoc.id));

    return new Response(JSON.stringify({
      success: true,
      doc_id: newDoc.id,
      message: "Importação iniciada em background",
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
