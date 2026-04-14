import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { type, value } = await req.json();

    if (!type || value === undefined || value === null) {
      return json({ error: "type and value are required" }, 400);
    }

    const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";

    // ── CNPJ lookup ──
    if (type === "cnpj") {
      if (digits.length !== 14) {
        return json({ error: "CNPJ deve ter 14 dígitos" }, 400);
      }

      // Check cache first
      const { data: cached } = await supabase
        .from("cnpj_cache")
        .select("data")
        .eq("cnpj", digits)
        .maybeSingle();

      if (cached?.data) {
        await logLookup(supabase, "cnpj", digits, "cache_hit");
        return json({ source: "cache", data: cached.data });
      }

      // Fetch from BrasilAPI
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        await logLookup(supabase, "cnpj", digits, "api_error", `Status: ${res.status}`);
        return json({ error: "CNPJ não encontrado na Receita Federal", data: null }, 200);
      }

      const apiData = await res.json();

      // Save to cache (fire-and-forget)
      supabase.from("cnpj_cache").upsert({ cnpj: digits, data: apiData }).then();

      await logLookup(supabase, "cnpj", digits, "api_success");
      return json({ source: "api", data: apiData });
    }

    // ── CEP lookup ──
    if (type === "cep") {
      if (digits.length !== 8) {
        return json({ error: "CEP deve ter 8 dígitos" }, 400);
      }

      // Check cache first
      const { data: cached } = await supabase
        .from("cep_cache")
        .select("data")
        .eq("cep", digits)
        .maybeSingle();

      if (cached?.data) {
        await logLookup(supabase, "cep", digits, "cache_hit");
        return json({ source: "cache", data: cached.data });
      }

      // Fetch from BrasilAPI
      const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
      if (!res.ok) {
        await logLookup(supabase, "cep", digits, "api_error", `Status: ${res.status}`);
        return json({ error: "CEP não encontrado", data: null }, 200);
      }

      const apiData = await res.json();

      // Save to cache
      supabase.from("cep_cache").upsert({ cep: digits, data: apiData }).then();

      await logLookup(supabase, "cep", digits, "api_success");
      return json({ source: "api", data: apiData });
    }

    // ── Geocode lookup (Nominatim / OpenStreetMap) ──
    if (type === "geocode") {
      const { street, number, city, state } = value as unknown as { street?: string; number?: string; city?: string; state?: string };
      if (!city) {
        return json({ error: "city is required for geocoding" }, 400);
      }

      const parts: string[] = [];
      if (number && street) parts.push(`${number} ${street}`);
      else if (street) parts.push(street);
      parts.push(city);
      if (state) parts.push(state);
      parts.push("Brazil");

      const q = encodeURIComponent(parts.join(", "));
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`;

      const res = await fetch(nominatimUrl, {
        headers: { "User-Agent": "WMTi-QueroArmas/1.0" },
      });

      if (!res.ok) {
        await logLookup(supabase, "geocode", parts.join(", "), "api_error", `Status: ${res.status}`);
        return json({ error: "Erro ao buscar geolocalização", data: null }, 200);
      }

      const results = await res.json();
      if (!results || results.length === 0) {
        await logLookup(supabase, "geocode", parts.join(", "), "not_found");
        return json({ data: null, found: false });
      }

      const { lat, lon, display_name } = results[0];
      await logLookup(supabase, "geocode", parts.join(", ").slice(0, 30) + "...", "api_success");
      return json({ data: { latitude: lat, longitude: lon, display_name }, found: true });
    }

    return json({ error: "type must be 'cnpj', 'cep', or 'geocode'" }, 400);
  } catch (err) {
    console.error("[brasil-api-lookup] Error:", err);
    return json({ error: "Erro interno ao consultar dados" }, 500);
  }
});

async function logLookup(
  supabase: ReturnType<typeof createClient>,
  type: string,
  value: string,
  status: string,
  errorMessage?: string,
) {
  try {
    await supabase.from("integration_logs").insert({
      integration_name: "brasil_api",
      operation_name: `lookup_${type}`,
      request_payload: { type, value: value.slice(0, 6) + "***" },
      status,
      error_message: errorMessage || null,
    });
  } catch {
    // Logging should never block the response
  }
}
