// Watcher recorrente: detecta IATs sem coordenada e geocodifica em lote pequeno.
// Reusa o geocode estruturado de _shared/geocode.ts (mesmo do driver de backfill).
// Idempotente: ignora quem já tem lat/lng ou foi marcado como falha definitiva.
// Após MAX_TENTATIVAS=3 falhas consecutivas, marca geocode_falhou=true.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeEnderecoMeta, nominatimDelay } from "../_shared/geocode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TENTATIVAS = 3;
const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase: any = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: pendentes, error } = await supabase
      .from("qa_iat_credenciados")
      .select("id, uf, endereco, geocode_tentativas")
      .is("lat", null)
      .or("geocode_falhou.is.null,geocode_falhou.eq.false")
      .lt("geocode_tentativas", MAX_TENTATIVAS)
      .not("endereco", "is", null)
      .neq("endereco", "")
      .order("geocode_tentativas", { ascending: true })
      .order("id")
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    const rows = pendentes || [];
    let ok = 0, fail = 0, marcadosFalha = 0;

    for (const r of rows) {
      const tentativas = (r.geocode_tentativas ?? 0) + 1;
      try {
        const meta = await geocodeEnderecoMeta(supabase, r.endereco, r.uf);
        if (meta.result) {
          await supabase.from("qa_iat_credenciados")
            .update({
              lat: meta.result.lat,
              lng: meta.result.lng,
              geocode_falhou: false,
              geocode_tentativas: tentativas,
            })
            .eq("id", r.id);
          ok++;
        } else {
          const atingiuLimite = tentativas >= MAX_TENTATIVAS;
          await supabase.from("qa_iat_credenciados")
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
        await supabase.from("qa_iat_credenciados")
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

    const { count: restantes } = await supabase
      .from("qa_iat_credenciados")
      .select("id", { count: "exact", head: true })
      .is("lat", null)
      .or("geocode_falhou.is.null,geocode_falhou.eq.false")
      .lt("geocode_tentativas", MAX_TENTATIVAS)
      .not("endereco", "is", null)
      .neq("endereco", "");

    await supabase.from("qa_iat_credenciados_sync_log").insert({
      uf: "ALL",
      status: "geocode_watcher",
      total: ok,
      mensagem: `varridos=${rows.length} ok=${ok} fail=${fail} marcados_falha=${marcadosFalha} restantes=${restantes ?? 0}`,
      com_endereco: true,
    });

    return new Response(JSON.stringify({
      ok: true,
      varridos: rows.length,
      resolvidos: ok,
      falhas: fail,
      marcados_falha_definitiva: marcadosFalha,
      pendentes: restantes ?? 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ erro: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});