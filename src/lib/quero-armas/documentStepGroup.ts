// ============================================================================
// documentStepGroup — Agrupamento canônico de etapas para o assistente do
// portal do cliente. Substitui o rótulo legado "Comprovação de endereço"
// (usado como fallback de qualquer item da etapa 1) por um grupo coerente
// com o tipo de documento atual.
// ----------------------------------------------------------------------------
// Fonte da verdade VISUAL apenas — não altera a ordenação da fila guiada
// (essa segue em etapaDoTipoGuia). Os 5 grupos abaixo refletem as etapas
// percebidas pelo cliente; quando o documento não casa com nenhum grupo
// novo, devolvemos um fallback baseado em ETAPA_NOMES_GUIA legado.
// ============================================================================

import { ETAPA_NOMES_GUIA, etapaDoTipoGuia, type GuiaDoc } from "./checklistGuiadoEngine";

export type DocumentStepKey =
  | "identificacao"
  | "endereco"
  | "declaracoes"
  | "certidoes"
  | "assinaturas"
  | "fallback";

export interface DocumentStepGroup {
  stepKey: DocumentStepKey;
  stepLabel: string;
  stepOrder: number;
  /** total exibido no cabeçalho ("Etapa X/Y"). */
  stepTotal: number;
}

const TOTAL_GRUPOS = 5;

function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Mapeia um documento/pergunta/declaração do checklist guiado para um grupo
 * de etapa amigável ao cliente. Caso não case com nenhum grupo, devolve um
 * fallback derivado do etapaDoTipoGuia legado para não exibir rótulo errado.
 */
export function getDocumentStepGroup(
  documento: Pick<GuiaDoc, "tipo_documento" | "nome_documento"> | null | undefined,
): DocumentStepGroup {
  const tipo = normalize(documento?.tipo_documento);
  const nome = normalize(documento?.nome_documento);
  const blob = `${tipo} ${nome}`;

  // 1) Identificação — RG/CNH/CPF/identidade
  if (
    tipo === "cnh" ||
    tipo === "rg" ||
    tipo === "rg_com_cpf" ||
    tipo === "cin" ||
    tipo === "cpf" ||
    tipo === "documento_identidade" ||
    /\b(cnh|rg|cin|cpf)\b/.test(blob) ||
    blob.includes("identidade") ||
    blob.includes("identificacao")
  ) {
    return { stepKey: "identificacao", stepLabel: "Identificação", stepOrder: 1, stepTotal: TOTAL_GRUPOS };
  }

  // 2) Comprovação de endereço
  if (
    tipo.includes("endereco") ||
    tipo.includes("residenc") ||
    tipo === "pergunta_comprovante_em_nome" ||
    tipo === "pergunta_ainda_reside_imovel" ||
    tipo === "declaracao_responsavel_imovel" ||
    blob.includes("comprovante de endereco") ||
    blob.includes("comprovante de residencia")
  ) {
    return { stepKey: "endereco", stepLabel: "Comprovação de endereço", stepOrder: 2, stepTotal: TOTAL_GRUPOS };
  }

  // 3) Declarações obrigatórias
  if (
    tipo === "declaracao_sem_inquerito_processo_criminal" ||
    tipo === "pergunta_responde_inquerito_criminal" ||
    tipo === "declaracao_idoneidade" ||
    tipo.startsWith("declaracao_idoneidade") ||
    blob.includes("nao responder a inquerito") ||
    blob.includes("nao responde a inquerito") ||
    blob.includes("inquerito") ||
    blob.includes("idoneidade")
  ) {
    return { stepKey: "declaracoes", stepLabel: "Declarações obrigatórias", stepOrder: 3, stepTotal: TOTAL_GRUPOS };
  }

  // 4) Certidões
  if (
    tipo.startsWith("certidao") ||
    blob.includes("certidao de antecedentes") ||
    blob.includes("antecedentes criminais") ||
    blob.includes("nada consta") ||
    blob.includes("certidao")
  ) {
    return { stepKey: "certidoes", stepLabel: "Certidões", stepOrder: 4, stepTotal: TOTAL_GRUPOS };
  }

  // 5) Assinaturas e declarações (contrato, Gov.br, assinatura)
  if (
    blob.includes("contrato") ||
    blob.includes("assinatura") ||
    blob.includes("gov.br") ||
    blob.includes("govbr") ||
    tipo.startsWith("dsa_") ||
    tipo.includes("compromisso")
  ) {
    return { stepKey: "assinaturas", stepLabel: "Assinaturas e declarações", stepOrder: 5, stepTotal: TOTAL_GRUPOS };
  }

  // Fallback — preserva rótulo legado da etapa numérica para não regredir
  const etapaLegada = documento ? etapaDoTipoGuia(documento.tipo_documento ?? "") : 1;
  const labelLegado = ETAPA_NOMES_GUIA[etapaLegada] ?? "Documentação";
  return {
    stepKey: "fallback",
    stepLabel: labelLegado,
    stepOrder: Math.max(1, Math.min(TOTAL_GRUPOS, etapaLegada)),
    stepTotal: TOTAL_GRUPOS,
  };
}

/** Slug simples para nome de arquivo amigável. */
export function slugifyParaArquivo(s: string | null | undefined): string {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}