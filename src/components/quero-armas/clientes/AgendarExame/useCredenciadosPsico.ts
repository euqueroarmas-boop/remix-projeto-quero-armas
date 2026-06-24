import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CredenciadoPsico = {
  id: string;
  tipo: "psicologo" | "instrutor_tiro";
  uf: string;
  cidade: string | null;
  bairro: string | null;
  nome: string;
  registro: string | null;
  endereco: string | null;
  telefones: string[];
  emails: string[];
  validade: string | null;
  validade_label: string | null;
  latitude: number | null;
  longitude: number | null;
  source_url: string;
  distancia_km?: number | null;
};

export type BuscarParams = {
  tipo: "psicologo" | "instrutor_tiro";
  cep?: string;
  uf?: string;
  raio_km?: number;
  limit?: number;
  incluir_vencidos?: boolean;
};

export function useCredenciadosPsico(params: BuscarParams | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CredenciadoPsico[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number; uf: string; cidade: string } | null>(null);
  const [foraDoRaio, setForaDoRaio] = useState(false);
  const [distanciaMaisProximo, setDistanciaMaisProximo] = useState<number | null>(null);

  const run = useCallback(async (p: BuscarParams) => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-psico-credenciados-buscar", { body: p });
      if (error) throw error;
      setResults((data as any)?.results || []);
      setOrigin((data as any)?.origin || null);
      setForaDoRaio(Boolean((data as any)?.fora_do_raio));
      setDistanciaMaisProximo((data as any)?.distancia_mais_proximo ?? null);
    } catch (e: any) {
      setError(e?.message || "Erro ao buscar credenciados");
      setResults([]);
      setForaDoRaio(false);
      setDistanciaMaisProximo(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (params) run(params); }, [params?.tipo, params?.cep, params?.uf, params?.raio_km, params?.incluir_vencidos]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, results, origin, foraDoRaio, distanciaMaisProximo, refetch: run };
}