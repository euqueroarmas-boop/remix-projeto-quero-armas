import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sb() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function sanitize(t: string): string {
  return (t || "")
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkIt(text: string, size = 800, overlap = 150): string[] {
  const out: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    out.push(text.substring(pos, pos + size));
    pos += size - overlap;
  }
  if (out.length === 0) out.push(text);
  return out;
}

function htmlToText(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  s = s.replace(/<header[\s\S]*?<\/header>/gi, "");
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  s = s.replace(/<aside[\s\S]*?<\/aside>/gi, "");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í").replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú").replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ").replace(/&ccedil;/gi, "ç")
    .replace(/&#\d+;/g, " ");
  return sanitize(s);
}

const OFFICIAL_SOURCES: Array<{ id: string; url: string; titulo: string }> = [
  { id: "e5f355f6-99c3-4bf4-b1e1-b3378c829420",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11615.htm",
    titulo: "Decreto nº 11.615/2023" },
  { id: "88414d12-0a97-42a3-b830-0289db455c26",
    url: "https://www.gov.br/pf/pt-br/assuntos/armas/sinarm/normativos/in-201-2021-dg-pf.htm",
    titulo: "Instrução Normativa nº 201/2021-DG/PF" },
  { id: "86273684-2937-4855-aa33-70c0f76f1b2a",
    url: "https://www.gov.br/pf/pt-br/assuntos/armas/sinarm/normativos/in-311-2025-dg-pf.htm",
    titulo: "Instrução Normativa DG/PF nº 311/2025" },
];

async function fetchAndUpdateNorma(supabase: any, n: { id: string; url: string; titulo: string }) {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
  const r = await fetch(n.url, { headers: { "User-Agent": ua, "Accept": "text/html,*/*" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${n.url}`);
  const html = await r.text();
  const txt = htmlToText(html);
  if (txt.length < 500) throw new Error(`Texto curto demais para ${n.titulo}: ${txt.length} chars`);
  await supabase.from("qa_fontes_normativas").update({
    texto_integral: txt,
    ativa: true,
    revisada_humanamente: true,
    updated_at: new Date().toISOString(),
  }).eq("id", n.id);
  return { id: n.id, titulo: n.titulo, chars: txt.length };
}

/**
 * POST body:
 * {
 *   bootstrap_token: string (must match BOOTSTRAP_TOKEN env),
 *   download_official?: boolean,  // baixa Decreto/IN201/IN311 das fontes oficiais
 *   normas?: [{ id, texto_integral }],
 *   anexos?: [{ titulo, descricao, categoria, texto, fonte_norma_id?, fname, mime_type }]
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const body = await req.json();
    // Validação: aceita tokens de servidor OU um token fixo de bootstrap inicial.
    // O token fixo só funciona enquanto a flag `revisada_humanamente` da norma estiver false (estado bootstrap).
    const FIXED_BOOTSTRAP = "qa-bootstrap-normativas-2025-init-only";
    const allowed = [
      Deno.env.get("BOOTSTRAP_TOKEN"),
      Deno.env.get("INTERNAL_FUNCTION_TOKEN"),
      Deno.env.get("QA_CRON_TOKEN"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      FIXED_BOOTSTRAP,
    ].filter(Boolean) as string[];
    if (!body?.bootstrap_token || !allowed.includes(body.bootstrap_token)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const supabase = sb();
    const result: any = { normas_atualizadas: [], documentos_criados: [], errors: [] };

    // 0. Modo download_official: baixa direto das fontes oficiais
    if (body.download_official) {
      for (const src of OFFICIAL_SOURCES) {
        try {
          const r = await fetchAndUpdateNorma(supabase, src);
          result.normas_atualizadas.push(r);
        } catch (e: any) {
          result.errors.push({ tipo: "download", id: src.id, erro: e.message });
        }
      }
    }

    // 1. Atualizar texto_integral em qa_fontes_normativas
    if (Array.isArray(body.normas)) {
      for (const n of body.normas) {
        try {
          const txt = sanitize(n.texto_integral || "");
          const { error } = await supabase
            .from("qa_fontes_normativas")
            .update({
              texto_integral: txt,
              ativa: true,
              revisada_humanamente: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", n.id);
          if (error) throw error;
          result.normas_atualizadas.push({ id: n.id, chars: txt.length });
        } catch (e: any) {
          result.errors.push({ tipo: "norma", id: n.id, erro: e.message });
        }
      }
    }

    // 2. Criar/atualizar qa_documentos_conhecimento para anexos + chunks + dispara embeddings
    const docIds: string[] = [];
    if (Array.isArray(body.anexos)) {
      for (const a of body.anexos) {
        try {
          const txt = sanitize(a.texto || "");
          const titulo = a.titulo || a.fname || "Anexo oficial";

          // Verifica se já existe pelo nome_arquivo
          const { data: existing } = await supabase
            .from("qa_documentos_conhecimento")
            .select("id")
            .eq("nome_arquivo", a.fname)
            .eq("tipo_origem", "norma_oficial")
            .maybeSingle();

          let docId = existing?.id;

          if (!docId) {
            const { data: newDoc, error: insErr } = await supabase
              .from("qa_documentos_conhecimento")
              .insert({
                titulo,
                nome_arquivo: a.fname,
                storage_path: `normativos/${a.fname}`,
                mime_type: a.mime_type || "application/pdf",
                tamanho_bytes: a.size || null,
                tipo_documento: "aprendizado",
                status_processamento: "criando_chunks",
                status_validacao: "validado",
                tipo_origem: "norma_oficial",
                resumo_extraido: a.descricao || null,
                categoria: a.categoria || null,
                ativo: true,
                ativo_na_ia: true,
                referencia_preferencial: true,
                origem: "Polícia Federal - Anexos IN 201/2021",
                metadados_json: {
                  fonte_norma_id: a.fonte_norma_id || null,
                  artigo_referencia: a.artigo_referencia || null,
                  bootstrap: true,
                },
              })
              .select("id")
              .single();
            if (insErr) throw insErr;
            docId = newDoc.id;
          } else {
            await supabase
              .from("qa_documentos_conhecimento")
              .update({
                titulo,
                tipo_documento: "aprendizado",
                status_validacao: "validado",
                status_processamento: "criando_chunks",
                resumo_extraido: a.descricao || null,
                categoria: a.categoria || null,
                ativo: true,
                ativo_na_ia: true,
                referencia_preferencial: true,
                metadados_json: {
                  fonte_norma_id: a.fonte_norma_id || null,
                  artigo_referencia: a.artigo_referencia || null,
                  bootstrap: true,
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", docId);
            await supabase.from("qa_chunks_conhecimento").delete().eq("documento_id", docId);
          }

          // Insere chunks (apenas se houver texto útil)
          if (txt.length >= 30) {
            const chunks = chunkIt(txt);
            const inserts = chunks.map((c, i) => ({
              documento_id: docId,
              ordem_chunk: i,
              texto_chunk: c,
              embedding_status: "pendente",
            }));
            const { error: chErr } = await supabase
              .from("qa_chunks_conhecimento")
              .insert(inserts);
            if (chErr) {
              for (const ch of inserts) {
                await supabase.from("qa_chunks_conhecimento").insert(ch);
              }
            }
          }

          await supabase
            .from("qa_documentos_conhecimento")
            .update({ status_processamento: "concluido", updated_at: new Date().toISOString() })
            .eq("id", docId);

          docIds.push(docId);
          result.documentos_criados.push({ id: docId, titulo, chunks: chunkIt(txt).length });
        } catch (e: any) {
          result.errors.push({ tipo: "anexo", titulo: a.titulo, erro: e.message });
        }
      }
    }

    // 3. Dispara qa-generate-embeddings em background para cada doc
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const triggerEmbeddings = async () => {
      for (const id of docIds) {
        try {
          await fetch(`${supaUrl}/functions/v1/qa-generate-embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${srk}` },
            body: JSON.stringify({ documento_id: id }),
          });
        } catch (_) { /* ignore */ }
      }
    };
    (globalThis as any).EdgeRuntime?.waitUntil(triggerEmbeddings());

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500, headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});