// Consulta credenciados PF por proximidade ao CEP do cliente.
// Lazy-geocoda endereços ainda sem coordenadas (até MAX_GEOCODE por chamada).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_GEOCODE_PER_CALL = 12; // Nominatim: 1 req/s
const NOMINATIM_UA = "WMTi-QueroArmas/1.0 (contato@queroarmas.com.br)";

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function geocodeAddress(supabase: any, endereco: string, uf: string, cidade: string | null): Promise<{ lat: number; lng: number } | null> {
  const key = `${endereco}, ${cidade || ""} - ${uf}, Brasil`.replace(/\s+/g, " ").trim().toLowerCase();
  const { data: cached } = await supabase.from("qa_endereco_geocache").select("latitude,longitude").eq("endereco_normalizado", key).maybeSingle();
  if (cached) {
    if (cached.latitude && cached.longitude) return { lat: cached.latitude, lng: cached.longitude };
    return null;
  }
  try {
    const q = encodeURIComponent(key);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`, {
      headers: { "User-Agent": NOMINATIM_UA },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    const lat = arr?.[0]?.lat ? Number(arr[0].lat) : null;
    const lng = arr?.[0]?.lon ? Number(arr[0].lon) : null;
    await supabase.from("qa_endereco_geocache").upsert({
      endereco_normalizado: key, latitude: lat, longitude: lng, provider: "nominatim", raw: arr?.[0] || null,
    }, { onConflict: "endereco_normalizado" });
    if (lat && lng) return { lat, lng };
    return null;
  } catch { return null; }
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
  // 2. Geocode street/city
  const enderecoTxt = `${addr.street || ""}, ${addr.neighborhood || ""}, ${cidade} - ${uf}, Brasil`;
  const geo = await geocodeAddress(supabase, enderecoTxt, uf, cidade);
  if (geo) return { ...geo, uf, cidade };
  // Fallback: só cidade
  const fallback = await geocodeAddress(supabase, `${cidade} - ${uf}, Brasil`, uf, cidade);
  if (fallback) return { ...fallback, uf, cidade };
  return null;
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
        .from("qa_pf_credenciados")
        .select("id,endereco,cidade,uf")
        .eq("tipo", tipo).eq("uf", ufFiltro).eq("ativo", true)
        .is("latitude", null).not("endereco", "is", null)
        .limit(MAX_GEOCODE_PER_CALL);
      for (const e of pendentes || []) {
        const g = await geocodeAddress(supabase, e.endereco, e.uf, e.cidade);
        if (g) await supabase.from("qa_pf_credenciados").update({ latitude: g.lat, longitude: g.lng }).eq("id", e.id);
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    if (origin) {
      const { data, error } = await supabase.rpc("qa_pf_credenciados_proximos", {
        p_tipo: tipo, p_lat: origin.lat, p_lng: origin.lng,
        p_raio_km: raio_km, p_limit: limit, p_uf: ufFiltro, p_incluir_vencidos: incluirVencidos,
      });
      if (error) throw error;
      // Se vazio dentro do raio, expande para estado inteiro
      let results = data || [];
      if (results.length === 0 && ufFiltro) {
        const { data: d2 } = await supabase.rpc("qa_pf_credenciados_proximos", {
          p_tipo: tipo, p_lat: origin.lat, p_lng: origin.lng,
          p_raio_km: 99999, p_limit: limit, p_uf: ufFiltro, p_incluir_vencidos: incluirVencidos,
        });
        results = d2 || [];
      }
      return json({ ok: true, origin, results, count: results.length });
    }

    // Sem CEP: lista por UF se fornecida, ordenada por cidade/nome
    let q = supabase.from("qa_pf_credenciados").select("*").eq("tipo", tipo).eq("ativo", true).order("cidade").order("nome").limit(limit);
    if (ufFiltro) q = q.eq("uf", ufFiltro);
    if (!incluirVencidos) q = q.or(`validade.is.null,validade.gte.${new Date().toISOString().slice(0, 10)}`);
    const { data, error } = await q;
    if (error) throw error;
    return json({ ok: true, origin: null, results: data || [], count: (data || []).length });
  } catch (err: any) {
    console.error("[qa-pf-credenciados-buscar]", err);
    return json({ error: err.message || "erro interno" }, 500);
  }
});