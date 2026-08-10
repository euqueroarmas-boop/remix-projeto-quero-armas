/* =============================================================================
 * Escopo da certidão — CRIMINAL x CÍVEL (regra global, 10/08/2026)
 *
 * Nenhum processo de aquisição/posse/porte é instruído com certidão CÍVEL.
 * O cliente, porém, encontra as duas no mesmo portal (TJM/SP, TJSP, TRF,
 * Justiça Militar da União) e envia a errada com frequência — e ela passava,
 * porque o texto também diz "NADA CONSTA" e traz o nome dele.
 *
 * A regra é conservadora de propósito, para nunca reprovar certidão boa:
 *   - marcador cível E nenhum marcador criminal  → CÍVEL   → rejeita
 *   - qualquer marcador criminal                 → CRIMINAL (mesmo citando cível
 *     nas observações, como faz o TJSP)
 *   - nenhum dos dois                            → INDEFINIDO → segue o fluxo
 * ============================================================================= */

export type EscopoCertidao = "criminal" | "civel" | "indefinido";

function achatar(texto: string): string {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** O documento é criminal quando qualquer um destes aparece. */
const MARCADORES_CRIMINAIS: RegExp[] = [
  /ANTECEDENTES CRIMINA(L|IS)/,
  /AUDITORIAS? CRIMINA(L|IS)/,
  /DISTRIBUICAO CRIMINAL/,
  /DISTRIBUICO[EO]S CRIMINA(L|IS)/,
  /DISTRIBUICAO DE ACOES CRIMINA(L|IS)/,
  /ACOES CRIMINA(L|IS)/,
  /EXECUCO[EO]ES? CRIMINA(L|IS)/,
  /EXECUCOES CRIMINA(L|IS)/,
  /CRIMES ELEITORAIS/,
  /FINS CRIMINAIS/,
  /CERTIDAO (JUDICIAL )?CRIMINAL/,
  /\bCRIMINA(L|IS)\b/,
];

/** O documento é cível quando qualquer um destes aparece. */
const MARCADORES_CIVEIS: RegExp[] = [
  /CARTORIO CIVEL/,
  /ACOES CIVEIS/,
  /DISTRIBUICAO CIVEL/,
  /DISTRIBUICO[EO]S CIVEIS/,
  /AREA CIVEL/,
  /CERTIDAO CIVEL/,
  /REU\s*\/\s*REQUERIDO/,
  /FAMILIA E SUCESSOES/,
  /FALENCIA|CONCORDATA|RECUPERACAO JUDICIAL/,
  /EXECUCO[EO]ES? FISCA(L|IS)/,
  /EXECUCOES FISCAIS/,
];

export function detectarEscopoCertidao(texto: string): EscopoCertidao {
  const t = achatar(texto);
  if (!t) return "indefinido";
  const criminal = MARCADORES_CRIMINAIS.some((re) => re.test(t));
  if (criminal) return "criminal";
  const civel = MARCADORES_CIVEIS.some((re) => re.test(t));
  return civel ? "civel" : "indefinido";
}

/** Nome do tribunal, só para a mensagem ficar específica. */
function orgaoLegivel(t: string): string {
  if (/TRIBUNAL DE JUSTICA MILITAR DO ESTADO/.test(t)) return "do TJM/SP";
  if (/JUSTICA MILITAR DA UNIAO|SUPERIOR TRIBUNAL MILITAR/.test(t)) return "da Justiça Militar da União (STM)";
  if (/TRIBUNAL REGIONAL FEDERAL/.test(t)) return "da Justiça Federal (TRF)";
  if (/TRIBUNAL DE JUSTICA/.test(t)) return "do Tribunal de Justiça";
  return "";
}

/**
 * Mensagem de rejeição, no vocabulário do cliente: diz o que ele mandou, o que
 * o processo exige e o que fazer.
 */
export function mensagemCertidaoCivel(texto: string): string {
  const onde = orgaoLegivel(achatar(texto));
  return (
    `Você enviou a certidão CÍVEL${onde ? ` ${onde}` : ""}. ` +
    `O processo exige a certidão CRIMINAL (antecedentes / distribuição de ações criminais) — ` +
    `a certidão cível não instrui pedido de arma de fogo. ` +
    `Volte ao site do órgão e emita a certidão criminal.`
  );
}

/** Atalho usado pelos gates: verdadeiro só quando o documento é comprovadamente cível. */
export function ehCertidaoCivel(texto: string): boolean {
  return detectarEscopoCertidao(texto) === "civel";
}