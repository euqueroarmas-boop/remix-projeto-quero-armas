// Consulta credenciados PF por proximidade ao CEP do cliente.
// Lazy-geocoda endereços ainda sem coordenadas (até MAX_GEOCODE por chamada).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeEndereco, nominatimDelay } from "../_shared/geocode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_GEOCODE_PER_CALL = 8; // Nominatim: 1 req/s (roda em background)

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function sanitizeBusca(v: unknown): string {
  return String(v || "")
    .trim()
    .replace(/[%_,]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function normBusca(v: unknown): string {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buscaMatch(row: any, busca: string): boolean {
  if (!busca) return true;
  const q = normBusca(busca);
  return [
    row?.nome,
    row?.registro,
    row?.uf,
    row?.cidade,
    row?.bairro,
    row?.endereco,
    ...(Array.isArray(row?.telefones) ? row.telefones : []),
    ...(Array.isArray(row?.emails) ? row.emails : []),
  ].some((v) => normBusca(v).includes(q));
}

function cidadeMatch(row: any, cidade: string): boolean {
  if (!cidade) return true;
  const q = normBusca(cidade);
  return [row?.cidade, row?.bairro, row?.endereco]
    .some((v) => normBusca(v).includes(q));
}

function distanciaKm(a: { lat: number; lng: number } | null, b: { latitude?: number | null; longitude?: number | null }): number | null {
  if (!a || !a.lat || !a.lng || !b.latitude || !b.longitude) return null;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(Number(b.latitude) - a.lat);
  const dLng = toRad(Number(b.longitude) - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(Number(b.latitude));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function geocodeCEP(supabase: any, cep: string): Promise<{ lat: number; lng: number; uf: string; cidade: string } | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  // 1. Coordenadas cacheadas por CEP (evita bater no Nominatim de novo)
  try {
    const { data: cachedGeo } = await supabase.from("cep_cache").select("data").eq("cep", digits).maybeSingle();
    const g = (cachedGeo as any)?.data;
    if (g?._geo?.lat && g?._geo?.lng) {
      return { lat: Number(g._geo.lat), lng: Number(g._geo.lng), uf: String(g.state || "").toUpperCase(), cidade: String(g.city || "") };
    }
  } catch { /* noop */ }

  // 2. Endereço via BrasilAPI
  let addr: any = null;
  try {
    const { data: cached } = await supabase.from("cep_cache").select("data").eq("cep", digits).maybeSingle();
    addr = (cached as any)?.data || null;
    if (!addr) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`, { signal: ctl.signal });
      clearTimeout(t);
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
    const geo = {
      lat: Number(addr.location.coordinates.latitude),
      lng: Number(addr.location.coordinates.longitude),
      uf, cidade,
    };
    supabase.from("cep_cache").upsert({ cep: digits, data: { ...addr, _geo: { lat: geo.lat, lng: geo.lng } } }).then();
    return geo;
  }
  // Fallback via Nominatim — com timeout global de 6s para não travar a UI.
  const enderecoTxt = `${addr.street || cidade}, ${addr.neighborhood || ""}, ${cidade}/${uf}`;
  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race<T | null>([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);
  let geo = await withTimeout(geocodeEndereco(supabase, enderecoTxt, uf), 6000);
  if (!geo) geo = await withTimeout(geocodeEndereco(supabase, `${cidade}/${uf}, Brasil`, uf), 4000);
  if (geo) {
    supabase.from("cep_cache").upsert({ cep: digits, data: { ...addr, _geo: { lat: geo.lat, lng: geo.lng } } }).then();
    return { ...geo, uf, cidade };
  }
  return { lat: 0, lng: 0, uf, cidade };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const tipo: string = body.tipo; // 'psicologo' | 'instrutor_tiro'
    const cep: string = String(body.cep || "").replace(/\D/g, "");
    const raio_km: number = Number(body.raio_km) || 50;
    const limit: number = Math.min(Number(body.limit) || 20, 100);
    const incluirVencidos: boolean = Boolean(body.incluir_vencidos);
    const busca = sanitizeBusca(body.busca || body.q || body.search);
    const cidadeFiltro = sanitizeBusca(body.cidade);

    if (!tipo || !["psicologo", "instrutor_tiro"].includes(tipo)) return json({ error: "tipo inválido" }, 400);

    const origin = cep.length === 8 ? await geocodeCEP(supabase, cep) : null;
    const ufFiltro: string | null = origin?.uf || body.uf || null;

    // Lazy geocode em BACKGROUND (não bloqueia a resposta ao cliente).
    // A primeira busca ainda pode não ter todos os pontos geocodificados,
    // mas as próximas terão. Isso evita timeouts na UI.
    if (ufFiltro) {
      const bgGeocode = async () => {
        try {
          const { data: pendentes } = await supabase
            .from("qa_psico_credenciados")
            .select("id,endereco,cidade,uf")
            .eq("tipo", tipo).eq("uf", ufFiltro).eq("ativo", true)
            .is("latitude", null).not("endereco", "is", null)
            .limit(MAX_GEOCODE_PER_CALL);
          for (const e of pendentes || []) {
            const enderecoCompleto = [e.endereco, e.cidade ? `${e.cidade}/${e.uf}` : null]
              .filter(Boolean)
              .join(", ");
            const g = await geocodeEndereco(supabase, enderecoCompleto, e.uf);
            if (g) await supabase.from("qa_psico_credenciados").update({ latitude: g.lat, longitude: g.lng }).eq("id", e.id);
            await nominatimDelay();
          }
        } catch (err) { console.warn("[bg-geocode]", err); }
      };
      // @ts-ignore EdgeRuntime.waitUntil existe no runtime Supabase
      if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(bgGeocode());
      } else {
        bgGeocode();
      }
    }

    // Quando há CEP resolvido, a busca principal deve ser por proximidade.
    // O frontend também envia a cidade do cadastro, mas ela não pode virar filtro textual,
    // porque muitos credenciados oficiais vêm sem cidade normalizada ou com endereço parcial.
    if (!origin && cidadeFiltro && ufFiltro) {
      let q = supabase
        .from("qa_psico_credenciados")
        .select("*")
        .eq("tipo", tipo)
        .eq("uf", String(ufFiltro).toUpperCase())
        .eq("ativo", true)
        .order("nome")
        .limit(1000);
      if (!incluirVencidos) q = q.or(`validade.is.null,validade.gte.${new Date().toISOString().slice(0, 10)}`);
      const { data, error } = await q;
      if (error) throw error;
      const results = (data || [])
        .filter((r: any) => cidadeMatch(r, cidadeFiltro))
        .filter((r: any) => buscaMatch(r, busca))
        .map((r: any) => ({ ...r, distancia_km: distanciaKm(origin, r) }))
        .sort((a: any, b: any) => {
          if (a.distancia_km != null || b.distancia_km != null) return (a.distancia_km ?? 1e9) - (b.distancia_km ?? 1e9);
          return String(a.nome || "").localeCompare(String(b.nome || ""));
        })
        .slice(0, limit);
      return json({ ok: true, origin, cidade: cidadeFiltro, fora_do_raio: false, raio_km, results, count: results.length });
    }

    if (busca) {
      let q = supabase
        .from("qa_psico_credenciados")
        .select("*")
        .eq("tipo", tipo)
        .eq("ativo", true);
      if (ufFiltro) q = q.eq("uf", String(ufFiltro).toUpperCase());
      if (!incluirVencidos) q = q.or(`validade.is.null,validade.gte.${new Date().toISOString().slice(0, 10)}`);
      if (!ufFiltro) {
        q = q.or([
          `nome.ilike.%${busca}%`,
          `registro.ilike.%${busca}%`,
          `uf.ilike.%${busca}%`,
          `cidade.ilike.%${busca}%`,
          `bairro.ilike.%${busca}%`,
          `endereco.ilike.%${busca}%`,
        ].join(","));
      }
      const { data, error } = await q.order("cidade").order("nome").limit(ufFiltro ? 1000 : 300);
      if (error) throw error;
      const results = (data || [])
        .filter((r: any) => buscaMatch(r, busca))
        .map((r: any) => ({ ...r, distancia_km: distanciaKm(origin, r) }))
        .sort((a: any, b: any) => {
          if (a.distancia_km != null || b.distancia_km != null) return (a.distancia_km ?? 1e9) - (b.distancia_km ?? 1e9);
          return String(a.cidade || "").localeCompare(String(b.cidade || "")) || String(a.nome || "").localeCompare(String(b.nome || ""));
        })
        .slice(0, limit);
      return json({ ok: true, origin, fora_do_raio: false, raio_km, results, count: results.length });
    }

    if (origin && origin.lat && origin.lng) {
      const { data, error } = await supabase.rpc("qa_psico_credenciados_proximos", {
        p_tipo: tipo, p_lat: origin.lat, p_lng: origin.lng,
        p_raio_km: raio_km, p_limit: limit, p_uf: ufFiltro, p_incluir_vencidos: incluirVencidos,
      });
      if (error) throw error;
      let results = data || [];
      if (cidadeFiltro && ufFiltro) {
        let qCidade = supabase
          .from("qa_psico_credenciados")
          .select("*")
          .eq("tipo", tipo)
          .eq("uf", String(ufFiltro).toUpperCase())
          .eq("ativo", true)
          .limit(1000);
        if (!incluirVencidos) qCidade = qCidade.or(`validade.is.null,validade.gte.${new Date().toISOString().slice(0, 10)}`);
        const { data: porCidade, error: cidadeErr } = await qCidade;
        if (cidadeErr) throw cidadeErr;
        const cidadeResults = (porCidade || [])
          .filter((r: any) => cidadeMatch(r, cidadeFiltro))
          .filter((r: any) => buscaMatch(r, busca))
          .map((r: any) => ({ ...r, distancia_km: distanciaKm(origin, r) }))
          .sort((a: any, b: any) => {
            if (a.distancia_km != null || b.distancia_km != null) return (a.distancia_km ?? 1e9) - (b.distancia_km ?? 1e9);
            return String(a.nome || "").localeCompare(String(b.nome || ""));
          });
        const seen = new Set<string>();
        results = [...cidadeResults, ...results]
          .filter((r: any) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          })
          .slice(0, limit);
      }
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
