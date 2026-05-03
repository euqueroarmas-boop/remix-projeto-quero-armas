import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { limit = 5, only_missing = true } = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: arts } = await supabase
      .from("qa_kb_artigos").select("id,audience,status").eq("status", "published");
    const list = (arts ?? []) as Array<{ id: string; audience: string; status: string }>;

    const targets: typeof list = [];
    for (const a of list) {
      if (only_missing) {
        const { count } = await supabase
          .from("qa_kb_artigo_imagens").select("id", { count: "exact", head: true })
          .eq("article_id", a.id).in("status", ["draft", "approved"]);
        if ((count ?? 0) > 0) continue;
      }
      targets.push(a);
      if (targets.length >= limit) break;
    }

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-kb-generate-article-images`;
    const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    const out: any[] = [];
    for (const t of targets) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ article_id: t.id, approve: t.audience === "cliente" }),
        });
        const j = await r.json().catch(() => ({}));
        out.push({ id: t.id, ok: r.ok, ...j });
      } catch (e) {
        out.push({ id: t.id, ok: false, error: e instanceof Error ? e.message : "erro" });
      }
    }
    return new Response(JSON.stringify({ processed: out.length, results: out }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});