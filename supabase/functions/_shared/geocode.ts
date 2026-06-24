// Geocode estruturado via Nominatim com validação de cidade.
// Evita o bug "cair na capital" (typical fallback when Nominatim sees only an
// unmatched street and returns the state's main locality).
//
// Reutiliza a tabela qa_endereco_geocache para idempotência. Cada chamada
// respeita o limite de 1 req/s da Nominatim — o consumidor deve serializar.

const UA = "WMTi-QueroArmas/1.0 (contato@queroarmas.com.br)";

export type GeocodeResult = { lat: number; lng: number };

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
  const parsed = parseAddress(endereco, ufFallback);
  if (!parsed) {
    await cacheNegative(supabase, endereco, ufFallback, { reason: "unparseable" });
    return null;
  }
  const cacheKey = norm(`${parsed.street} | ${parsed.city} | ${parsed.uf}`);
  const { data: cached } = await supabase
    .from("qa_endereco_geocache")
    .select("latitude,longitude")
    .eq("endereco_normalizado", cacheKey)
    .maybeSingle();
  if (cached) {
    if (cached.latitude && cached.longitude) {
      return { lat: Number(cached.latitude), lng: Number(cached.longitude) };
    }
    return null;
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
      return { lat: a.lat, lng: a.lng };
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
      return { lat: b.lat, lng: b.lng };
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
      return { lat: c.lat, lng: c.lng };
    }
  } catch {
    // segue e cacheia negativo
  }

  await supabase.from("qa_endereco_geocache").upsert({
    endereco_normalizado: cacheKey, latitude: null, longitude: null,
    provider: "nominatim_cascade_failed", raw: { attempts },
  }, { onConflict: "endereco_normalizado" });
  return null;
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