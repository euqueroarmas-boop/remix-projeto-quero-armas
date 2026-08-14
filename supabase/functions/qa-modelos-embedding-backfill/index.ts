// ============================================================================
// qa-modelos-embedding-backfill
// ----------------------------------------------------------------------------
// Gera o embedding dos modelos aprovados que estao com `embedding_texto` nulo.
//
// Contexto: ate 14/08/2026 as funcoes de treino chamavam um endpoint de
// embeddings que nao existe no gateway, e engoliam a falha. Os modelos foram
// gravados com o texto normalizado correto, mas sem embedding — 20 de 20. Este
// backfill reaproveita `texto_ocr_normalizado`, que ja esta no banco: nao
// re-baixa PDF nem refaz OCR.
//
// Reexecutavel: so toca linha com embedding_texto IS NULL.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { gerarEmbedding, explicarFalhaEmbedding, EMBEDDING_DIMENSOES } from "../_shared/embedding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await (await import("../_shared/qaAuth.ts")).requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { limite } = await req.json().catch(() => ({ limite: undefined }));
    const max = Math.min(Number(limite) || 50, 200);

    const { data: pendentes, error: selErr } = await supabase
      .from("qa_documentos_modelos_aprovados")
      .select("id, nome_modelo, tipo_documento, texto_ocr_normalizado")
      .is("embedding_texto", null)
      .limit(max);
    if (selErr) return json({ error: selErr.message }, 500);

    const alvos = pendentes ?? [];
    if (alvos.length === 0) {
      return json({ ok: true, dimensoes: EMBEDDING_DIMENSOES, pendentes: 0, gerados: 0, falhas: [] });
    }

    let gerados = 0;
    const falhas: Array<{ id: string; nome: string | null; motivo: string }> = [];

    for (const m of alvos) {
      const texto = String(m.texto_ocr_normalizado ?? "");
      const emb = await gerarEmbedding(texto);

      if (!emb.ok) {
        falhas.push({ id: m.id, nome: m.nome_modelo, motivo: explicarFalhaEmbedding(emb.motivo) });
        continue;
      }

      const { error: updErr } = await supabase
        .from("qa_documentos_modelos_aprovados")
        .update({ embedding_texto: emb.vetor as unknown as string })
        .eq("id", m.id);

      if (updErr) {
        falhas.push({ id: m.id, nome: m.nome_modelo, motivo: updErr.message });
        continue;
      }
      gerados++;
    }

    return json({
      ok: true,
      dimensoes: EMBEDDING_DIMENSOES,
      pendentes: alvos.length,
      gerados,
      falhas,
    });
  } catch (e) {
    console.error("[modelos-embedding-backfill] erro:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
