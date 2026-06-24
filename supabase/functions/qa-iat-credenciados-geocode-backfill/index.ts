// Geocodifica em lote os IATs (instrutores) com endereço mas sem lat/lng.
// Reaproveita o geocode estruturado de _shared/geocode.ts (com validação de cidade).
//
// Chamada:
//   POST {}                            -> 1 lote (default batchSize=15)
//   POST {"loop": true}                -> continua se auto-invocando até esgotar
//   POST {"batchSize": 20, "uf":"SP"}  -> restringe por UF
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeEndereco, nominatimDelay } from "../_shared/geocode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function processarLote(supabase: any, batchSize: number, uf?: string) {
  let q = supabase
    .from("qa_iat_credenciados")
    .select("id, uf, endereco")
    .is("lat", null)
    .not("endereco", "is", null)
    .neq("endereco", "")
    .order("id")
    .limit(batchSize);
  if (uf) q = q.eq("uf", uf);
  const { data: pendentes, error } = await q;
  if (error) throw new Error(error.message);
  const rows = pendentes || [];
  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const g = await geocodeEndereco(supabase, r.endereco, r.uf);
      if (g) {
        await supabase.from("qa_iat_credenciados")
          .update({ lat: g.lat, lng: g.lng })
          .eq("id", r.id);
        ok++;
      } else {
        // Marca lat=0 ainda não — preferimos deixar null e confiar no cache para
        // não reconsultar; o cache impede o loop infinito da próxima chamada.
        fail++;
      }
    } catch (_e) {
      fail++;
    }
    await nominatimDelay();
  }
  // Quantos ainda restam (mesmo filtro) — usado para o loop e para o log.
  let q2 = supabase
    .from("qa_iat_credenciados")
    .select("id", { count: "exact", head: true })
    .is("lat", null)
    .not("endereco", "is", null)
    .neq("endereco", "");
  if (uf) q2 = q2.eq("uf", uf);
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

    const res = await processarLote(supabase, batchSize, uf);
    await supabase.from("qa_iat_credenciados_sync_log").insert({
      uf: uf || "ALL",
      status: "geocode_backfill",
      total: res.ok,
      mensagem: `lote=${res.processados} ok=${res.ok} fail=${res.fail} restantes=${res.restantes}`,
      com_endereco: true,
    });

    // Encadeia o próximo lote sem aguardar (fire-and-forget) para não estourar o timeout.
    if (loop && res.restantes > 0) {
      const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-iat-credenciados-geocode-backfill`;
      const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
      fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ batchSize, loop: true, uf }),
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