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

/**
 * POST body:
 * {
 *   bootstrap_token: string (must match BOOTSTRAP_TOKEN env),
 *   normas?: [{ id, texto_integral }],
 *   anexos?: [{ titulo, descricao, categoria, texto, fonte_norma_id?, fname, mime_type }]
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const body = await req.json();
    const expected = Deno.env.get("BOOTSTRAP_TOKEN") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!body?.bootstrap_token || body.bootstrap_token !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const supabase = sb();
    const result: any = { normas_atualizadas: [], documentos_criados: [], errors: [] };

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