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
  | "efetiva_necessidade"
  | "saude"
  | "requerimento"
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
  ocupacao:      { id: "ocupacao",      label: "Ocupação lícita e renda",  ordem: 50 },
  antecedentes:  { id: "antecedentes",  label: "Antecedentes criminais",   ordem: 60 },
  habitualidade: { id: "habitualidade", label: "Habitualidade e clube",    ordem: 70 },
  arma:          { id: "arma",          label: "Documentos da arma",       ordem: 72 },
  declaracoes:   { id: "declaracoes",   label: "Declarações do processo",  ordem: 75 },
  // ─── Os três últimos, nesta ordem (usuário, 01/08/2026) ───────────────
  // A efetiva necessidade PRECEDE os laudos: é ela que justifica o pedido, e
  // o cliente só marca os exames depois de saber que o caso se sustenta.
  // O requerimento fecha o processo — é a peça que consolida tudo.
  efetiva_necessidade: { id: "efetiva_necessidade", label: "Efetiva necessidade", ordem: 80 },
  saude:         { id: "saude",         label: "Aptidão psicológica e técnica", ordem: 90 },
  requerimento:  { id: "requerimento",  label: "Requerimento",             ordem: 95 },
  outros:        { id: "outros",        label: "Outros documentos",        ordem: 99 },
};

/**
 * Classifica uma pendência pelo `rawTipo` (tipo_documento cru do checklist)
 * ou, na ausência dele, pelo `hubTipo` canônico.
 */
export function grupoDaPendencia(rawTipo?: string | null, hubTipo?: string | null): PendenciaGrupoMeta {
  const t = String(rawTipo || hubTipo || "").toLowerCase();
  if (!t) return GRUPOS.outros;

  // Perguntas do checklist entram no MESMO grupo temático do assunto que elas
  // destravam — nunca num bloco solto de "perguntas".
  if (t.startsWith("pergunta_")) {
    if (
      t.includes("reside") ||
      t.includes("endereco") ||
      t.includes("comprovante_em_nome") ||
      t.includes("imovel")
    ) return GRUPOS.endereco;
    if (t.includes("inquerito") || t.includes("criminal")) return GRUPOS.antecedentes;
    if (t.includes("habitualidade") || t.includes("cac") || t.includes("clube")) return GRUPOS.habitualidade;
    if (t.includes("renda") || t.includes("condicao") || t.includes("ocupacao")) return GRUPOS.ocupacao;
    if (t.includes("arma") || t.includes("acervo")) return GRUPOS.arma;
    return GRUPOS.perguntas;
  }
  if (t === "renda_definir_condicao") return GRUPOS.ocupacao;

  // Endereço
  if (
    t.startsWith("comprovante_endereco") ||
    t.startsWith("comprovante_residencia") ||
    t === "comprovante_de_endereco" ||
    t === "declaracao_residencia_titular" ||
    t.startsWith("declaracao_titular") ||
    t === "declaracao_responsavel_imovel" ||
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
  // identidade_funcional prova vínculo institucional (PM/PF/etc.) — é documento
  // de ocupação lícita (etapa 2), não substitui identidade civil (RG/CIN/CNH).
  if (
    t.startsWith("renda_") ||
    t === "comprovante_renda" ||
    t === "declaracao_ocupacao_licita" ||
    t === "carteira_trabalho" ||
    t === "contracheque" ||
    t === "declaracao_imposto_renda" ||
    t === "contrato_social" ||
    t === "cartao_cnpj" ||
    t === "identidade_funcional" ||
    t.includes("identidade_funcional") ||
    t.includes("credencial_digital") ||
    t.includes("funcional_digital")
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
    t === "documento_identidade_nacional" ||
    t === "carteira_identidade_nacional" ||
    t === "cedula_identidade_rg_com_cpf" ||
    t === "rg" ||
    t === "rg_com_cpf" ||
    t === "cnh" ||
    t === "passaporte" ||
    t === "cpf" ||
    // A foto 3x4 é peça de IDENTIFICAÇÃO. Caindo em "outros" (ordem 99) ela ia
    // para o fim da fila e o portal pedia certidões antes — contrariando a
    // ordem do catálogo (Montar Checklist), onde a foto é ordem 2.
    t === "foto_3x4" ||
    t === "foto" ||
    t.startsWith("foto_3x4") ||
    t === "certidao_nascimento" ||
    t === "certidao_casamento"
  ) {
    return GRUPOS.identificacao;
  }

  // Efetiva necessidade — grupo próprio, ANTES dos laudos.
  // Precisa vir antes do teste genérico de `declaracao_`, senão cairia nas
  // declarações do processo, que é onde estava.
  if (
    t.startsWith("declaracao_necessidade") ||
    t.startsWith("comprovante_efetiva_necessidade") ||
    t.includes("efetiva_necessidade")
  ) {
    return GRUPOS.efetiva_necessidade;
  }

  // Requerimento — último grupo. Também sai das declarações genéricas.
  if (t.startsWith("requerimento_") || t === "requerimento" || t.includes("sinarm_requerimento")) {
    return GRUPOS.requerimento;
  }

  // Declarações do processo (as genéricas que sobraram)
  if (t.startsWith("declaracao_")) {
    return GRUPOS.declaracoes;
  }

  return GRUPOS.outros;
}

export function ordemGrupo(id: PendenciaGrupoId): number {
  return GRUPOS[id]?.ordem ?? 999;
}

export const PENDENCIA_GRUPOS = GRUPOS;
