// Busca IATs (instrutores de armamento e tiro) por proximidade de CEP ou por UF.
// Comportamento híbrido:
//   - UF com endereços (SP) + lat/lng → ordena por distância via RPC qa_iat_credenciados_proximos.
//   - UF sem endereços (maioria) → lista alfabética da UF + flag tem_enderecos=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function geocodeCEP(supabase: any, cep: string): Promise<{ lat: number; lng: number; uf: string; cidade: string } | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
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
  // Usa o lat/lng que a BrasilAPI já devolve quando disponível
  if (addr.location?.coordinates?.latitude && addr.location?.coordinates?.longitude) {
    return {
      lat: Number(addr.location.coordinates.latitude),
      lng: Number(addr.location.coordinates.longitude),
      uf, cidade,
    };
  }
  // Fallback: nominatim na cidade
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("city", cidade);
    url.searchParams.set("state", uf);
    url.searchParams.set("country", "Brasil");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("limit", "1");
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "WMTi-QueroArmas/1.0 (contato@queroarmas.com.br)" },
    });
    if (r.ok) {
      const arr = await r.json();
      const f = arr?.[0];
      if (f) return { lat: Number(f.lat), lng: Number(f.lon), uf, cidade };
    }
  } catch { /* noop */ }
  return { lat: 0, lng: 0, uf, cidade };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json();
    const cep: string = body?.cep || "";
    const ufBody: string | null = body?.uf ? String(body.uf).toUpperCase() : null;
    const raio_km: number = Number(body?.raio_km) || 50;
    const limit: number = Math.min(Number(body?.limit) || 20, 100);

    const origin = cep ? await geocodeCEP(supabase, cep) : null;
    const uf = origin?.uf || ufBody || null;
    if (!uf) return json({ error: "informe cep ou uf" }, 400);

    // A UF tem endereços geocodificáveis?
    const { count: comGeo } = await supabase
      .from("qa_iat_credenciados")
      .select("id", { count: "exact", head: true })
      .eq("uf", uf)
      .not("lat", "is", null);
    const temEnderecos = (comGeo ?? 0) > 0;

    if (temEnderecos && origin && origin.lat && origin.lng) {
      const { data, error } = await supabase.rpc("qa_iat_credenciados_proximos", {
        p_lat: origin.lat, p_lng: origin.lng,
        p_uf: uf, p_raio_km: raio_km, p_limit: limit,
      });
      if (error) throw error;
      let results = data || [];
      if (results.length === 0) {
        const { data: d2 } = await supabase.rpc("qa_iat_credenciados_proximos", {
          p_lat: origin.lat, p_lng: origin.lng,
          p_uf: uf, p_raio_km: 99999, p_limit: limit,
        });
        results = d2 || [];
      }
      return json({ ok: true, mode: "proximity", uf, tem_enderecos: true, origin, results, count: results.length });
    }

    // Lista alfabética da UF (sem coordenadas)
    const { data, error } = await supabase
      .from("qa_iat_credenciados")
      .select("id, uf, nome, telefone, email, endereco, clube, portaria, validade, lat, lng, fonte_url")
      .eq("uf", uf)
      .order("nome", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return json({
      ok: true,
      mode: "alphabetical",
      uf,
      tem_enderecos: temEnderecos,
      origin,
      results: data || [],
      count: (data || []).length,
    });
  } catch (e: any) {
    console.error("[qa-iat-credenciados-buscar]", e);
    return json({ error: e?.message || "erro interno" }, 500);
  }
});