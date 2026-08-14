/**
 * REGIME DE GESTÃO DE ALERTA DO DOCUMENTO — regra canônica (14/08/2026).
 *
 * Nem todo documento com validade merece ser cobrado a vida inteira. Existem
 * dois regimes, e a diferença é PARA QUE o documento serve:
 *
 * 1) INSTRUÇÃO PROCESSUAL — comprovante de endereço, antecedentes, ocupação
 *    lícita/renda, identificação civil, boletim de ocorrência, declarações e
 *    peças do processo. Eles existem para INSTRUIR a pasta: precisam estar
 *    dentro da validade NO DIA DO PROTOCOLO. Depois que o processo é entregue
 *    à Polícia Federal, o documento já cumpriu o papel dele — cobrar renovação
 *    a partir daí é ruído, e ruído treina o cliente a ignorar alerta.
 *
 * 2) GESTÃO PERMANENTE — CR, CRAF/SINARM, GT, GTE, autorização de compra,
 *    laudos (psicológico e capacidade técnica), a atividade do CAC (filiação,
 *    habitualidade) e a PROCURAÇÃO. Esses valem por si: vencidos, o cliente
 *    fica irregular independentemente de haver processo em andamento — e, no
 *    caso da procuração, é ela que sustenta a atuação do escritório em
 *    exigência e recurso, que acontecem DEPOIS do protocolo. Alertam SEMPRE.
 *
 * O gatilho do silêncio é o PROTOCOLO, não o fim do processo: enquanto existir
 * ao menos um processo vivo que ainda não foi protocolado, a instrução segue
 * sendo cobrada — é justamente essa a janela em que o documento precisa estar
 * válido. Exigência aberta pela PF reabre a cobrança: a exigência quase sempre
 * pede documento novo.
 *
 * Quando não dá para saber (cliente sem processo carregado), o padrão é
 * COBRAR. Alerta a mais o cliente ignora; alerta a menos perde protocolo.
 */

import { inferHubCategoriaFromTipo, type HubCategoria } from "./documentosHubCatalogo";

export type RegimeAlertaDocumento = "permanente" | "instrucao";

/**
 * Categorias do Hub cujos documentos são de GESTÃO PERMANENTE.
 * Qualquer outra categoria é instrução processual.
 */
const CATEGORIAS_GESTAO_PERMANENTE: ReadonlySet<HubCategoria> = new Set<HubCategoria>([
  // CR, CRAF, SINARM, GT, GTE, autorização de compra.
  "arma_acervo",
  // Laudo psicológico e atestado de capacidade técnica.
  "laudos_exames",
  // Filiação a clube, habitualidade, competição, caçador IBAMA — a vida do CAC
  // não depende de processo aberto, e o vencimento derruba o CR.
  "cac_atividade",
]);

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

/**
 * Exceção por TIPO, acima da categoria.
 *
 * A procuração mora na categoria "juridico" junto com contrato, recurso e
 * mandado de segurança — mas não é instrução de pasta como eles. Ela é o
 * instrumento que mantém o escritório atuando no caso, inclusive em exigência
 * e recurso, que só existem DEPOIS do protocolo. Vencida, o escritório perde a
 * capacidade de agir no processo do cliente.
 */
function isProcuracaoTipo(tipoNormalizado: string): boolean {
  return tipoNormalizado === "procuracao" || tipoNormalizado.startsWith("procuracao_");
}

/**
 * O documento é de gestão permanente ou só serve para instruir o processo?
 *
 * Sem tipo não dá para classificar — cai em "permanente" para não silenciar
 * por engano um CR ou um CRAF que chegou sem o campo preenchido.
 */
export function regimeAlertaDocumento(tipo?: string | null): RegimeAlertaDocumento {
  const t = norm(tipo);
  if (!t) return "permanente";
  if (isProcuracaoTipo(t)) return "permanente";
  return CATEGORIAS_GESTAO_PERMANENTE.has(inferHubCategoriaFromTipo(t)) ? "permanente" : "instrucao";
}

/** Status de processo que já passaram pelo protocolo (ou encerraram). */
const STATUS_PROCESSO_POS_PROTOCOLO: ReadonlySet<string> = new Set([
  "protocolado",
  "enviado_ao_orgao",
  "enviado_orgao",
  "em_analise_orgao",
  "em_analise_pf",
  "deferido",
  "indeferido",
  "concluido",
  "finalizado",
  "arquivado",
  "cancelado",
  "desistiu",
  "restituido",
]);

/**
 * Exigência da PF: o órgão pediu algo depois de protocolado e quase sempre é
 * documento novo. Enquanto ela estiver aberta, a instrução volta a ser cobrada.
 */
const STATUS_PROCESSO_EXIGENCIA: ReadonlySet<string> = new Set([
  "em_exigencia",
  "exigencia",
  "exigencia_emitida",
  "cumprindo_exigencia",
  "notificado",
]);

export interface ProcessoParaGestao {
  status?: string | null;
}

/**
 * Ainda existe processo que precisa da documentação de instrução válida?
 *
 * true  → há processo vivo antes do protocolo, ou exigência aberta.
 * false → tudo que existe já foi protocolado (ou encerrado).
 */
export function instrucaoAindaExigida(
  processos?: readonly ProcessoParaGestao[] | null,
): boolean {
  const status = (processos ?? [])
    .map((p) => norm(p?.status))
    .filter(Boolean);
  // Sem processo conhecido não dá para afirmar que já foi protocolado: cobra.
  if (!status.length) return true;
  if (status.some((s) => STATUS_PROCESSO_EXIGENCIA.has(s))) return true;
  return status.some((s) => !STATUS_PROCESSO_POS_PROTOCOLO.has(s));
}

/**
 * O documento ainda deve gerar alerta de vencimento (cor, banner e e-mail)?
 *
 * Documento de gestão permanente: sempre.
 * Documento de instrução: só enquanto houver processo antes do protocolo.
 */
export function documentoSobGestaoDeAlerta(
  tipo: string | null | undefined,
  opts: { instrucaoExigida: boolean },
): boolean {
  if (regimeAlertaDocumento(tipo) === "permanente") return true;
  return opts.instrucaoExigida;
}
