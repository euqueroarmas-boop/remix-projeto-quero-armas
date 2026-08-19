/**
 * Fase da PETIÇÃO no painel de progresso.
 *
 * O painel "PROGRESSO DOS CLIENTES" só sabia falar de documento: qual grupo o
 * cliente está preenchendo e quanto falta. Quando o checklist fecha, o processo
 * some da conversa — a peça é escrita, vai para o cliente aprovar e volta, e
 * nada disso aparecia no card. A equipe não tinha como saber, batendo o olho,
 * quem já chegou na fase da PET.
 *
 * A vida da peça mora em `qa_geracoes_pecas.status_cliente` (CHECK do banco:
 * nao_enviada | aguardando_cliente | aprovada | devolvida) e é ligada ao
 * processo por `processo_id`. Este módulo traduz esses quatro valores — mais o
 * caso de quem fechou os documentos e ainda não tem peça — no chip que o card
 * mostra. Sem consulta, sem React: função pura, para o teste conseguir cobrir
 * cada estado.
 */

export type EstadoPeticaoId =
  | "aguardando_equipe"
  | "redigida"
  | "com_cliente"
  | "devolvida"
  | "aprovada";

/** Tom semântico do chip — o componente decide a cor real. */
export type TomPeticao = "verde" | "ambar" | "vermelho" | "neutro";

export interface EstadoPeticao {
  id: EstadoPeticaoId;
  /** Rótulo curto do chip, já em caixa alta. */
  label: string;
  tom: TomPeticao;
  /** Frase do `title`: o que aquele chip quer dizer para quem atende. */
  descricao: string;
}

/** O que este módulo precisa de uma linha de `qa_geracoes_pecas`. */
export interface PecaDoProcesso {
  processo_id?: string | null;
  status_cliente?: string | null;
}

/** O que este módulo precisa de uma linha do painel de progresso. */
export interface ProcessoParaPeticao {
  status?: string | null;
  total_docs?: number | null;
  entregues?: number | null;
  bloqueado_por_prerequisito?: boolean | null;
  protocolo_numero?: string | null;
}

const ESTADOS: Record<EstadoPeticaoId, EstadoPeticao> = {
  aguardando_equipe: {
    id: "aguardando_equipe",
    label: "PET A REDIGIR",
    tom: "neutro",
    descricao: "Documentação fechada e nenhuma peça gerada: a petição está na fila da equipe.",
  },
  redigida: {
    id: "redigida",
    label: "PET REDIGIDA",
    tom: "ambar",
    descricao: "Peça gerada, ainda não enviada ao cliente para aprovação.",
  },
  com_cliente: {
    id: "com_cliente",
    label: "PET COM O CLIENTE",
    tom: "ambar",
    descricao: "Petição enviada ao cliente e aguardando a aprovação dele.",
  },
  devolvida: {
    id: "devolvida",
    label: "PET DEVOLVIDA",
    tom: "vermelho",
    descricao: "O cliente devolveu a petição com correções: a bola está com a equipe.",
  },
  aprovada: {
    id: "aprovada",
    label: "PET APROVADA",
    tom: "verde",
    descricao: "Petição aprovada pelo cliente — pronta para seguir ao protocolo.",
  },
};

/**
 * Prioridade entre as peças do MESMO processo.
 *
 * Um processo pode ter várias gerações (rascunho antigo, versão devolvida,
 * versão nova). Vale sempre o estágio mais avançado da conversa com o cliente:
 * aprovada encerra o assunto; peça com o cliente vence uma devolução anterior
 * já reescrita; devolvida vence rascunho, porque é trabalho pendente da equipe.
 */
const PRIORIDADE: Record<string, number> = {
  aprovada: 4,
  aguardando_cliente: 3,
  devolvida: 2,
  nao_enviada: 1,
};

/** Status do processo em que a petição já cumpriu o papel dela. */
const STATUS_APOS_PETICAO = new Set(["protocolado", "em_analise_orgao", "em_exigencia", "notificado", "recurso_administrativo"]);

/** O status de peça que manda no processo, entre todas as gerações dele. */
export function statusPecaDominante(pecas: readonly PecaDoProcesso[]): string | null {
  let melhor: string | null = null;
  let melhorPeso = 0;
  for (const p of pecas ?? []) {
    const s = String(p?.status_cliente ?? "").trim().toLowerCase();
    const peso = PRIORIDADE[s] ?? 0;
    if (peso > melhorPeso) { melhor = s; melhorPeso = peso; }
  }
  return melhor;
}

/**
 * Fase da petição de um processo, ou `null` quando ele ainda não chegou lá.
 *
 * `null` é a resposta certa para quem ainda está juntando documento, para quem
 * está travado esperando etapa anterior e para quem já protocolou — nesses três
 * casos o chip de PET só faria barulho no card.
 */
export function estadoPeticao(
  processo: ProcessoParaPeticao | null | undefined,
  pecas: readonly PecaDoProcesso[] = [],
): EstadoPeticao | null {
  if (processo?.bloqueado_por_prerequisito) return null;

  const status = String(processo?.status ?? "").trim().toLowerCase();
  const jaProtocolado = !!processo?.protocolo_numero || STATUS_APOS_PETICAO.has(status);

  const dominante = statusPecaDominante(pecas);
  if (dominante === "aprovada") return ESTADOS.aprovada;

  // Protocolado sem peça aprovada registrada: a petição já não é o assunto do card.
  if (jaProtocolado) return null;

  if (dominante === "aguardando_cliente") return ESTADOS.com_cliente;
  if (dominante === "devolvida") return ESTADOS.devolvida;
  if (dominante === "nao_enviada") return ESTADOS.redigida;

  // Sem nenhuma peça: só entra na fase quando o checklist fecha.
  const total = Number(processo?.total_docs ?? 0);
  const entregues = Number(processo?.entregues ?? 0);
  if (total > 0 && entregues >= total) return ESTADOS.aguardando_equipe;
  if (status === "pronto_para_protocolar" || status === "validado") return ESTADOS.aguardando_equipe;

  return null;
}

/** Agrupa as peças por processo, para alimentar `estadoPeticao` sem varrer a lista toda. */
export function pecasPorProcesso<T extends PecaDoProcesso>(pecas: readonly T[]): Record<string, T[]> {
  const mapa: Record<string, T[]> = {};
  for (const p of pecas ?? []) {
    const k = String(p?.processo_id ?? "");
    if (!k) continue;
    (mapa[k] ||= []).push(p);
  }
  return mapa;
}
