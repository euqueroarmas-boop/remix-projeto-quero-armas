// Geocodifica em lote os credenciados PF (psicólogos/instrutores) com endereço
// mas sem latitude/longitude. Reaproveita o geocode estruturado de
// _shared/geocode.ts (com validação de cidade) para evitar "cair na capital".
//
// POST {}                            -> 1 lote (default batchSize=15)
// POST {"loop": true}                -> auto-invoca até esgotar
// POST {"batchSize": 20, "uf":"SP"}  -> restringe por UF
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeEnderecoMeta, nominatimDelay } from "../_shared/geocode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TENTATIVAS = 3;

async function processarLote(supabase: any, batchSize: number, uf?: string, tipo?: string) {
  let q = supabase
    .from("qa_psico_credenciados")
    .select("id, uf, endereco, geocode_tentativas")
    .eq("ativo", true)
    .is("latitude", null)
    .or("geocode_falhou.is.null,geocode_falhou.eq.false")
    .lt("geocode_tentativas", MAX_TENTATIVAS)
    .not("endereco", "is", null)
    .neq("endereco", "")
    .ilike("endereco", "%,%")
    .order("geocode_tentativas", { ascending: true })
    .order("id", { ascending: true })
    .limit(batchSize);
  if (uf) q = q.eq("uf", uf);
  if (tipo) q = q.eq("tipo", tipo);
  const { data: pendentes, error } = await q;
  if (error) throw new Error(error.message);
  const rows = pendentes || [];
  let ok = 0, fail = 0, marcadosFalha = 0;
  for (const r of rows) {
    const tentativas = (r.geocode_tentativas ?? 0) + 1;
    try {
      const meta = await geocodeEnderecoMeta(supabase, r.endereco, r.uf);
      if (meta.result) {
        await supabase.from("qa_psico_credenciados")
          .update({
            latitude: meta.result.lat,
            longitude: meta.result.lng,
            geocode_falhou: false,
            geocode_tentativas: tentativas,
          })
          .eq("id", r.id);
        ok++;
      } else {
        // Espelha o iat-geocode-watcher: só marca falha permanente após MAX_TENTATIVAS
        // (evita penalizar falha transitória do Nominatim por throttling 1 req/s).
        const atingiuLimite = tentativas >= MAX_TENTATIVAS;
        await supabase.from("qa_psico_credenciados")
          .update({
            geocode_tentativas: tentativas,
            geocode_falhou: atingiuLimite ? true : false,
          })
          .eq("id", r.id);
        fail++;
        if (atingiuLimite) marcadosFalha++;
      }
      if (meta.hitNetwork) await nominatimDelay();
    } catch (_e) {
      const atingiuLimite = tentativas >= MAX_TENTATIVAS;
      await supabase.from("qa_psico_credenciados")
        .update({
          geocode_tentativas: tentativas,
          geocode_falhou: atingiuLimite ? true : false,
        })
        .eq("id", r.id);
      fail++;
      if (atingiuLimite) marcadosFalha++;
      await nominatimDelay();
    }
  }
  let q2 = supabase
    .from("qa_psico_credenciados")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true)
    .is("latitude", null)
    .or("geocode_falhou.is.null,geocode_falhou.eq.false")
    .lt("geocode_tentativas", MAX_TENTATIVAS)
    .not("endereco", "is", null)
    .neq("endereco", "");
  if (uf) q2 = q2.eq("uf", uf);
  if (tipo) q2 = q2.eq("tipo", tipo);
  const { count: restantes } = await q2;
  return { processados: rows.length, ok, fail, marcadosFalha, restantes: restantes ?? 0 };
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