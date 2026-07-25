// ============================================================================
// pendenciasGrupos.ts
// ----------------------------------------------------------------------------
// Classificação das pendências em GRUPOS temáticos (antecedentes, endereço,
// ocupação lícita, identificação etc.). Usado pelo PendenciasGuiadasPopup e
// pela montagem da fila em QAClientePortalPage para (1) ordenar as etapas por
// grupo e (2) exibir um chip de contexto no header do popup.
// ============================================================================

export type PendenciaGrupoId =
  | "assinaturas"
  | "perguntas"
  | "identificacao"
  | "endereco"
  | "antecedentes"
  | "ocupacao"
  | "habitualidade"
  | "declaracoes"
  | "saude"
  | "arma"
  | "outros";

export interface PendenciaGrupoMeta {
  id: PendenciaGrupoId;
  label: string;
  ordem: number;
}

const GRUPOS: Record<PendenciaGrupoId, PendenciaGrupoMeta> = {
  assinaturas:   { id: "assinaturas",   label: "Assinaturas",              ordem: 10 },
  perguntas:     { id: "perguntas",     label: "Perguntas rápidas",        ordem: 20 },
  identificacao: { id: "identificacao", label: "Identificação",            ordem: 30 },
  endereco:      { id: "endereco",      label: "Comprovação de endereço",  ordem: 40 },
  antecedentes:  { id: "antecedentes",  label: "Antecedentes criminais",   ordem: 50 },
  ocupacao:      { id: "ocupacao",      label: "Ocupação lícita e renda",  ordem: 60 },
  habitualidade: { id: "habitualidade", label: "Habitualidade e clube",    ordem: 70 },
  saude:         { id: "saude",         label: "Aptidão psicológica e técnica", ordem: 80 },
  arma:          { id: "arma",          label: "Documentos da arma",       ordem: 85 },
  declaracoes:   { id: "declaracoes",   label: "Declarações do processo",  ordem: 90 },
  outros:        { id: "outros",        label: "Outros documentos",        ordem: 99 },
};

/**
 * Classifica uma pendência pelo `rawTipo` (tipo_documento cru do checklist)
 * ou, na ausência dele, pelo `hubTipo` canônico.
 */
export function grupoDaPendencia(rawTipo?: string | null, hubTipo?: string | null): PendenciaGrupoMeta {
  const t = String(rawTipo || hubTipo || "").toLowerCase();
  if (!t) return GRUPOS.outros;

  // Endereço
  if (
    t.startsWith("comprovante_endereco") ||
    t.startsWith("comprovante_residencia") ||
    t === "comprovante_de_endereco" ||
    t === "declaracao_residencia_titular" ||
    t.startsWith("declaracao_titular") ||
    t === "documento_identificacao_terceiro" ||
    t.startsWith("titular_comprovante")
  ) {
    return GRUPOS.endereco;
  }

  // Antecedentes criminais / certidões
  if (
    t.startsWith("certidao_antecedentes") ||
    t.startsWith("certidao_crimes") ||
    t.startsWith("certidao_criminal") ||
    t.startsWith("certidao_estadual") ||
    t.startsWith("certidao_federal") ||
    t.startsWith("certidao_tjsp") ||
    t.startsWith("certidao_militar") ||
    t.startsWith("certidao_policia") ||
    t === "pergunta_responde_inquerito_criminal"
  ) {
    return GRUPOS.antecedentes;
  }

  // Ocupação lícita / renda
  if (
    t.startsWith("renda_") ||
    t === "comprovante_renda" ||
    t === "declaracao_ocupacao_licita" ||
    t === "carteira_trabalho" ||
    t === "contracheque" ||
    t === "declaracao_imposto_renda" ||
    t === "contrato_social" ||
    t === "cartao_cnpj"
  ) {
    return GRUPOS.ocupacao;
  }

  // Habitualidade / clube
  if (
    t.startsWith("comprovante_filiacao") ||
    t.startsWith("declaracao_habitualidade") ||
    t.startsWith("declaracao_compromisso_treino") ||
    t.startsWith("declaracao_compromisso_habitualidade") ||
    t === "gt_declaracao" ||
    t.startsWith("gt_")
  ) {
    return GRUPOS.habitualidade;
  }

  // Saúde / aptidão
  if (
    t.startsWith("laudo_psicologico") ||
    t.startsWith("laudo_capacidade_tecnica") ||
    t.startsWith("exame_")
  ) {
    return GRUPOS.saude;
  }

  // Documentos da arma
  if (
    t === "craf" ||
    t.startsWith("craf_") ||
    t.startsWith("nota_fiscal_arma") ||
    t.startsWith("guia_transito") ||
    t.startsWith("autorizacao_")
  ) {
    return GRUPOS.arma;
  }

  // Identificação
  if (
    t === "cin" ||
    t === "rg" ||
    t === "rg_com_cpf" ||
    t === "cnh" ||
    t === "passaporte" ||
    t === "cpf" ||
    t === "certidao_nascimento" ||
    t === "certidao_casamento"
  ) {
    return GRUPOS.identificacao;
  }

  // Declarações do processo (requerimentos, declarações genéricas)
  if (
    t.startsWith("requerimento_") ||
    t.startsWith("declaracao_necessidade") ||
    t.startsWith("declaracao_")
  ) {
    return GRUPOS.declaracoes;
  }

  return GRUPOS.outros;
}

export function ordemGrupo(id: PendenciaGrupoId): number {
  return GRUPOS[id]?.ordem ?? 999;
}

export const PENDENCIA_GRUPOS = GRUPOS;