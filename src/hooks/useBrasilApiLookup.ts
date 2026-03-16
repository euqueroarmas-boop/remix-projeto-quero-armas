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
      const { data, error } = await supabase.functions.invoke("brasil-api-lookup", {
        body: { type: "cep", value: digits },
      });

      if (error || !data?.data) return null;
      return data.data as CepData;
    } catch {
      return null;
    } finally {
      setCepLoading(false);
    }
  }, []);

  return { lookupCnpj, lookupCep, cnpjLoading, cepLoading };
}
