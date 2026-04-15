import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useBrasilApiLookup() {
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);

  const lookupCnpj = useCallback(async (cnpj: string): Promise<CnpjData | null> => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return null;

    setCnpjLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("brasil-api-lookup", {
        body: { type: "cnpj", value: digits },
      });

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

    setCepLoading(true);
    try {
      // Try Supabase function invoke with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const { data, error } = await supabase.functions.invoke("brasil-api-lookup", {
          body: { type: "cep", value: digits },
        });
        clearTimeout(timeout);
        if (!error && data?.data) return data.data as CepData;
      } catch {
        clearTimeout(timeout);
      }

      // Fallback: direct BrasilAPI call
      console.warn("[lookupCep] Supabase invoke failed, trying direct BrasilAPI");
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`, {
          signal: AbortSignal.timeout(6000),
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
      const { data, error } = await supabase.functions.invoke("brasil-api-lookup", {
        body: { type: "geocode", value: params },
      });

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
