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

    if (!type || !value) {
      return json({ error: "type and value are required" }, 400);
    }

    const digits = value.replace(/\D/g, "");

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
        return json({ error: "CNPJ não encontrado na Receita Federal" }, 404);
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
        return json({ error: "CEP não encontrado" }, 404);
      }

      const apiData = await res.json();

      // Save to cache
      supabase.from("cep_cache").upsert({ cep: digits, data: apiData }).then();

      await logLookup(supabase, "cep", digits, "api_success");
      return json({ source: "api", data: apiData });
    }

    return json({ error: "type must be 'cnpj' or 'cep'" }, 400);
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
