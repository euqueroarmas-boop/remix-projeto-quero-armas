import {
  itemCumpridoGuia,
  itemVisivelGuia,
  isPerguntaGuia,
  type GuiaDoc,
} from "./checklistGuiadoEngine";
import { ehTipoEfetivaNecessidade, type EfetivaPasso } from "./efetivaNecessidadePassos";
import { grupoDaPendencia, normalizarGrupoId, PENDENCIA_GRUPOS } from "./pendenciasGrupos";
import { isDocEmAnalise, isReaproveitamento } from "./statusDocumento";

export interface ChecklistProjecaoGrupo {
  id: string;
  label: string;
  ordem: number;
  total: number;
  concluidos: number;
}

export interface ChecklistProjecao {
  totalObrigatorios: number;
  concluidos: number;
  documentosPendentes: number;
  perguntasPendentes: number;
  emAnalise: number;
  reaproveitados: number;
  grupos: ChecklistProjecaoGrupo[];
  grupoAtual: ChecklistProjecaoGrupo | null;
  proximoItem: GuiaDoc | null;
}

interface ProcessoLike {
  id: string;
  servico_id?: number | null;
  respostas_questionario_json?: Record<string, string> | null;
}

interface CatalogoGrupoLike {
  grupo_checklist?: string | null;
  ordem_grupo_checklist?: number | null;
}

interface ProjetarChecklistInput {
  docs: GuiaDoc[];
  processos: ProcessoLike[];
  efetivaPassos: Record<string, EfetivaPasso[]>;
  catalogoGrupo?: Map<string, CatalogoGrupoLike>;
}

/**
 * Projeção canônica de leitura do checklist.
 *
 * O caminho histórico mantém toda exigência obrigatória criada para o processo,
 * inclusive itens resolvidos por dispensa/reaproveitamento. Já os contadores de
 * pendência e a próxima ação respeitam as condições ativas do mesmo motor da fila.
 */
export function projetarChecklist({
  docs,
  processos,
  efetivaPassos,
  catalogoGrupo = new Map(),
}: ProjetarChecklistInput): ChecklistProjecao {
  const processoPorId = new Map(processos.map((p) => [String(p.id), p]));
  const obrigatorios = docs.filter((d) => d?.obrigatorio === true);
  const mapaGrupos = new Map<string, ChecklistProjecaoGrupo>();

  const respostasDe = (d: GuiaDoc): Record<string, string> =>
    processoPorId.get(String(d.processo_id))?.respostas_questionario_json ?? {};

  const grupoDe = (d: GuiaDoc) => {
    const processo = processoPorId.get(String(d.processo_id));
    const config = processo?.servico_id != null
      ? catalogoGrupo.get(`${processo.servico_id}:${String(d.tipo_documento ?? "").toLowerCase()}`)
      : undefined;
    const override = normalizarGrupoId(config?.grupo_checklist);
    const base = override ? PENDENCIA_GRUPOS[override] : grupoDaPendencia(d.tipo_documento, null);
    return {
      ...base,
      ordem: config?.ordem_grupo_checklist ?? base.ordem,
    };
  };

  const passosDe = (d: GuiaDoc): EfetivaPasso[] | null => {
    if (!ehTipoEfetivaNecessidade(d.tipo_documento)) return null;
    const passos = efetivaPassos[String(d.processo_id)];
    return passos?.length ? passos : null;
  };

  let concluidos = 0;
  let documentosPendentes = 0;
  let perguntasPendentes = 0;
  let emAnalise = 0;
  let reaproveitados = 0;
  let totalObrigatorios = 0;
  const acionaveis: Array<{ doc: GuiaDoc; ordemGrupo: number; ordemItem: number }> = [];

  for (const d of obrigatorios) {
    const respostas = respostasDe(d);
    const passos = passosDe(d);
    const grupo = grupoDe(d);
    const atual = mapaGrupos.get(grupo.id) ?? { ...grupo, total: 0, concluidos: 0 };
    const unidades = passos?.length ?? 1;
    const unidadesConcluidas = passos
      ? passos.filter((p) => p.concluido).length
      : itemCumpridoGuia(d, respostas) ? 1 : 0;

    totalObrigatorios += unidades;
    concluidos += unidadesConcluidas;
    atual.total += unidades;
    atual.concluidos += unidadesConcluidas;
    mapaGrupos.set(grupo.id, atual);

    if (isReaproveitamento(d.status) && String(d.status).toLowerCase() === "dispensado_por_reaproveitamento") {
      reaproveitados += 1;
    }

    // Condições inativas continuam no histórico, mas não são dívida do cliente.
    if (!itemVisivelGuia(d, respostas) || unidadesConcluidas >= unidades) continue;
    if (isDocEmAnalise(d.status)) {
      emAnalise += 1;
      continue;
    }

    if (passos) documentosPendentes += passos.length - unidadesConcluidas;
    else if (isPerguntaGuia(d)) perguntasPendentes += 1;
    else documentosPendentes += 1;

    acionaveis.push({
      doc: d,
      ordemGrupo: grupo.ordem,
      ordemItem: Number.isFinite(Number(d.ordem)) ? Number(d.ordem) : 9_999,
    });
  }

  acionaveis.sort((a, b) =>
    a.ordemGrupo - b.ordemGrupo ||
    a.ordemItem - b.ordemItem ||
    String(a.doc.created_at ?? "").localeCompare(String(b.doc.created_at ?? "")),
  );
  const proximoItem = acionaveis[0]?.doc ?? null;
  const grupoAtualId = proximoItem ? grupoDe(proximoItem).id : null;
  const grupos = [...mapaGrupos.values()].sort((a, b) => a.ordem - b.ordem);

  return {
    totalObrigatorios,
    concluidos,
    documentosPendentes,
    perguntasPendentes,
    emAnalise,
    reaproveitados,
    grupos,
    grupoAtual: grupos.find((g) => g.id === grupoAtualId) ?? null,
    proximoItem,
  };
}