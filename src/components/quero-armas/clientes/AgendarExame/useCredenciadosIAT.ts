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
  cidade?: string;
  busca?: string;
  raio_km?: number;
  limit?: number;
};

export type BuscarIATResponse = {
  mode: "proximity" | "alphabetical";
  uf: string;
  tem_enderecos: boolean;
  origin: { lat: number; lng: number; uf: string; cidade: string } | null;
  results: CredenciadoIAT[];
  fora_do_raio?: boolean;
  raio_km?: number;
  distancia_mais_proximo?: number | null;
};

export function useCredenciadosIAT(params: BuscarIATParams | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BuscarIATResponse | null>(null);

  const run = useCallback(async (p: BuscarIATParams) => {
    const cep = (p.cep || "").replace(/\D/g, "");
    const uf = (p.uf || "").trim().toUpperCase();
    if (cep.length !== 8 && !uf) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }
    const body = { ...p, cep: cep.length === 8 ? cep : undefined, uf: cep.length === 8 ? undefined : uf || undefined, cidade: (p.cidade || "").trim() || undefined, busca: (p.busca || "").trim() || undefined };
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-iat-credenciados-buscar", { body });
      if (error) throw error;
      setData(data as BuscarIATResponse);
    } catch (e: any) {
      setError(e?.message || "Erro ao buscar instrutores");
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (params) run(params);
    else { setLoading(false); setError(null); setData(null); }
  }, [params?.cep, params?.uf, params?.cidade, params?.busca, params?.raio_km, params?.limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, data, refetch: run };
}
