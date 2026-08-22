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

/**
 * Higieniza antes de detectar: URLs, e-mails e códigos colados do rodapé
 * (ex.: `.../CertidaoCivelEleitoralCriminal/...`) não podem influenciar o
 * veredicto — nem para cível, nem para criminal.
 */
function achatar(texto: string): string {
  return String(texto || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/\S+@\S+\.\S+/g, " ")
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
  // TRF3 e correlatos: "CERTIDÃO JUDICIAL CÍVEL", "CERTIDÃO NEGATIVA CÍVEL",
  // "CERTIDÃO DE DISTRIBUIÇÃO CÍVEL".
  /CERTIDAO (?:[A-Z]+ ){0,3}CIVEL/,
  /CLASSES CIVEIS/,
  /PROCESSOS CIVEIS/,
  /NATUREZA CIVEL/,
  /MATERIA CIVEL/,
  /REU\s*\/\s*REQUERIDO/,
  /FAMILIA E SUCESSOES/,
  /FALENCIA|CONCORDATA|RECUPERACAO JUDICIAL/,
  /EXECUCO[EO]ES? FISCA(L|IS)/,
  /EXECUCOES FISCAIS/,
];

/**
 * Cabeçalho manda mais que corpo: quando o título declara CÍVEL, esse é o
 * escopo — mesmo que "criminal" apareça depois em observações ou no nome do
 * sistema consultado.
 */
function cabecalhoDeclaraCivel(textoAchatado: string): boolean {
  const cabecalho = textoAchatado.slice(0, 600);
  return MARCADORES_CIVEIS.some((re) => re.test(cabecalho));
}

export function detectarEscopoCertidao(texto: string): EscopoCertidao {
  const t = achatar(texto);
  if (!t) return "indefinido";
  const civel = MARCADORES_CIVEIS.some((re) => re.test(t));
  if (civel && cabecalhoDeclaraCivel(t)) return "civel";
  const criminal = MARCADORES_CRIMINAIS.some((re) => re.test(t));
  if (criminal) return "criminal";
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
/**
 * A trava de escopo cível só faz sentido quando o espaço aberto ESPERA uma
 * certidão. Em 22/08/2026 o Igor tentou enviar a Carteira de Trabalho Digital
 * no slot da CTPS e levou "você enviou a certidão cível": a trava rodava em
 * TODO envio, antes de olhar para o que o slot pedia, e bastava o texto do
 * arquivo tropeçar num marcador para o cliente ser barrado num documento que
 * não é certidão nenhuma.
 *
 * Sem tipo esperado (envio livre ao Hub) a trava continua valendo — é o caso
 * em que o cliente escolhe o tipo depois, e uma certidão cível ali seria
 * arquivada como documento bom.
 */
export function slotEsperaCertidao(tipoEsperado?: string | null): boolean {
  const t = String(tipoEsperado ?? "").trim().toLowerCase();
  if (!t) return true; // envio livre: mantém a proteção antiga
  return t.startsWith("certidao") || t.startsWith("antecedentes");
}
