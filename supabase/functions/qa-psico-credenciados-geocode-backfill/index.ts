// Geocodifica em lote os psicólogos com endereço mas sem latitude/longitude.
// Marca geocode_falhou=true só após MAX_TENTATIVAS, para não condenar uma falha
// transitória do Nominatim. Espelha o backfill do IAT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeEnderecoMeta, nominatimDelay } from "../_shared/geocode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_TENTATIVAS = 3;

async function processarLote(supabase: any, batchSize: number, uf?: string) {
  let q = supabase
    .from("qa_psico_credenciados")
    .select("id, uf, endereco, geocode_tentativas")
    .is("latitude", null)
    .or("geocode_falhou.is.null,geocode_falhou.eq.false")
    .lt("geocode_tentativas", MAX_TENTATIVAS)
    .not("endereco", "is", null)
    .neq("endereco", "")
    .order("geocode_tentativas", { ascending: true })
    .order("id")
    .limit(batchSize);
  if (uf) q = q.eq("uf", uf);
  const { data: pendentes, error } = await q;
  if (error) throw new Error(error.message);

  const rows = pendentes || [];
  let ok = 0, fail = 0;
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
        const atingiuLimite = tentativas >= MAX_TENTATIVAS;
        await supabase.from("qa_psico_credenciados")
          .update({ geocode_tentativas: tentativas, geocode_falhou: atingiuLimite })
          .eq("id", r.id);
        fail++;
      }
      if (meta.hitNetwork) await nominatimDelay();
    } catch (_e) {
      const atingiuLimite = tentativas >= MAX_TENTATIVAS;
      await supabase.from("qa_psico_credenciados")
        .update({ geocode_tentativas: tentativas, geocode_falhou: atingiuLimite })
        .eq("id", r.id);
      fail++;
      await nominatimDelay();
    }
  }

  let q2 = supabase
    .from("qa_psico_credenciados")
    .select("id", { count: "exact", head: true })
    .is("latitude", null)
    .or("geocode_falhou.is.null,geocode_falhou.eq.false")
    .lt("geocode_tentativas", MAX_TENTATIVAS)
    .not("endereco", "is", null)
    .neq("endereco", "");
  if (uf) q2 = q2.eq("uf", uf);
  const { count: restantes } = await q2;
  return { processados: rows.length, ok, fail, restantes: restantes ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let body: any = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const batchSize = Math.min(Number(body?.batchSize) || 15, 50);
  const uf = body?.uf ? String(body.uf).toUpperCase() : undefined;
  const loop = Boolean(body?.loop);
  try {
    const res = await processarLote(supabase, batchSize, uf);
    // Encadeia o próximo lote sem aguardar para não estourar o timeout (espelha o IAT).
    if (loop && res.restantes > 0) {
      const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-psico-credenciados-geocode-backfill`;
      const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
      fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ batchSize, loop: true, uf }),
      }).catch(() => {});
    }
    return new Response(JSON.stringify(res), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
