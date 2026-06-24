// Geocode estruturado via Nominatim com validação de cidade.
// Evita o bug "cair na capital" (typical fallback when Nominatim sees only an
// unmatched street and returns the state's main locality).
//
// Reutiliza a tabela qa_endereco_geocache para idempotência. Cada chamada
// respeita o limite de 1 req/s da Nominatim — o consumidor deve serializar.

const UA = "WMTi-QueroArmas/1.0 (contato@queroarmas.com.br)";

export type GeocodeResult = { lat: number; lng: number };
export type GeocodeMeta = {
  result: GeocodeResult | null;
  hitNetwork: boolean; // true se chamou Nominatim/IA; false se respondeu do cache
  provider?: string;
};

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function norm(s: string) {
  return stripDiacritics((s || "").toLowerCase()).replace(/\s+/g, " ").trim();
}

/** Remove o "NR.", "Nº", "N°", "N." antes do número (quebra a busca do Nominatim). */
function limparNum(s: string) {
  return (s || "").replace(/\bn[º°r]?\.?\s*(\d)/gi, "$1");
}

/**
 * Tenta extrair { street, city, uf } de um endereço bruto.
 * Suporta o formato dominante das listas PF/IAT:
 *   "CLUBE - RUA X, NUM, BAIRRO, CIDADE/UF"
 *   "RUA X, NUM, BAIRRO, CIDADE - UF"
 *   "RUA X, NUM - CIDADE/UF"
 * Retorna null se não conseguir achar pelo menos rua + cidade.
 */
export function parseAddress(
  endereco: string,
  ufFallback?: string,
): { street: string; city: string; uf: string; bairro?: string } | null {
  if (!endereco) return null;
  let s = endereco.replace(/\s+/g, " ").trim();

  // Remove prefixo "CLUBE/CENTRO/ESCOLA ... - " (até o primeiro " - " ANTES da rua).
  // Heurística: se houver " - " e o que vier depois começar com palavras de via
  // (RUA/AV/AVENIDA/ROD/ESTRADA/TRAVESSA/PRACA/ALAMEDA/R\.), corta o prefixo.
  const splitDash = s.split(/\s-\s/);
  if (splitDash.length > 1) {
    const idx = splitDash.findIndex((part) =>
      /^(RUA|R\.|AVENIDA|AV\.?|ROD\.?|RODOVIA|ESTRADA|EST\.?|TRAVESSA|TV\.?|PRACA|PRA[ÇC]A|ALAMEDA|AL\.?|LARGO|LADEIRA)\b/i
        .test(part.trim())
    );
    if (idx > 0) s = splitDash.slice(idx).join(" - ");
  }

  // Última peça normalmente carrega CIDADE/UF ou CIDADE - UF.
  // Quebra por vírgula e processa a cauda.
  const tokens = s.split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 2) return null;

  let uf = (ufFallback || "").toUpperCase();
  let city = "";
  const tail = tokens[tokens.length - 1];
  let cityTailIndex = tokens.length - 1;

  const mSlash = tail.match(/^(.+?)\s*\/\s*([A-Z]{2})$/);
  const mDash = tail.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
  if (mSlash) { city = mSlash[1].trim(); uf = mSlash[2].toUpperCase(); }
  else if (mDash) { city = mDash[1].trim(); uf = mDash[2].toUpperCase(); }
  else {
    // Cauda é só CIDADE? Penúltima pode ter "CIDADE - UF" se split errou.
    const prev = tokens[tokens.length - 2] || "";
    const mPrev = prev.match(/^(.+?)\s*[-/]\s*([A-Z]{2})$/);
    if (mPrev) {
      city = mPrev[1].trim();
      uf = mPrev[2].toUpperCase();
      cityTailIndex = tokens.length - 2;
    } else if (uf) {
      city = tail; // assume cauda é cidade, uf veio de fallback
    } else {
      return null;
    }
  }

  // Rua = primeira parte (usualmente "RUA X, NUM"). Junta tokens[0..1] se o 2º for número/complemento curto.
  const streetParts: string[] = [tokens[0]];
  let nextIdx = 1;
  if (tokens.length > 2 && /^(n[º°.]?\s*)?\d{1,5}[A-Za-z]?$/i.test(tokens[1])) {
    streetParts.push(tokens[1]); nextIdx = 2;
  } else if (tokens.length > 2 && /\d/.test(tokens[1]) && tokens[1].length < 40) {
    streetParts.push(tokens[1]); nextIdx = 2;
  }
  const street = limparNum(streetParts.join(", ")).replace(/\s+/g, " ").trim();
  // Bairro = token entre rua e cidade, se existir
  let bairro: string | undefined;
  if (cityTailIndex > nextIdx) {
    const cand = tokens[nextIdx];
    if (cand && cand.length < 60 && !/^\d+$/.test(cand)) bairro = cand;
  }
  if (!street || !city || !uf) return null;
  // Descarta strings que não parecem ter um logradouro real
  if (street.length < 5) return null;
  return { street, city, uf, bairro };
}

async function nominatimStructured(
  street: string,
  city: string,
  uf: string,
): Promise<{ raw: any; lat: number | null; lng: number | null }> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("street", street);
  url.searchParams.set("city", city);
  url.searchParams.set("state", uf);
  url.searchParams.set("country", "Brasil");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  const r = await fetch(url.toString(), { headers: { "User-Agent": UA } });
  if (!r.ok) return { raw: null, lat: null, lng: null };
  const arr = await r.json();
  const first = Array.isArray(arr) ? arr[0] : null;
  if (!first) return { raw: null, lat: null, lng: null };
  return { raw: first, lat: Number(first.lat), lng: Number(first.lon) };
}

async function nominatimFreeText(q: string): Promise<{ raw: any; lat: number | null; lng: number | null }> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  const r = await fetch(url.toString(), { headers: { "User-Agent": UA } });
  if (!r.ok) return { raw: null, lat: null, lng: null };
  const arr = await r.json();
  const first = Array.isArray(arr) ? arr[0] : null;
  if (!first) return { raw: null, lat: null, lng: null };
  return { raw: first, lat: Number(first.lat), lng: Number(first.lon) };
}

function cityMatches(returned: any, expectedCity: string): boolean {
  if (!returned?.address) return false;
  const exp = norm(expectedCity);
  const candidates = [
    returned.address.city,
    returned.address.town,
    returned.address.village,
    returned.address.municipality,
    returned.address.county,
  ].filter(Boolean).map(norm);
  if (candidates.includes(exp)) return true;
  // Permite casamento parcial (ex.: "São Paulo" vs "Município de São Paulo")
  return candidates.some((c) => c.includes(exp) || exp.includes(c));
}

/**
 * Geocodifica um endereço bruto em cascata:
 *   1) estruturado (street/city/state)
 *   2) texto livre (street, bairro, city, uf, Brasil)
 *   3) centroide da cidade (city, uf, Brasil) — provider "nominatim_city_centroid"
 * Em todas, valida cityMatches para evitar "cair na capital".
 * Idempotente via qa_endereco_geocache. NULL só é cacheado quando até o
 * centroide falha.
 */
export async function geocodeEndereco(
  supabase: any,
  endereco: string,
  ufFallback?: string,
): Promise<GeocodeResult | null> {
  const meta = await geocodeEnderecoMeta(supabase, endereco, ufFallback);
  return meta.result;
}

/** Igual a geocodeEndereco mas informa se a chamada bateu na rede (para o
 * consumidor decidir se aplica o delay de 1 req/s da Nominatim). */
export async function geocodeEnderecoMeta(
  supabase: any,
  endereco: string,
  ufFallback?: string,
): Promise<GeocodeMeta> {
  const parsed = parseAddress(endereco, ufFallback);
  if (!parsed) {
    await cacheNegative(supabase, endereco, ufFallback, { reason: "unparseable" });
    return { result: null, hitNetwork: false, provider: "unparseable" };
  }
  const cacheKey = norm(`${parsed.street} | ${parsed.city} | ${parsed.uf}`);
  const { data: cached } = await supabase
    .from("qa_endereco_geocache")
    .select("latitude,longitude,provider")
    .eq("endereco_normalizado", cacheKey)
    .maybeSingle();
  if (cached) {
    if (cached.latitude && cached.longitude) {
      return {
        result: { lat: Number(cached.latitude), lng: Number(cached.longitude) },
        hitNetwork: false,
        provider: cached.provider,
      };
    }
    // Negativo já gravado pela IA — desiste de vez (evita reconsumir crédito).
    if (cached.provider === "lovable_ai_failed" || cached.provider === "unparseable") {
      return { result: null, hitNetwork: false, provider: cached.provider };
    }
    // Cache antigo (nominatim_cascade_failed/structured nulo) — tenta IA como
    // fallback antes de declarar falha definitiva.
    const ai = await geocodeViaAi(parsed);
    if (ai) {
      await supabase.from("qa_endereco_geocache").upsert({
        endereco_normalizado: cacheKey, latitude: ai.lat, longitude: ai.lng,
        provider: "lovable_ai", raw: { fonte: "lovable_ai", parsed },
      }, { onConflict: "endereco_normalizado" });
      return { result: ai, hitNetwork: true, provider: "lovable_ai" };
    }
    await supabase.from("qa_endereco_geocache").upsert({
      endereco_normalizado: cacheKey, latitude: null, longitude: null,
      provider: "lovable_ai_failed", raw: { fonte: "lovable_ai", parsed },
    }, { onConflict: "endereco_normalizado" });
    return { result: null, hitNetwork: true, provider: "lovable_ai_failed" };
  }

  // Cascata: estruturado -> texto livre -> centroide cidade
  type Attempt = { provider: string; lat: number | null; lng: number | null; raw: any };
  const attempts: Attempt[] = [];

  try {
    const a = await nominatimStructured(parsed.street, parsed.city, parsed.uf);
    attempts.push({ provider: "nominatim_structured", ...a });
    if (a.lat !== null && a.lng !== null && cityMatches(a.raw, parsed.city)) {
      await supabase.from("qa_endereco_geocache").upsert({
        endereco_normalizado: cacheKey, latitude: a.lat, longitude: a.lng,
        provider: "nominatim_structured", raw: a.raw,
      }, { onConflict: "endereco_normalizado" });
      return { result: { lat: a.lat, lng: a.lng }, hitNetwork: true, provider: "nominatim_structured" };
    }
    await nominatimDelay();

    const qFree = [parsed.street, parsed.bairro, parsed.city, parsed.uf, "Brasil"]
      .filter(Boolean).join(", ");
    const b = await nominatimFreeText(qFree);
    attempts.push({ provider: "nominatim_freetext", ...b });
    if (b.lat !== null && b.lng !== null && cityMatches(b.raw, parsed.city)) {
      await supabase.from("qa_endereco_geocache").upsert({
        endereco_normalizado: cacheKey, latitude: b.lat, longitude: b.lng,
        provider: "nominatim_freetext", raw: b.raw,
      }, { onConflict: "endereco_normalizado" });
      return { result: { lat: b.lat, lng: b.lng }, hitNetwork: true, provider: "nominatim_freetext" };
    }
    await nominatimDelay();

    const qCity = `${parsed.city}, ${parsed.uf}, Brasil`;
    const c = await nominatimFreeText(qCity);
    attempts.push({ provider: "nominatim_city_centroid", ...c });
    if (c.lat !== null && c.lng !== null && cityMatches(c.raw, parsed.city)) {
      await supabase.from("qa_endereco_geocache").upsert({
        endereco_normalizado: cacheKey, latitude: c.lat, longitude: c.lng,
        provider: "nominatim_city_centroid", raw: c.raw,
      }, { onConflict: "endereco_normalizado" });
      return { result: { lat: c.lat, lng: c.lng }, hitNetwork: true, provider: "nominatim_city_centroid" };
    }
  } catch {
    // segue e cacheia negativo
  }

  // Cascata Nominatim falhou — tenta Lovable AI antes de declarar falha.
  const ai = await geocodeViaAi(parsed);
  if (ai) {
    await supabase.from("qa_endereco_geocache").upsert({
      endereco_normalizado: cacheKey, latitude: ai.lat, longitude: ai.lng,
      provider: "lovable_ai", raw: { fonte: "lovable_ai", parsed, attempts },
    }, { onConflict: "endereco_normalizado" });
    return { result: ai, hitNetwork: true, provider: "lovable_ai" };
  }
  await supabase.from("qa_endereco_geocache").upsert({
    endereco_normalizado: cacheKey, latitude: null, longitude: null,
    provider: "lovable_ai_failed", raw: { fonte: "lovable_ai", attempts },
  }, { onConflict: "endereco_normalizado" });
  return { result: null, hitNetwork: true, provider: "lovable_ai_failed" };
}

async function cacheNegative(
  supabase: any,
  endereco: string,
  uf: string | undefined,
  raw: any,
) {
  const cacheKey = norm(`${endereco} | ${uf || ""}`);
  await supabase.from("qa_endereco_geocache").upsert({
    endereco_normalizado: cacheKey,
    latitude: null,
    longitude: null,
    provider: "nominatim_structured",
    raw,
  }, { onConflict: "endereco_normalizado" });
}

/** Espera 1.1s para respeitar a política de 1 req/s da Nominatim. */
export const nominatimDelay = () => new Promise((r) => setTimeout(r, 1100));

/** Bounding box do Brasil — descarta qualquer coordenada fora. */
function dentroDoBrasil(lat: number, lng: number): boolean {
  return lat >= -34 && lat <= 5.5 && lng >= -74 && lng <= -34;
}

/**
 * Fallback de geocode via Lovable AI Gateway. Usa modelo barato (gemini-flash)
 * pedindo coordenadas em JSON estruturado. Valida bounding box do Brasil.
 * Retorna null se a IA não souber (lat/lng=null) ou se vier fora do Brasil.
 */
async function geocodeViaAi(parsed: {
  street: string; city: string; uf: string; bairro?: string;
}): Promise<GeocodeResult | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const enderecoTxt = [parsed.street, parsed.bairro, parsed.city, parsed.uf, "Brasil"]
    .filter(Boolean).join(", ");
  const system = "Você é um geocodificador. Responda APENAS com JSON {\"lat\":number,\"lng\":number,\"confianca\":\"alta\"|\"media\"|\"baixa\"|\"nenhuma\"}. Se não souber, use lat=null e lng=null e confianca=\"nenhuma\". Coordenadas devem estar no Brasil (lat entre -34 e 5, lng entre -74 e -34).";
  const user = `Endereço: ${enderecoTxt}\nCidade esperada: ${parsed.city}/${parsed.uf}.\nRetorne as coordenadas exatas em decimal (WGS84).`;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "wmti-geocode",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsedJson = typeof content === "string" ? JSON.parse(content) : content;
    const lat = Number(parsedJson?.lat);
    const lng = Number(parsedJson?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!dentroDoBrasil(lat, lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}