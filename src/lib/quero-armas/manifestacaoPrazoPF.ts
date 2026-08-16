// ============================================================================
// manifestacaoPrazoPF — o texto colado da PF vira prazo no painel da equipe
// ----------------------------------------------------------------------------
// A equipe entra no gov.br do cliente, copia o que a Polícia Federal escreveu e
// cola no admin. Isso já mostra o texto para o cliente. Mas o painel de prazos
// da Dashboard não lê texto — ele lê DATA, em quatro colunas de
// `qa_itens_venda`:
//
//   data_notificacao            → 10 dias  (Lei 9.784/99)
//   data_indeferimento          → 10 dias para recorrer
//   data_recurso_administrativo → fecha o prazo de 10 dias (recurso protocolado)
//   data_indeferimento_recurso  → 120 dias para o Mandado de Segurança
//                                 (art. 23 da Lei 12.016/09)
//
// Sem esta ponte, colar a notificação avisaria o cliente e deixaria a EQUIPE no
// escuro: o contador da Dashboard só acenderia se alguém, depois, lembrasse de
// abrir a venda e digitar a data à mão. É exatamente o tipo de passo manual que
// se esquece na semana cheia — e o prazo é fatal.
//
// A data usada é a do DOCUMENTO (quando a equipe informa), não a do dia em que
// foi colado. O prazo corre da manifestação da PF; colar três dias depois não
// devolve três dias.
// ============================================================================

/** Status para onde o processo vai quando a manifestação é registrada. */
export type StatusManifestacao =
  | "em_analise_orgao"
  | "notificado"
  | "indeferido"
  | "deferido"
  | "recurso_administrativo"
  | "recurso_indeferido";

/** Colunas de data de `qa_itens_venda` que abrem (ou fecham) prazo. */
export type CampoPrazoItem =
  | "data_notificacao"
  | "data_indeferimento"
  | "data_recurso_administrativo"
  | "data_indeferimento_recurso"
  | "data_deferimento";

const MAPA: Record<StatusManifestacao, CampoPrazoItem | null> = {
  // Análise em curso não abre prazo para ninguém — é a PF trabalhando.
  em_analise_orgao: null,
  notificado: "data_notificacao",
  indeferido: "data_indeferimento",
  // Deferido encerra o processo. A engine de prazos já trata status final,
  // mas gravar a data deixa o histórico completo.
  deferido: "data_deferimento",
  // Recurso protocolado FECHA o prazo de 10 dias: não corre mais contra nós.
  recurso_administrativo: "data_recurso_administrativo",
  // Negado o recurso, esgota-se a via administrativa e começa a correr o prazo
  // decadencial do Mandado de Segurança.
  recurso_indeferido: "data_indeferimento_recurso",
};

/**
 * Qual coluna de `qa_itens_venda` este status alimenta. `null` quando o status
 * não abre nem fecha prazo.
 */
export function campoPrazoDoStatus(status: string | null | undefined): CampoPrazoItem | null {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return null;
  return MAPA[s as StatusManifestacao] ?? null;
}

/**
 * O `qa_processos.status` que corresponde ao status da manifestação.
 *
 * `recurso_indeferido` NÃO existe no vocabulário de `qa_processos` — lá o
 * processo continua `indeferido`, porque é isso que ele é. A distinção entre
 * "indeferido no pedido" e "indeferido no recurso" vive na manifestação, que é
 * onde ela importa: é ela que decide se ainda cabe recurso ou se o caminho que
 * resta é o juiz.
 */
export function statusProcessoDoStatusManifestacao(
  status: string | null | undefined,
): string | null {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "recurso_indeferido") return "indeferido";
  return s;
}

/**
 * O que gravar em `qa_itens_venda` a partir de uma manifestação.
 *
 * Devolve `{}` quando não há nada a gravar — o chamador pode pular o UPDATE em
 * vez de disparar uma escrita vazia.
 */
export function patchPrazoDoItem(args: {
  status: string | null | undefined;
  /** Data do documento da PF (ISO). Cai para `hoje` quando a equipe não informa. */
  dataDocumento?: string | null;
  hojeISO: string;
}): Partial<Record<CampoPrazoItem, string>> {
  const campo = campoPrazoDoStatus(args.status);
  if (!campo) return {};
  const data = normalizarISO(args.dataDocumento) ?? args.hojeISO;
  return { [campo]: data } as Partial<Record<CampoPrazoItem, string>>;
}

function normalizarISO(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}
