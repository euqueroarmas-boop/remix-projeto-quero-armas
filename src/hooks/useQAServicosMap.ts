import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mapa de abreviações curtas para serviços conhecidos (UX em listas compactas).
 * Para qualquer ID novo cadastrado em qa_servicos, usa o nome_servico real do banco.
 */
const SHORT_LABELS: Record<number, string> = {
  2: "Posse PF",
  3: "Porte PF",
  4: "Lions Gun",
  5: "COMBO Autoriz.",
  6: "COMBO CRAF",
  7: "COMBO GTE",
  8: "Apost. Atual.",
  9: "Apost. Mudança",
  10: "Apost. 2º End.",
  11: "Curso Pistola",
  12: "Curso Cal.12",
  13: "Mudança Serv.",
  14: "Reg. Recarga",
  15: "Autoriz. Compra",
  16: "Reg. Arma",
  17: "GTE Avulso",
  18: "GTE",
  20: "CR EB",
  21: "VIP Pistola",
};

let cache: Record<number, string> | null = null;
let inflight: Promise<Record<number, string>> | null = null;

async function fetchServicosMap(): Promise<Record<number, string>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("qa_servicos" as any)
      .select("id, nome_servico");
    const map: Record<number, string> = {};
    ((data as any[]) ?? []).forEach((s: any) => {
      map[s.id] = SHORT_LABELS[s.id] || s.nome_servico || `Serviço #${s.id}`;
    });
    cache = map;
    inflight = null;
    return map;
  })();
  return inflight;
}

export function useQAServicosMap() {
  const [map, setMap] = useState<Record<number, string>>(cache ?? SHORT_LABELS);

  useEffect(() => {
    let active = true;
    fetchServicosMap().then((m) => {
      if (active) setMap(m);
    });
    return () => {
      active = false;
    };
  }, []);

  const getNome = (id: number): string => map[id] || SHORT_LABELS[id] || `Serviço #${id}`;

  return { map, getNome };
}
