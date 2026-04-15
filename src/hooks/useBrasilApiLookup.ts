import { useState, useCallback, useRef } from "react";

interface CnpjData {
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  cnae_fiscal_descricao?: string;
}

interface CepData {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Direct fetch to Edge Function with proper AbortController support */
async function invokeEdgeFunction(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ data: any; error: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/brasil-api-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}` } };
    const json = await res.json();
    return { data: json, error: null };
  } catch (e: any) {
    clearTimeout(timer);
    return { data: null, error: { message: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch failed") } };
  }
}

export function useBrasilApiLookup() {
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const cepAbortRef = useRef<AbortController | null>(null);

  const lookupCnpj = useCallback(async (cnpj: string): Promise<CnpjData | null> => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return null;

    setCnpjLoading(true);
    try {
      const { data, error } = await invokeEdgeFunction({ type: "cnpj", value: digits }, 10000);
      if (error || !data?.data) return null;
      return data.data as CnpjData;
    } catch {
      return null;
    } finally {
      setCnpjLoading(false);
    }
  }, []);

  const lookupCep = useCallback(async (cep: string): Promise<CepData | null> => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return null;

    // Cancel any in-flight CEP lookup
    cepAbortRef.current?.abort();

    setCepLoading(true);
    try {
      // Try Edge Function with 6s timeout
      try {
        const { data, error } = await invokeEdgeFunction({ type: "cep", value: digits }, 6000);
        if (!error && data?.data) return data.data as CepData;
      } catch {
        // Edge Function failed, try fallback
      }

      // Fallback: direct BrasilAPI call with 5s timeout
      console.warn("[lookupCep] Edge Function failed, trying direct BrasilAPI");
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const apiData = await res.json();
          return {
            street: apiData.street,
            neighborhood: apiData.neighborhood,
            city: apiData.city,
            state: apiData.state,
            cep: apiData.cep,
          } as CepData;
        }
      } catch {
        // fallback also failed
      }

      return null;
    } catch {
      return null;
    } finally {
      setCepLoading(false);
    }
  }, []);

  const lookupGeocode = useCallback(async (params: { street?: string; number?: string; city?: string; state?: string }): Promise<{ latitude: string; longitude: string } | null> => {
    if (!params.city) return null;

    setGeocodeLoading(true);
    try {
      const { data, error } = await invokeEdgeFunction({ type: "geocode", value: params }, 10000);
      if (error || !data?.data || !data?.found) return null;
      return { latitude: data.data.latitude, longitude: data.data.longitude };
    } catch {
      return null;
    } finally {
      setGeocodeLoading(false);
    }
  }, []);

  return { lookupCnpj, lookupCep, lookupGeocode, cnpjLoading, cepLoading, geocodeLoading };
}
