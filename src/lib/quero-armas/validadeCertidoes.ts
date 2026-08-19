/* =============================================================================
 * VALIDADE DAS CERTIDÕES DE ANTECEDENTES — tabela única
 * -----------------------------------------------------------------------------
 * POR QUE ESTE MÓDULO EXISTE (19/08/2026).
 *
 * A validade de uma certidão era decidida em dois lugares que não se conheciam:
 *
 *   1. O PARSER, quando o próprio PDF declara o prazo. Três órgãos declaram:
 *        • TRF3  — "no prazo de 90 (noventa) dias"   → vale para SJSP/JEF e Regional
 *        • STM   — "válida por N dias"
 *        • TJM/SP— "PRAZO DE N (...)"
 *      Onde o parser lê, o que está impresso manda — e é assim que tem de ser.
 *
 *   2. A REGRA DE FALLBACK, quando o parser não conseguiu ler o prazo (modelo
 *      de PDF diferente, texto quebrado, salvamento do navegador).
 *
 * O DEFEITO. A regra de fallback classificava `antecedentes_federal_sjsp_jef`
 * junto das certidões SEM prazo impresso (1 mês), embora ela seja o MESMO
 * documento do mesmo tribunal que `antecedentes_federal_trf3_regional`, ao qual
 * a regra dá 90 dias. Resultado no acervo, medido em 19/08/2026:
 *
 *   • 5 arquivos de SJSP/JEF com 90 dias  → o parser leu o prazo do PDF
 *   • 2 arquivos de SJSP/JEF com 31 dias  → o parser falhou e o fallback errou
 *
 * Dois clientes com a mesma certidão do mesmo tribunal, um valendo 90 dias e o
 * outro 31, decidido por o texto do PDF ter sido legível ou não. O cliente do
 * fallback seria cobrado de reemissão dois meses antes da hora.
 *
 * A TABELA ABAIXO É O FALLBACK, e segue o critério do usuário:
 *   • certidão que TRAZ a validade impressa  → 90 dias
 *   • certidão que NÃO traz                  → 30 dias (um mês)
 *
 * O prazo lido do próprio documento continua tendo precedência sobre isto.
 * Esta tabela só responde quando a leitura falha.
 * ============================================================================= */

/** Certidões cujo documento declara o próprio prazo — 90 dias. */
export const CERTIDOES_90_DIAS: ReadonlySet<string> = new Set([
  // TRF3 — as duas certidões saem do mesmo emissor e do mesmo parser.
  "antecedentes_federal_trf3_regional",
  "antecedentes_federal_sjsp_jef",
  // Justiça Militar da União (STM) e estadual (TJM/SP).
  "antecedentes_militar",
  "antecedentes_militar_estadual",
]);

/** Certidões sem prazo impresso — valem um mês da emissão. */
export const CERTIDOES_UM_MES: ReadonlySet<string> = new Set([
  "antecedentes_criminais", // SSP / Polícia Civil
  "antecedentes_estadual_distribuicao", // TJSP — ações criminais
  "antecedentes_estadual_execucoes", // TJSP — execuções criminais
  "antecedentes_eleitoral", // TSE
  // Genéricos herdados, mantidos por compatibilidade de dados antigos.
  "antecedentes_federal",
  "antecedentes_estadual",
]);

export type RegraValidadeCertidao = "90_dias" | "um_mes" | null;

/**
 * Qual regra de fallback vale para este tipo de certidão?
 * `null` quando o tipo não é certidão de antecedentes.
 */
export function regraValidadeCertidao(tipo?: string | null): RegraValidadeCertidao {
  const t = String(tipo ?? "").trim().toLowerCase();
  if (CERTIDOES_90_DIAS.has(t)) return "90_dias";
  if (CERTIDOES_UM_MES.has(t)) return "um_mes";
  return null;
}

/**
 * Prazo em dias para o catálogo (`qa_servicos_documentos.validade_dias`).
 *
 * O catálogo guarda DIAS, não "um mês" — por isso o mês vira 30 aqui. A data
 * real no acervo continua sendo calculada por mês de calendário, que é o que
 * o cliente entende: emitiu dia 10, vale até dia 10.
 */
export function prazoCatalogoCertidao(tipo?: string | null): number | null {
  switch (regraValidadeCertidao(tipo)) {
    case "90_dias":
      return 90;
    case "um_mes":
      return 30;
    default:
      return null;
  }
}
