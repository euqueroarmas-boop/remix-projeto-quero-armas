// Status da assinatura Arsenal Inteligente Premium do cliente logado.
// A tabela qa_arsenal_assinaturas tem RLS owner (qa_current_cliente_id),
// então a query só enxerga as linhas do próprio cliente.
//
// Regra de acesso: liberado enquanto status ∈ {gratuidade, ativa} e
// periodo_fim + 3 dias de carência ainda não passou. Fora disso, as
// funcionalidades Premium ficam esmaecidas com CTA de assinatura.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ArsenalAssinatura {
  id: string;
  status: "gratuidade" | "aguardando_pagamento" | "ativa" | "suspensa" | "cancelada";
  origem_gratuidade: "assinatura_direta" | "servico_contratado" | null;
  periodo_inicio: string;
  periodo_fim: string;
  forma_pagamento: "CREDIT_CARD" | "PIX" | "BOLETO" | null;
  valor_anual: number;
  asaas_invoice_url: string | null;
}

export interface ArsenalPremiumState {
  loading: boolean;
  assinatura: ArsenalAssinatura | null;
  /** true = funcionalidades Premium acessíveis */
  liberado: boolean;
  /** dias até o fim do período (negativo = vencido); null sem assinatura */
  diasRestantes: number | null;
  refresh: () => void;
}

const CARENCIA_DIAS = 3;

function diasAte(dateISO: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(`${dateISO}T00:00:00`);
  return Math.floor((v.getTime() - hoje.getTime()) / 86400000);
}

export function useArsenalPremium(clienteId: number | string | null | undefined): ArsenalPremiumState {
  const [loading, setLoading] = useState(true);
  const [assinatura, setAssinatura] = useState<ArsenalAssinatura | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!clienteId) { setLoading(false); setAssinatura(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("qa_arsenal_assinaturas" as any)
        .select("id, status, origem_gratuidade, periodo_inicio, periodo_fim, forma_pagamento, valor_anual, asaas_invoice_url")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("[useArsenalPremium] falha ao carregar assinatura:", error.message);
        setAssinatura(null);
      } else {
        setAssinatura((data as unknown as ArsenalAssinatura) || null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clienteId, reloadKey]);

  const diasRestantes = assinatura ? diasAte(assinatura.periodo_fim) : null;
  const liberado =
    !!assinatura &&
    (assinatura.status === "gratuidade" || assinatura.status === "ativa") &&
    diasRestantes !== null &&
    diasRestantes >= -CARENCIA_DIAS;

  return { loading, assinatura, liberado, diasRestantes, refresh };
}
