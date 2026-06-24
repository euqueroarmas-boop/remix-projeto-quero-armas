// Consulta credenciados PF por proximidade ao CEP do cliente.
// Lazy-geocoda endereços ainda sem coordenadas (até MAX_GEOCODE por chamada).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeEndereco, nominatimDelay } from "../_shared/geocode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_GEOCODE_PER_CALL = 12; // Nominatim: 1 req/s

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function geocodeCEP(supabase: any, cep: string): Promise<{ lat: number; lng: number; uf: string; cidade: string } | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  // 1. Endereço via BrasilAPI
  let addr: any = null;
  try {
    const { data: cached } = await supabase.from("cep_cache").select("data").eq("cep", digits).maybeSingle();
    addr = cached?.data || null;
    if (!addr) {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
      if (r.ok) {
        addr = await r.json();
        supabase.from("cep_cache").upsert({ cep: digits, data: addr }).then();
      }
    }
  } catch { /* noop */ }
  if (!addr) return null;
  const uf = String(addr.state || "").toUpperCase();
  const cidade = String(addr.city || "");
  if (addr.location?.coordinates?.latitude && addr.location?.coordinates?.longitude) {
    return {
      lat: Number(addr.location.coordinates.latitude),
      lng: Number(addr.location.coordinates.longitude),
      uf, cidade,
    };
  }
  // Fallback estruturado pela cidade — mesmo path do IAT
  const enderecoTxt = `${addr.street || cidade}, ${addr.neighborhood || ""}, ${cidade}/${uf}`;
  const geo = await geocodeEndereco(supabase, enderecoTxt, uf);
  if (geo) return { ...geo, uf, cidade };
  return { lat: 0, lng: 0, uf, cidade };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const tipo: string = body.tipo; // 'psicologo' | 'instrutor_tiro'
    const cep: string = body.cep || "";
    const raio_km: number = Number(body.raio_km) || 50;
    const limit: number = Math.min(Number(body.limit) || 20, 100);
    const incluirVencidos: boolean = Boolean(body.incluir_vencidos);

    if (!tipo || !["psicologo", "instrutor_tiro"].includes(tipo)) return json({ error: "tipo inválido" }, 400);

    const origin = cep ? await geocodeCEP(supabase, cep) : null;
    const ufFiltro: string | null = origin?.uf || body.uf || null;

    // Lazy geocode: pega até MAX_GEOCODE entradas sem coordenadas, da mesma UF do cliente
    if (ufFiltro) {
      const { data: pendentes } = await supabase
        .from("qa_psico_credenciados")
        .select("id,endereco,uf")
        .eq("tipo", tipo).eq("uf", ufFiltro).eq("ativo", true)
        .is("latitude", null).not("endereco", "is", null)
        .limit(MAX_GEOCODE_PER_CALL);
      for (const e of pendentes || []) {
        const g = await geocodeEndereco(supabase, e.endereco, e.uf);
        if (g) await supabase.from("qa_psico_credenciados").update({ latitude: g.lat, longitude: g.lng }).eq("id", e.id);
        await nominatimDelay();
      }
    }

    if (origin && origin.lat && origin.lng) {
      const { data, error } = await supabase.rpc("qa_psico_credenciados_proximos", {
        p_tipo: tipo, p_lat: origin.lat, p_lng: origin.lng,
        p_raio_km: raio_km, p_limit: limit, p_uf: ufFiltro, p_incluir_vencidos: incluirVencidos,
      });
      if (error) throw error;
      const results = data || [];
      if (results.length === 0 && ufFiltro) {
        const { data: d2 } = await supabase.rpc("qa_psico_credenciados_proximos", {
          p_tipo: tipo, p_lat: origin.lat, p_lng: origin.lng,
          p_raio_km: 99999, p_limit: limit, p_uf: ufFiltro, p_incluir_vencidos: incluirVencidos,
        });
        const proximos = d2 || [];
        return json({
          ok: true, origin, fora_do_raio: true, raio_km,
          distancia_mais_proximo: proximos[0]?.distancia_km ?? null,
          results: proximos, count: proximos.length,
        });
      }
      return json({ ok: true, origin, fora_do_raio: false, raio_km, results, count: results.length });
    }

    // Sem CEP: lista por UF se fornecida, ordenada por cidade/nome
    let q = supabase.from("qa_psico_credenciados").select("*").eq("tipo", tipo).eq("ativo", true).order("cidade").order("nome").limit(limit);
    if (ufFiltro) q = q.eq("uf", ufFiltro);
    if (!incluirVencidos) q = q.or(`validade.is.null,validade.gte.${new Date().toISOString().slice(0, 10)}`);
    const { data, error } = await q;
    if (error) throw error;
    return json({ ok: true, origin: null, results: data || [], count: (data || []).length });
  } catch (err: any) {
    console.error("[qa-psico-credenciados-buscar]", err);
    return json({ error: err.message || "erro interno" }, 500);
  }
});