// ============================================================================
// useCircunscricaoPF — qual unidade da PF atende o endereço do cliente
// ----------------------------------------------------------------------------
// Duas telas precisam da mesma resposta e não podem discordar:
//
//   * O roteiro do requerimento, onde o cliente escolhe a "Unidade de
//     Atendimento" na última aba do SINARM — escolher errado manda o processo
//     para outra cidade.
//   * O painel do protocolo, que responde "em qual delegacia está o meu
//     processo" depois de protocolado.
//
// A resposta sai de `qa_resolver_circunscricao_pf`, a mesma função que a equipe
// já usa no admin. Nada de heurística nova aqui: uma fonte, duas telas.
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CircunscricaoPF {
  unidade_pf?: string | null;
  sigla_unidade?: string | null;
  tipo_unidade?: string | null;
  municipio_sede?: string | null;
  uf?: string | null;
}

/** Rótulo curto para exibir: "SIGLA — Nome da unidade". */
export function rotuloCircunscricao(circ?: CircunscricaoPF | null): string | null {
  if (!circ) return null;
  const sigla = String(circ.sigla_unidade ?? "").trim();
  const nome = String(circ.unidade_pf ?? "").trim();
  if (sigla && nome) return `${sigla} — ${nome}`;
  return sigla || nome || null;
}

export function useCircunscricaoPF(
  cidade?: string | null,
  uf?: string | null,
): CircunscricaoPF | null {
  const [circ, setCirc] = useState<CircunscricaoPF | null>(null);
  const cidadeNorm = String(cidade ?? "").replace(/\s+/g, " ").trim();
  const ufNorm = String(uf ?? "").trim().toUpperCase();

  useEffect(() => {
    if (!cidadeNorm || !ufNorm) {
      setCirc(null);
      return;
    }
    let vivo = true;
    void (async () => {
      try {
        const { data } = await supabase.rpc("qa_resolver_circunscricao_pf" as never, {
          p_municipio: cidadeNorm,
          p_uf: ufNorm,
        } as never);
        if (!vivo) return;
        setCirc(Array.isArray(data) ? ((data[0] as CircunscricaoPF) ?? null) : null);
      } catch {
        // Sem circunscrição as telas caem no texto genérico — nunca ficam sem
        // instrução por causa de uma consulta que falhou.
        if (vivo) setCirc(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cidadeNorm, ufNorm]);

  return circ;
}
