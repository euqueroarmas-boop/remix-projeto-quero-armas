// Geocodifica em lote os credenciados PF (psicólogos/instrutores) com endereço
// mas sem latitude/longitude. Reaproveita o geocode estruturado de
// _shared/geocode.ts (com validação de cidade) para evitar "cair na capital".
//
// POST {}                            -> 1 lote (default batchSize=15)
// POST {"loop": true}                -> auto-invoca até esgotar
// POST {"batchSize": 20, "uf":"SP"}  -> restringe por UF
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeEndereco, nominatimDelay } from "../_shared/geocode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function processarLote(supabase: any, batchSize: number, uf?: string, tipo?: string) {
  let q = supabase
    .from("qa_psico_credenciados")
    .select("id, uf, endereco")
    .eq("ativo", true)
    .is("latitude", null)
    .not("endereco", "is", null)
    .neq("endereco", "")
    .ilike("endereco", "%,%")
    .order("id", { ascending: true })
    .limit(batchSize);
  if (uf) q = q.eq("uf", uf);
  if (tipo) q = q.eq("tipo", tipo);
  const { data: pendentes, error } = await q;
  if (error) throw new Error(error.message);
  const rows = pendentes || [];
  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const g = await geocodeEndereco(supabase, r.endereco, r.uf);
      if (g) {
        await supabase.from("qa_psico_credenciados")
          .update({ latitude: g.lat, longitude: g.lng })
          .eq("id", r.id);
        ok++;
      } else {
        // Marca com sentinel (-91, -91) — fora do range válido — para não bloquear
        // a paginação do backfill. A RPC qa_psico_credenciados_proximos só considera
        // pontos dentro do raio, então o sentinel é sempre descartado.
        await supabase.from("qa_psico_credenciados")
          .update({ latitude: -91, longitude: -91 })
          .eq("id", r.id);
        fail++;
      }
    } catch (_e) {
      await supabase.from("qa_psico_credenciados")
        .update({ latitude: -91, longitude: -91 })
        .eq("id", r.id);
      fail++;
    }
    await nominatimDelay();
  }
  let q2 = supabase
    .from("qa_psico_credenciados")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true)
    .is("latitude", null)
    .not("endereco", "is", null)
    .neq("endereco", "");
  if (uf) q2 = q2.eq("uf", uf);
  if (tipo) q2 = q2.eq("tipo", tipo);
  const { count: restantes } = await q2;
  return { processados: rows.length, ok, fail, restantes: restantes ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase: any = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body?.batchSize) || 15, 1), 30);
    const loop = Boolean(body?.loop);
    const uf: string | undefined = body?.uf?.toUpperCase?.() || undefined;
    const tipo: string | undefined = body?.tipo || undefined;

    const res = await processarLote(supabase, batchSize, uf, tipo);

    if (loop && res.restantes > 0) {
      const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-psico-credenciados-geocode-backfill`;
      const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
      fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ batchSize, loop: true, uf, tipo }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, ...res, loop }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ erro: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});