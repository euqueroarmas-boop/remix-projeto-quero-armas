// ============================================================================
// _shared/reconciliarNomeAprovada.ts
// ----------------------------------------------------------------------------
// Helpers compartilhados entre qa-processo-doc-validar-ia (aprovação automática
// da IA) e qa-doc-acao-equipe (aprovação manual da equipe) para fechar o ciclo
// de "alteração de nome em cartório":
//   1) gravarAlteracaoNomeNoProcesso → registra/atualiza
//      respostas_questionario_json.alteracao_nome em qa_processos.
//   2) reconciliarDivergenciasNomeAprovada → varre os outros documentos do
//      processo, remove a divergência de nome quando o valor do documento ou
//      do cadastro bate com algum dos nomes aceitos (anterior/atual), e move
//      o documento para revisao_humana se essa era a última divergência.
// Mantém comportamento idêntico ao que já estava embutido em
// qa-processo-doc-validar-ia. NÃO sobrescreve qa_clientes.nome_completo.
// ============================================================================

export function normalizarNomePessoa(s: any): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function campoEhNome(campo: any): boolean {
  return ["nome", "nome_titular", "titular", "nome_completo"].includes(
    String(campo || "").toLowerCase(),
  );
}

export async function reconciliarDivergenciasNomeAprovada(
  supabase: any,
  processoId: string,
  nomesAceitosRaw: any[],
  certidaoDocumentoId: string,
) {
  const aceitos = new Set(
    nomesAceitosRaw.map(normalizarNomePessoa).filter(Boolean),
  );
  if (aceitos.size === 0) return;
  const { data: docs } = await supabase
    .from("qa_processo_documentos")
    .select("id, tipo_documento, nome_documento, status, motivo_rejeicao, divergencias_json")
    .eq("processo_id", processoId)
    .neq("tipo_documento", "certidao_alteracao_nome");
  for (const d of docs ?? []) {
    const divs = Array.isArray(d?.divergencias_json) ? d.divergencias_json : [];
    if (divs.length === 0) continue;
    let removeuNome = false;
    const restantes = divs.filter((x: any) => {
      if (!campoEhNome(x?.campo)) return true;
      const valorDoc = normalizarNomePessoa(x?.valor_documento ?? x?.encontrado);
      const valorCad = normalizarNomePessoa(x?.valor_cadastro ?? x?.esperado);
      const compativel =
        (valorDoc && aceitos.has(valorDoc)) ||
        (valorCad && aceitos.has(valorCad));
      if (compativel) {
        removeuNome = true;
        return false;
      }
      return true;
    });
    if (!removeuNome) continue;
    const update: Record<string, any> = {
      divergencias_json: restantes,
      campos_complementares_json: {
        nome_justificado_por_certidao: true,
        certidao_alteracao_nome_id: certidaoDocumentoId,
      },
    };
    if (
      restantes.length === 0 &&
      String(d.status || "").toLowerCase() === "divergente"
    ) {
      update.status = "revisao_humana";
      update.motivo_rejeicao = null;
      update.validacao_ia_status = "revisao_humana";
    } else if (restantes.length > 0) {
      update.motivo_rejeicao =
        "Divergência entre o documento e seu cadastro: " +
        restantes.map((x: any) => x.campo).join(", ");
    }
    await supabase.from("qa_processo_documentos").update(update).eq("id", d.id);
    await supabase.from("qa_processo_eventos").insert({
      processo_id: processoId,
      documento_id: d.id,
      tipo_evento: "divergencia_nome_justificada",
      descricao:
        restantes.length === 0
          ? "Divergência de nome removida por certidão averbada aprovada; documento enviado para conferência."
          : "Divergência de nome removida por certidão averbada aprovada; demais divergências permanecem.",
      ator: "sistema",
      dados_json: {
        certidao_documento_id: certidaoDocumentoId,
        divergencias_restantes: restantes.map((x: any) => x.campo),
      },
    } as any);
  }
}

/**
 * Faz merge do bloco `alteracao_nome` em
 * qa_processos.respostas_questionario_json. Usa exatamente o mesmo formato que
 * qa-processo-doc-validar-ia já grava quando a IA aprova a certidão.
 */
export async function gravarAlteracaoNomeNoProcesso(
  supabase: any,
  processoId: string,
  args: {
    aprovada: boolean;
    nome_anterior: string | null;
    nome_atual: string | null;
    certidaoDocumentoId: string;
    tipo_certidao?: string | null;
    data_averbacao?: string | null;
    cartorio_registro?: string | null;
    origem?: string;
  },
) {
  if (!args.nome_anterior || !args.nome_atual) return;
  const { data: processo } = await supabase
    .from("qa_processos")
    .select("respostas_questionario_json")
    .eq("id", processoId)
    .maybeSingle();
  const respostas: Record<string, any> =
    (processo?.respostas_questionario_json as Record<string, any>) ?? {};
  respostas.alteracao_nome = {
    ...(respostas.alteracao_nome ?? {}),
    aprovada: args.aprovada,
    pendente_aprovacao: !args.aprovada,
    nome_anterior: args.nome_anterior,
    nome_atual: args.nome_atual,
    documento_id: args.certidaoDocumentoId,
    tipo_certidao: args.tipo_certidao ?? respostas.alteracao_nome?.tipo_certidao ?? null,
    data_averbacao: args.data_averbacao ?? respostas.alteracao_nome?.data_averbacao ?? null,
    cartorio_registro:
      args.cartorio_registro ?? respostas.alteracao_nome?.cartorio_registro ?? null,
    tipo_documento_comprobatorio: "certidao_alteracao_nome",
    documento_comprobatorio_id: args.certidaoDocumentoId,
    data_validacao: new Date().toISOString(),
    origem: args.origem ?? "equipe",
  };
  await supabase
    .from("qa_processos")
    .update({ respostas_questionario_json: respostas })
    .eq("id", processoId);
}