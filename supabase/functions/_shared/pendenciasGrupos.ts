// ============================================================================
// pendenciasGrupos.ts
// ----------------------------------------------------------------------------
// Classificação das pendências em GRUPOS temáticos (antecedentes, endereço,
// ocupação lícita, identificação etc.). Usado pelo PendenciasGuiadasPopup e
// pela montagem da fila em QAClientePortalPage para (1) ordenar as etapas por
// grupo e (2) exibir um chip de contexto no header do popup.
// ============================================================================

export type PendenciaGrupoId =
  | "exigencias_pf"
  | "assinaturas"
  | "perguntas"
  | "identificacao"
  | "endereco"
  | "antecedentes"
  | "ocupacao"
  | "habitualidade"
  | "declaracoes"
  | "efetiva_necessidade"
  | "laudos"
  | "requerimento"
  | "arma"
  | "outros";

export interface PendenciaGrupoMeta {
  id: PendenciaGrupoId;
  label: string;
  ordem: number;
}

// Sequência canônica para compra/posse (e demais serviços civis):
// Contratos → Cadastros → Ident. civil → Ident. residencial → Ocupação lícita
// → Idoneidade → Efetiva necessidade → Laudos → Requerimento → Fechamento
// Habitualidade fica entre Idoneidade e Arma, mas é filtrada para compra/posse.
const GRUPOS: Record<PendenciaGrupoId, PendenciaGrupoMeta> = {
  // A PF PASSA NA FRENTE DE TUDO. Quando a delegacia notifica, corre prazo
  // fatal de 10 dias e o requerimento é arquivado se ninguém responder. Um
  // contrato pendente ou uma certidão vencendo em 20 dias podem esperar; isto
  // não pode. Por isso ordem 5, antes até das assinaturas.
  exigencias_pf: { id: "exigencias_pf", label: "Exigências da Polícia Federal", ordem: 5 },
  assinaturas:   { id: "assinaturas",   label: "Contratos",                ordem: 10 },
  perguntas:     { id: "perguntas",     label: "Cadastros",                ordem: 20 },
  identificacao: { id: "identificacao", label: "Identificação civil",      ordem: 30 },
  endereco:      { id: "endereco",      label: "Identificação residencial", ordem: 40 },
  ocupacao:      { id: "ocupacao",      label: "Ocupação lícita",          ordem: 50 },
  antecedentes:  { id: "antecedentes",  label: "Idoneidade",               ordem: 60 },
  habitualidade: { id: "habitualidade", label: "Habitualidade e clube",    ordem: 70 },
  arma:          { id: "arma",          label: "Documentos da arma",       ordem: 72 },
  declaracoes:   { id: "declaracoes",   label: "Declarações do processo",  ordem: 75 },
  // Efetiva necessidade PRECEDE os laudos: é ela que justifica o pedido, e
  // o cliente só marca os exames depois de saber que o caso se sustenta.
  // O requerimento fecha o processo — é a peça que consolida tudo.
  efetiva_necessidade: { id: "efetiva_necessidade", label: "Efetiva necessidade", ordem: 80 },
  laudos:        { id: "laudos",        label: "Laudos",                   ordem: 90 },
  requerimento:  { id: "requerimento",  label: "Requerimento",             ordem: 95 },
  outros:        { id: "outros",        label: "Fechamento",               ordem: 99 },
};

/**
 * Normaliza IDs legados que possam ter sido gravados no banco antes da renomeação.
 * "saude" → "laudos" (renomeado em 06/08/2026 — laudo de tiro ≠ saúde).
 */
export function normalizarGrupoId(raw: string | null | undefined): PendenciaGrupoId | null {
  if (!raw) return null;
  if (raw === "saude") return "laudos";
  return GRUPOS[raw as PendenciaGrupoId] ? (raw as PendenciaGrupoId) : null;
}

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
    // Catálogo real usa o prefixo `antecedentes_` (eleitoral, militar, federal,
    // estadual, criminais…). Sem esta regra tudo caía em "Fechamento".
    t.startsWith("antecedentes") ||
    t.startsWith("certidao_antecedentes") ||
    t.startsWith("certidao_crimes") ||
    t.startsWith("certidao_criminal") ||
    t.startsWith("certidao_estadual") ||
    t.startsWith("certidao_federal") ||
    t.startsWith("certidao_tjsp") ||
    t.startsWith("certidao_militar") ||
    t.startsWith("certidao_policia") ||
    t === "pergunta_responde_inquerito_criminal" ||
    // Declaração de não responder inquérito/processo criminal é IDONEIDADE,
    // não uma declaração genérica do processo.
    t.startsWith("declaracao_sem_inquerito") ||
    t.startsWith("declaracao_idoneidade") ||
    // Homonímia é IDONEIDADE: ela existe porque apareceu registro criminal de
    // um xará nas certidões. Caía em "Declarações do processo" pelo prefixo
    // `declaracao_` e, com isso, sumia da fila do cliente em todo serviço cujo
    // whitelist não tem o grupo `declaracoes` — justamente uma das exigências
    // que a PF mais faz depois de protocolado.
    t === "declaracao_homonimia" ||
    t.startsWith("declaracao_homonimia") ||
    t.includes("inquerito")
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
    t === "ctps" ||
    t === "contracheque" ||
    t === "contra_cheque_digital" ||
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

  // Laudos (psicológico, capacidade técnica, tiro)
  if (
    t.startsWith("laudo_psicologico") ||
    t.startsWith("laudo_capacidade_tecnica") ||
    t.startsWith("exame_") ||
    t.startsWith("exames_") ||
    t.startsWith("atestado_aptidao") ||
    t.startsWith("atestado_capacidade_tecnica")
  ) {
    return GRUPOS.laudos;
  }

  // Documentos da arma
  if (
    t === "craf" ||
    t.startsWith("craf_") ||
    t.startsWith("nota_fiscal_arma") ||
    t.startsWith("guia_transito") ||
    t.startsWith("autorizacao_") ||
    // Acervo (universo CAC): DSA, DEGA e guarda responsável.
    t.startsWith("dsa_") ||
    t === "declaracao_endereco_acervo" ||
    t === "declaracao_guarda_responsavel" ||
    t.includes("acervo")
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
  // A GRU e o acesso ao gov.br entram aqui de propósito: são a mesma etapa da
  // vida do processo (gerar o requerimento, pagar a taxa, liberar o acesso,
  // assinar a juntada), e separá-los espalharia um passo só por vários grupos
  // diferentes no checklist do cliente. Boleto e comprovante são itens
  // distintos no dossiê, mas moram no mesmo grupo do checklist.
  if (
    t.startsWith("requerimento_") ||
    t === "requerimento" ||
    t.includes("sinarm_requerimento") ||
    t === "gru" ||
    t === "gru_boleto" ||
    t === "gru_comprovante" ||
    t === "gru_paga" ||
    t === "credencial_gov_br" ||
    t === "juntada_assinada" ||
    t === "senha_gov_br" ||
    t === "acesso_gov_br"
  ) {
    return GRUPOS.requerimento;
  }

  // Contratos / procurações — peças de adesão, primeiro grupo.
  if (
    t.startsWith("procuracao") ||
    t.startsWith("contrato_") ||
    t === "contrato" ||
    t === "contrato_assinado" ||
    t === "comprovante_pagamento"
  ) {
    return GRUPOS.assinaturas;
  }

  // Segundo endereço de guarda — pertence à identificação residencial.
  if (t.includes("segundo_endereco")) {
    return GRUPOS.endereco;
  }

  // Declarações do processo (as genéricas que sobraram)
  if (t.startsWith("declaracao_")) {
    return GRUPOS.declaracoes;
  }

  return GRUPOS.outros;
}

/**
 * Grupo de um ITEM de checklist (linha de `qa_processo_documentos`), e não de
 * um tipo solto.
 *
 * DIFERENÇA QUE IMPORTA: `grupoDaPendencia` classifica pelo `tipo_documento`,
 * e há um grupo que NENHUM tipo produz — `exigencias_pf`. Ele é gravado em
 * `regra_validacao.grupo_checklist` por `qa-manifestacao-analisar` quando a
 * Polícia Federal exige algo depois do protocolo, e é o grupo de ordem 5, o
 * que passa na frente de tudo.
 *
 * Classificar essas linhas só pelo tipo jogava a exigência da PF no grupo
 * temático do documento (`craf` → Arma, `declaracao_homonimia` → Declarações),
 * e aí o filtro por serviço as escondia do cliente — com prazo fatal de 10
 * dias correndo e o processo travado sem ninguém ser avisado.
 *
 * Use SEMPRE esta função quando houver a linha inteira em mãos.
 */
export function grupoDaPendenciaDoItem(
  item:
    | { tipo_documento?: string | null; regra_validacao?: unknown }
    | null
    | undefined,
  hubTipo?: string | null,
): PendenciaGrupoMeta {
  const regra = item?.regra_validacao as { grupo_checklist?: unknown } | null | undefined;
  const explicito = normalizarGrupoId(
    typeof regra?.grupo_checklist === "string" ? regra.grupo_checklist : null,
  );
  if (explicito) return GRUPOS[explicito];
  return grupoDaPendencia(item?.tipo_documento ?? null, hubTipo ?? null);
}

/**
 * Grupos que NUNCA podem ser filtrados por serviço.
 *
 * O que a PF exige não é opcional e não pertence ao catálogo do serviço — ela
 * pede o que quer, quando quer, e o cliente tem 10 dias para responder sob
 * pena de arquivamento. Whitelist de serviço não tem autoridade sobre isso.
 */
export const GRUPOS_NAO_FILTRAVEIS: ReadonlySet<PendenciaGrupoId> = new Set<PendenciaGrupoId>([
  "exigencias_pf",
]);

export function ordemGrupo(id: PendenciaGrupoId): number {
  return GRUPOS[id]?.ordem ?? 999;
}

export const PENDENCIA_GRUPOS = GRUPOS;
