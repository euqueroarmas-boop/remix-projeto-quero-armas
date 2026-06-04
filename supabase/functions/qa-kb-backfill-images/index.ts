import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { action = "backfill" } = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ===== AÇÃO: aprovar em lote drafts de imagens REAIS (nunca IA) =====
    if (action === "approve_drafts") {
      const { data: arts } = await supabase
        .from("qa_kb_artigos").select("id").eq("status", "published");
      const ids = ((arts ?? []) as any[]).map(a => a.id);
      if (ids.length === 0) {
        return new Response(JSON.stringify({ approved: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { data: upd, error } = await supabase
        .from("qa_kb_artigo_imagens")
        .update({ status: "approved" })
        .eq("status", "draft")
        .in("article_id", ids)
        .in("image_type", ["screenshot_real", "upload_manual", "documento_real", "auditoria_real"])
        .select("id");
      if (error) throw error;
      return new Response(JSON.stringify({ approved: (upd ?? []).length }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Qualquer outra ação (backfill / retry_errors) envolveria gerar imagens por IA
    // e está PROIBIDA por regra de negócio.
    return new Response(JSON.stringify({
      error: "Geração/backfill de imagens por IA está proibido. Use apenas imagens reais auditáveis (screenshot, upload manual, documento real).",
      code: "AI_IMAGE_GENERATION_DISABLED",
    }), {
      status: 410,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});