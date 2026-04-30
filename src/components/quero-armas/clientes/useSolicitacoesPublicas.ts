import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveServicoFromInteresse, type ServicoCanonico } from "@/lib/quero-armas/servicoSlugMap";

export type SolicitacaoPublica = {
  cadastro_publico_id: string;
  cliente_id_vinculado: number | null;
  servico_interesse: string | null;
  servico: ServicoCanonico;
  origem: "Formulário público";
  status_solicitacao: "Aguardando contratação" | "Aguardando confirmação";
  status_financeiro: "Sem cobrança vinculada";
  status_processo: "Processo ainda não aberto";
  created_at: string;
  /** true quando já existe um qa_itens_venda do mesmo serviço para o mesmo cliente — não exibir como solicitação solta. */
  ja_convertido: boolean;
};

/**
 * Carrega solicitações vindas do formulário público vinculadas ao cliente.
 * Não cria registros: apenas projeta o que já existe em qa_cadastro_publico
 * para a aba Serviços, com status real (sem inventar pagamento confirmado).
 */
export function useSolicitacoesPublicasDoCliente(
  clienteIdReal: number | null | undefined,
  itensVenda: Array<{ servico_id?: number | null }>,
) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPublica[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!clienteIdReal) {
      setSolicitacoes([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("qa_cadastro_publico" as any)
        .select("id, cliente_id_vinculado, servico_interesse, created_at")
        .eq("cliente_id_vinculado", clienteIdReal)
        .order("created_at", { ascending: false });
      const rows = (data as any[]) ?? [];
      const servicoIdsContratados = new Set(
        (itensVenda || [])
          .map((i) => Number(i?.servico_id))
          .filter((n) => Number.isFinite(n)),
      );
      const result: SolicitacaoPublica[] = rows
        .filter((r) => (r.servico_interesse ?? "").toString().trim().length > 0)
        .map((r) => {
          const servico = resolveServicoFromInteresse(r.servico_interesse);
          const ja = servico.servico_id != null && servicoIdsContratados.has(servico.servico_id);
          return {
            cadastro_publico_id: String(r.id),
            cliente_id_vinculado: r.cliente_id_vinculado ?? null,
            servico_interesse: r.servico_interesse ?? null,
            servico,
            origem: "Formulário público" as const,
            status_solicitacao: "Aguardando contratação" as const,
            status_financeiro: "Sem cobrança vinculada" as const,
            status_processo: "Processo ainda não aberto" as const,
            created_at: r.created_at,
            ja_convertido: ja,
          };
        });
      setSolicitacoes(result);
    } finally {
      setLoading(false);
    }
  }, [clienteIdReal, JSON.stringify((itensVenda || []).map((i) => i?.servico_id))]);

  useEffect(() => {
    void load();
  }, [load]);

  return { solicitacoes, loading, reload: load };
}