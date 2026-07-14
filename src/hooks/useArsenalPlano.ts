import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ArsenalPlano {
  id: string;
  nome: string;
  descricao: string | null;
  valor_anual: number;
  parcelas_max: number;
}

const FALLBACK: ArsenalPlano = {
  id: "",
  nome: "Arsenal Inteligente Premium",
  descricao: null,
  valor_anual: 297,
  parcelas_max: 12,
};

export function useArsenalPlano() {
  const [plano, setPlano] = useState<ArsenalPlano>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("qa_arsenal_planos" as any)
        .select("id, nome, descricao, valor_anual, parcelas_max")
        .eq("ativo", true)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) setPlano(data as unknown as ArsenalPlano);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const valorParcela = Math.round((plano.valor_anual / plano.parcelas_max) * 100) / 100;

  return { plano, valorParcela, loading };
}
