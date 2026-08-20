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

import { TIPOS_ETAPA_FINAL } from "./etapaFinalProtocolo";

export type EstadoPeticaoId =
  | "aguardando_equipe"
  | "redigida"
  | "com_cliente"
  | "devolvida"
  | "aprovada";

/* =============================================================================
 * PRAZO DA DEFESA — 7 DIAS ÚTEIS
 * -----------------------------------------------------------------------------
 * Compromisso assumido com o cliente (20/08/2026): fechada a efetiva
 * necessidade, a equipe tem 7 DIAS ÚTEIS para redigir a defesa e enviá-la para
 * aprovação. O relógio anda em dia útil de calendário (sábado e domingo não
 * contam; feriado conta — não há tabela de feriados no sistema).
 *
 * Âncora do prazo: a data em que o ÚLTIMO item do grupo de efetiva necessidade
 * fechou (data_envio ou updated_at, o que existir). Sem itens de efetiva, vale
 * a última entrega do cliente fora da etapa final.
 * ============================================================================= */

export const PRAZO_DEFESA_DIAS_UTEIS = 7;

/** Soma `n` dias úteis a uma data (sábado/domingo pulados). */
export function somarDiasUteis(inicio: Date, n: number): Date {
  const d = new Date(inicio.getTime());
  let restam = n;
  while (restam > 0) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) restam -= 1;
  }
  return d;
}

/** Dias úteis inteiros entre duas datas (0 se `ate` <= `de`; só seg–sex contam). */
export function diasUteisEntre(de: Date, ate: Date): number {
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  const b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate());
  let n = 0;
  while (a < b) {
    a.setDate(a.getDate() + 1);
    const dia = a.getDay();
    if (dia !== 0 && dia !== 6) n += 1;
  }
  return n;
}

export interface PrazoDefesa {
  /** Quando o relógio começou a andar (fechamento da efetiva necessidade). */
  inicio: Date;
  /** Último dia útil para entregar a defesa ao cliente. */
  limite: Date;
  /** Dias úteis que ainda restam; negativo = prazo estourado. */
  diasUteisRestantes: number;
}

function dataDoDoc(d: DocParaDefesa): number | null {
  const bruto = d?.data_envio ?? d?.updated_at ?? null;
  if (!bruto) return null;
  const t = new Date(bruto).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * O prazo de 7 dias úteis da defesa deste processo, ou `null` se ele ainda não
 * começou a correr (efetiva em aberto) ou se não há data para ancorar.
 */
export function prazoDefesa(
  docs: readonly DocParaDefesa[],
  agora: Date = new Date(),
): PrazoDefesa | null {
  const efetiva = grupoEfetivaFechado(docs);
  if (efetiva === false) return null;

  let candidatos: DocParaDefesa[];
  if (efetiva === true) {
    candidatos = (docs ?? []).filter(ehDocEfetivaNecessidade);
  } else {
    if (faltaDocDoCliente(docs ?? [])) return null;
    candidatos = (docs ?? []).filter((d) => {
      const tipo = String(d?.tipo_documento ?? d?.tipo ?? "").trim().toLowerCase();
      return !TIPOS_ETAPA_FINAL.has(tipo);
    });
  }

  let inicioMs: number | null = null;
  for (const d of candidatos) {
    const t = dataDoDoc(d);
    if (t != null && (inicioMs == null || t > inicioMs)) inicioMs = t;
  }
  if (inicioMs == null) return null;

  const inicio = new Date(inicioMs);
  const limite = somarDiasUteis(inicio, PRAZO_DEFESA_DIAS_UTEIS);
  const passados = diasUteisEntre(inicio, agora);
  return { inicio, limite, diasUteisRestantes: PRAZO_DEFESA_DIAS_UTEIS - passados };
}

/**
 * O estado da petição é RESPONSABILIDADE DA EQUIPE?
 *
 * É o filtro do card do painel: a fila de trabalho é quem espera a defesa ser
 * escrita, enviada ou reescrita. Peça com o cliente ou já aprovada não é fila
 * de ninguém aqui dentro — fica fora do contador e do chip.
 */
export function ehResponsabilidadeEquipe(estado: EstadoPeticao | null | undefined): boolean {
  return estado?.id === "aguardando_equipe" || estado?.id === "redigida" || estado?.id === "devolvida";
}

/** Traduz o estado calculado pelo banco (`qa_defesas_na_fila`) no chip do card. */
export function estadoDaFilaServidor(estado: string | null | undefined): EstadoPeticao | null {
  const e = String(estado ?? "").trim().toLowerCase();
  if (e === "a_redigir") return ESTADOS.aguardando_equipe;
  if (e === "redigida") return ESTADOS.redigida;
  if (e === "devolvida") return ESTADOS.devolvida;
  return null;
}

/** Linha devolvida pela função `qa_defesas_na_fila()` do banco. */
export interface FilaDefesaServidor {
  processo_id?: string | null;
  estado?: string | null;        // 'a_redigir' | 'redigida' | 'devolvida'
  prazo_inicio?: string | null;
}

/** Prazo de 7 dias úteis a partir de um início conhecido (vindo do banco). */
export function prazoDesdeInicio(inicioBruto: string | Date | null | undefined, agora: Date = new Date()): PrazoDefesa | null {
  if (!inicioBruto) return null;
  const inicio = inicioBruto instanceof Date ? inicioBruto : new Date(inicioBruto);
  if (!Number.isFinite(inicio.getTime())) return null;
  const limite = somarDiasUteis(inicio, PRAZO_DEFESA_DIAS_UTEIS);
  return { inicio, limite, diasUteisRestantes: PRAZO_DEFESA_DIAS_UTEIS - diasUteisEntre(inicio, agora) };
}

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
  cliente_id?: number | null;
  status_cliente?: string | null;
}

/** Um item do checklist, para decidir se a parte do CLIENTE já acabou. */
export interface DocParaDefesa {
  tipo?: string | null;
  tipo_documento?: string | null;
  status?: string | null;
  /** Datas usadas para ancorar o prazo de 7 dias úteis da defesa. */
  data_envio?: string | null;
  updated_at?: string | null;
}

/** Status em que um item do checklist ainda espera ação (espelho do portal). */
const STATUS_DOC_ABERTO = new Set([
  "pendente",
  "pendente_reenvio",
  "invalido",
  "reprovado",
  "divergente",
  "rejeitado",
  "aguardando_envio",
  "em_correcao",
]);

/**
 * Ainda falta documento DO CLIENTE antes de a defesa entrar em cena?
 *
 * Os passos de etapa final (GRU, gov.br, juntada assinada) NÃO contam: eles só
 * abrem DEPOIS da defesa aprovada, então contá-los deixaria o chip da PET
 * apagado exatamente nos processos que já chegaram na fase — os únicos itens em
 * aberto deles são esses.
 */
export function faltaDocDoCliente(docs: readonly DocParaDefesa[]): boolean {
  for (const d of docs ?? []) {
    const status = String(d?.status ?? "").trim().toLowerCase();
    if (!STATUS_DOC_ABERTO.has(status)) continue;
    const tipo = String(d?.tipo_documento ?? d?.tipo ?? "").trim().toLowerCase();
    if (TIPOS_ETAPA_FINAL.has(tipo)) continue;
    return true;
  }
  return false;
}

/** O item pertence ao grupo de efetiva necessidade? (mesma leitura do painel) */
export function ehDocEfetivaNecessidade(d: DocParaDefesa | null | undefined): boolean {
  const tipo = String(d?.tipo_documento ?? d?.tipo ?? "").trim().toLowerCase();
  if (!tipo) return false;
  return (
    tipo === "declaracao_necessidade_efetiva" ||
    tipo === "comprovante_efetiva_necessidade" ||
    tipo.includes("efetiva_necessidade")
  );
}

/**
 * Regra do titular (20/08/2026): a fila da petição só recebe quem FECHOU o
 * grupo de efetiva necessidade. É a narrativa da efetiva necessidade que
 * sustenta a defesa — sem ela fechada, a equipe não tem o que redigir, mesmo
 * que o resto do checklist esteja em dia.
 *
 * Retorna `null` quando o processo não tem itens de efetiva necessidade — aí a
 * regra não se aplica e vale a leitura geral do checklist.
 */
export function grupoEfetivaFechado(docs: readonly DocParaDefesa[]): boolean | null {
  let tem = false;
  for (const d of docs ?? []) {
    if (!ehDocEfetivaNecessidade(d)) continue;
    tem = true;
    const status = String(d?.status ?? "").trim().toLowerCase();
    if (STATUS_DOC_ABERTO.has(status)) return false;
  }
  return tem ? true : null;
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
    descricao: "Efetiva necessidade entregue e nenhuma peça gerada: a petição está na fila da equipe.",
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
  docsDoProcesso?: readonly DocParaDefesa[],
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

  // Sem nenhuma peça: quem decide a entrada na fila é a EFETIVA NECESSIDADE
  // (regra do titular, 20/08/2026) — é ela que sustenta a defesa. Fechou o
  // grupo, entra; não fechou, não entra, mesmo com o resto do checklist ok.
  // Processo sem itens de efetiva necessidade cai na leitura geral: parte do
  // cliente fechada, ignorando a etapa final (GRU, gov.br, juntada), que só
  // abre DEPOIS da defesa. Sem a lista de documentos, vale a contagem bruta.
  if (docsDoProcesso && docsDoProcesso.length > 0) {
    const efetiva = grupoEfetivaFechado(docsDoProcesso);
    if (efetiva === true) return ESTADOS.aguardando_equipe;
    if (efetiva === false) return null;
    if (!faltaDocDoCliente(docsDoProcesso)) return ESTADOS.aguardando_equipe;
  } else {
    const total = Number(processo?.total_docs ?? 0);
    const entregues = Number(processo?.entregues ?? 0);
    if (total > 0 && entregues >= total) return ESTADOS.aguardando_equipe;
  }
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

/** Linha do painel, do ponto de vista do vínculo peça↔processo. */
export interface ProcessoParaVinculo {
  processo_id: string;
  cliente_id: number;
}

/**
 * Liga cada peça ao processo dela — inclusive a peça que ainda não tem vínculo.
 *
 * `qa_geracoes_pecas.processo_id` só é preenchido quando a equipe envia a peça
 * ao cliente (é a função `qa-peca-enviar-cliente` que grava). Antes disso a peça
 * nasce com `cliente_id` e nada mais, então a minuta pronta e nunca enviada —
 * justamente a que a equipe precisa enxergar — ficaria invisível no painel.
 *
 * Para essas, o vínculo é pelo cliente, e só quando ele tem UM processo ativo.
 * Com dois ou mais não dá para adivinhar de qual processo é a peça, e chutar
 * seria pior do que não mostrar: acenderia o chip no processo errado.
 */
export function vincularPecas<T extends PecaDoProcesso>(
  processos: readonly ProcessoParaVinculo[],
  pecas: readonly T[],
): Record<string, T[]> {
  const mapa = pecasPorProcesso(pecas);

  const processosDoCliente: Record<number, string[]> = {};
  for (const r of processos ?? []) {
    if (r?.cliente_id == null || !r?.processo_id) continue;
    (processosDoCliente[r.cliente_id] ||= []).push(r.processo_id);
  }

  for (const p of pecas ?? []) {
    if (p?.processo_id) continue;
    const cid = p?.cliente_id;
    if (cid == null) continue;
    const candidatos = processosDoCliente[cid] ?? [];
    if (candidatos.length !== 1) continue;
    (mapa[candidatos[0]] ||= []).push(p);
  }

  return mapa;
}
