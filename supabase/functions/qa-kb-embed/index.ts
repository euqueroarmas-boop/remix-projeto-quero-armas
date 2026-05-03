import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function embed(text: string): Promise<number[] | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/text-embedding-004", input: text.slice(0, 8000) }),
  });
  if (!r.ok) {
    console.error("embed fail", r.status, await r.text());
    return null;
  }
  const j = await r.json();
  return j?.data?.[0]?.embedding ?? null;
}

/**
 * Modos:
 *  - { article_id }          → gera embedding daquele artigo
 *  - { backfill: true }      → processa todos artigos sem embedding (limit 20)
 *  - { query: "texto" }      → retorna embedding pronto para busca client-side
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (body.query) {
      const v = await embed(String(body.query));
      return new Response(JSON.stringify({ embedding: v }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let ids: string[] = [];
    if (body.article_id) {
      ids = [String(body.article_id)];
    } else if (body.backfill) {
      const { data } = await supabase
        .from("qa_kb_artigos")
        .select("id")
        .is("embedding", null)
        .limit(20);
      ids = (data ?? []).map((x: any) => x.id);
    } else {
      return new Response(JSON.stringify({ error: "Informe article_id, backfill ou query" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;
    for (const id of ids) {
      const { data: a } = await supabase
        .from("qa_kb_artigos")
        .select("title,module,category,tags,symptoms,body")
        .eq("id", id)
        .maybeSingle();
      if (!a) { failed++; continue; }
      const text = [
        a.title,
        a.category, a.module ?? "",
        (a.tags ?? []).join(", "),
        (a.symptoms ?? []).join(". "),
        a.body,
      ].join("\n");
      const v = await embed(text);
      if (!v) { failed++; continue; }
      const { error } = await supabase
        .from("qa_kb_artigos")
        .update({ embedding: v as any })
        .eq("id", id);
      if (error) { console.error("update fail", error); failed++; } else processed++;
    }

    return new Response(JSON.stringify({ processed, failed, total: ids.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("qa-kb-embed error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});