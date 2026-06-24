import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CredenciadoIAT = {
  id: string;
  uf: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  clube: string | null;
  portaria: string | null;
  validade: string | null;
  lat: number | null;
  lng: number | null;
  fonte_url?: string | null;
  distancia_km?: number | null;
};

export type BuscarIATParams = {
  cep?: string;
  uf?: string;
  raio_km?: number;
  limit?: number;
};

export type BuscarIATResponse = {
  mode: "proximity" | "alphabetical";
  uf: string;
  tem_enderecos: boolean;
  origin: { lat: number; lng: number; uf: string; cidade: string } | null;
  results: CredenciadoIAT[];
};

export function useCredenciadosIAT(params: BuscarIATParams | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BuscarIATResponse | null>(null);

  const run = useCallback(async (p: BuscarIATParams) => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-iat-credenciados-buscar", { body: p });
      if (error) throw error;
      setData(data as BuscarIATResponse);
    } catch (e: any) {
      setError(e?.message || "Erro ao buscar instrutores");
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (params) run(params); }, [params?.cep, params?.uf, params?.raio_km, params?.limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, data, refetch: run };
}