import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveServicoFromInteresse, type ServicoCanonico } from "@/lib/quero-armas/servicoSlugMap";

export type SolicitacaoPublica = {
  cadastro_publico_id: string;
  /** ID canônico em qa_solicitacoes_servico (uuid). Null se for fallback legado não materializado. */
  solicitacao_id: string | null;
  /** Status bruto do serviço em qa_solicitacoes_servico (única fonte de verdade). */
  status_servico: string;
  cliente_id_vinculado: number | null;
  servico_interesse: string | null;
  servico: ServicoCanonico;
  origem: "Formulário público";
  status_solicitacao: "Aguardando contratação" | "Aguardando confirmação";
  status_financeiro: "Sem cobrança vinculada";
  status_processo: "Processo ainda não aberto";
  created_at: string;
  /**
   * true SOMENTE quando qa_solicitacoes_servico.status_servico === 'contratado'.
   * NÃO inferir mais por qa_itens_venda, servico_id ou venda existente.
   */
  ja_convertido: boolean;
};

/**
 * Carrega solicitações vindas do formulário público vinculadas ao cliente.
 * Fonte canônica: tabela qa_solicitacoes_servico (origem='formulario_publico').
 * Fallback: projeta qa_cadastro_publico em runtime para registros antigos
 * que ainda não foram materializados em qa_solicitacoes_servico.
 * Nunca inventa pagamento confirmado.
 */
export function useSolicitacoesPublicasDoCliente(
  clienteIdReal: number | null | undefined,
  /** @deprecated Mantido por compatibilidade. Não é mais usado para inferir conversão. */
  _itensVenda?: Array<{ servico_id?: number | null }>,
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
      // 1) Fonte canônica: qa_solicitacoes_servico
      const { data: sols } = await supabase
        .from("qa_solicitacoes_servico" as any)
        .select(
          "id, cliente_id, cadastro_publico_id, servico_id, service_slug, service_name, origem, status_servico, status_financeiro, status_processo, pendente_classificacao, servico_interesse_raw, created_at",
        )
        .eq("cliente_id", clienteIdReal)
        .eq("origem", "formulario_publico")
        .order("created_at", { ascending: false });

      const canonRows = (sols as any[]) ?? [];
      const cadIdsCanon = new Set(canonRows.map((r) => r.cadastro_publico_id).filter(Boolean));

      const fromCanon: SolicitacaoPublica[] = canonRows.map((r) => {
        const ja =
          r.status_servico === "contratado" ||
          (r.servico_id != null && servicoIdsContratados.has(Number(r.servico_id)));
        const servico: ServicoCanonico = {
          slug: r.service_slug,
          nome: r.service_name,
          servico_id: r.servico_id ?? null,
          pendente_classificacao: !!r.pendente_classificacao,
        };
        return {
          cadastro_publico_id: String(r.cadastro_publico_id ?? r.id),
          solicitacao_id: String(r.id),
          status_servico: r.status_servico ?? "aguardando_contratacao",
          cliente_id_vinculado: r.cliente_id ?? null,
          servico_interesse: r.servico_interesse_raw ?? r.service_name,
          servico,
          origem: "Formulário público" as const,
          status_solicitacao:
            r.status_servico === "aguardando_confirmacao"
              ? ("Aguardando confirmação" as const)
              : ("Aguardando contratação" as const),
          status_financeiro: "Sem cobrança vinculada" as const,
          status_processo: "Processo ainda não aberto" as const,
          created_at: r.created_at,
          ja_convertido: ja,
        };
      });

      // 2) Fallback legado: qa_cadastro_publico não materializado
      const { data: legacy } = await supabase
        .from("qa_cadastro_publico" as any)
        .select("id, cliente_id_vinculado, servico_interesse, created_at")
        .eq("cliente_id_vinculado", clienteIdReal)
        .order("created_at", { ascending: false });
      const legacyRows = ((legacy as any[]) ?? []).filter(
        (r) => !cadIdsCanon.has(r.id) && (r.servico_interesse ?? "").toString().trim().length > 0,
      );
      const fromLegacy: SolicitacaoPublica[] = legacyRows.map((r) => {
        const servico = resolveServicoFromInteresse(r.servico_interesse);
        const ja = servico.servico_id != null && servicoIdsContratados.has(servico.servico_id);
          return {
            cadastro_publico_id: String(r.id),
            solicitacao_id: null,
            status_servico: "aguardando_contratacao" as const,
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

      setSolicitacoes([...fromCanon, ...fromLegacy]);
    } finally {
      setLoading(false);
    }
  }, [clienteIdReal, JSON.stringify((itensVenda || []).map((i) => i?.servico_id))]);

  useEffect(() => {
    void load();
  }, [load]);

  return { solicitacoes, loading, reload: load };
}