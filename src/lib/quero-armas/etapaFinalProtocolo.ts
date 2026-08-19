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

import { ehReemissaoDeVencido } from "./reemissaoVencido";

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
  /** Usado pela trava de reemissão de vencido — ver `reemissaoVencido.ts`. */
  status?: string | null;
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
 * ÚNICO ponto de decisão do portal. Duas coisas esperam a liberação da equipe,
 * pelo mesmo motivo de fundo — cobrar cedo custa dinheiro do cliente à toa:
 *
 *   1. ETAPA FINAL (GRU, gov.br, juntada): não são documentos a buscar, são o
 *      ato de protocolar.
 *   2. REEMISSÃO DE VENCIDO (19/08/2026): o documento já foi entregue e
 *      conferido, só perdeu a validade esperando a fila. Certidão vale 30 dias
 *      e o processo leva mais; reemitir cedo faz o cliente pagar de novo e
 *      chegar vencido ao protocolo do mesmo jeito. Ver `reemissaoVencido.ts`.
 *
 * O resto segue o fluxo normal do checklist. Documento REPROVADO não entra
 * aqui: aquilo é erro de agora e é cobrado de imediato.
 */
export function exigenciaCobravelAgora(
  d: ItemComEtapaFinal | null | undefined,
  statusProcesso: unknown,
): boolean {
  if (ehExigenciaEtapaFinal(d) || ehReemissaoDeVencido(d)) {
    return protocoloLiberado(statusProcesso);
  }
  return true;
}

/**
 * Separa o checklist entre "o que ainda é com o cliente" e "o que está com a
 * equipe".
 *
 * Serve para responder, na tela, a pergunta que o cliente faz quando termina de
 * entregar tudo e continua vendo itens em aberto: "e agora, é comigo ou com
 * vocês?". Sem essa separação a tela mostrava quatro linhas amarelas escritas
 * PENDENTE — que o cliente lê como dívida dele — quando na verdade nenhuma
 * delas depende de nada que ele possa fazer.
 */
export function separarPorResponsavel<T extends ItemComEtapaFinal>(
  docs: readonly T[],
  statusProcesso: unknown,
): { doCliente: T[]; comAEquipe: T[] } {
  const doCliente: T[] = [];
  const comAEquipe: T[] = [];
  for (const d of docs ?? []) {
    if (exigenciaCobravelAgora(d, statusProcesso)) doCliente.push(d);
    else comAEquipe.push(d);
  }
  return { doCliente, comAEquipe };
}

/**
 * A parte do cliente acabou e o que sobrou está com a equipe?
 *
 * É o estado em que o portal precisa parar de cobrar e passar a EXPLICAR: a
 * equipe monta a defesa, o cliente lê e aprova, e só então os últimos passos
 * abrem.
 */
export function aguardandoEquipe(
  docs: readonly ItemComEtapaFinal[],
  statusProcesso: unknown,
): boolean {
  const { doCliente, comAEquipe } = separarPorResponsavel(docs, statusProcesso);
  return doCliente.length === 0 && comAEquipe.length > 0;
}
