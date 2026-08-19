/* =============================================================================
 * ETAPA FINAL — o que só existe no dia de protocolar
 * -----------------------------------------------------------------------------
 * ESPELHO de `supabase/functions/_shared/checklistVisibility.ts`
 * (`ehExigenciaEtapaFinal`). Deno e Vite não compartilham módulo; as duas
 * cópias mudam juntas.
 *
 * Alguns passos do checklist não são "documento que o cliente vai buscar": são
 * o ATO de protocolar. Pedi-los enquanto ele ainda junta certidão é ruído — e,
 * em dois casos, é pedir o impossível:
 *
 *   • BOLETO E COMPROVANTE DA GRU — a taxa da Polícia Federal. A própria
 *     instrução impressa no passo manda: "só pague DEPOIS que a nossa equipe
 *     liberar o seu requerimento". Enquanto isso era só texto, o sistema
 *     mostrava o passo assim que o grupo abria e convidava o cliente a pagar
 *     R$ 88 antes da hora. Dinheiro do cliente não pode depender de ele ter
 *     lido o aviso com atenção.
 *   • ACESSO AO GOV.BR — o código de duas etapas expira em minutos.
 *   • JUNTADA ASSINADA — só existe depois de a equipe montar o dossiê.
 *
 * A ordem real: a equipe fecha a documentação e marca o processo como pronto
 * para protocolar → aí o cliente paga a GRU, manda o comprovante, libera o
 * gov.br e assina a juntada.
 *
 * CONSEQUÊNCIA OBRIGATÓRIA: exigência de etapa final NÃO conta para "o processo
 * está pronto". Se contasse, o processo nunca chegaria a `pronto_para_protocolar`
 * — e o passo nunca apareceria. Uma esperando a outra, para sempre.
 * ============================================================================= */

/**
 * Rede de segurança para base em que a marca `etapa_final` ainda não foi
 * aplicada na linha do processo. O tipo do documento é suficiente: nenhum
 * destes quatro passos faz sentido antes do dia do protocolo.
 */
export const TIPOS_ETAPA_FINAL: ReadonlySet<string> = new Set([
  "gru",
  "gru_boleto",
  "gru_comprovante",
  "gru_paga",
  "credencial_gov_br",
  "senha_gov_br",
  "acesso_gov_br",
  "juntada_assinada",
]);

/** Status do processo em que a equipe já liberou a etapa de protocolo. */
export const STATUS_PROTOCOLO_LIBERADO: ReadonlySet<string> = new Set([
  "pronto_para_protocolar",
  "protocolado",
  "em_analise_orgao",
]);

export interface ItemComEtapaFinal {
  tipo_documento?: string | null;
  regra_validacao?: { etapa_final?: boolean | null } | null;
}

export function ehExigenciaEtapaFinal(d: ItemComEtapaFinal | null | undefined): boolean {
  if (d?.regra_validacao?.etapa_final === true) return true;
  return TIPOS_ETAPA_FINAL.has(String(d?.tipo_documento ?? "").trim().toLowerCase());
}

/** A equipe já liberou o cliente para os passos do protocolo? */
export function protocoloLiberado(statusProcesso: unknown): boolean {
  return STATUS_PROTOCOLO_LIBERADO.has(String(statusProcesso ?? "").trim().toLowerCase());
}

/**
 * O item pode ser cobrado do cliente AGORA?
 *
 * Único ponto de decisão: quem for de etapa final espera a liberação da equipe;
 * o resto segue o fluxo normal do checklist.
 */
export function exigenciaCobravelAgora(
  d: ItemComEtapaFinal | null | undefined,
  statusProcesso: unknown,
): boolean {
  return !ehExigenciaEtapaFinal(d) || protocoloLiberado(statusProcesso);
}
