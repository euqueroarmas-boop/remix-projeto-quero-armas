// ============================================================================
// kanbanChecklist.ts
// ----------------------------------------------------------------------------
// Motor do "Painel Kanban de Exigências" (admin → Configurações → Checklist).
//
// Modelo: cada SERVIÇO do catálogo vira um quadro; cada GRUPO (coluna) vem de
// qa_checklist_grupos (globais = servico_id null, extras = servico_id do
// serviço). As exigências ficam num RASCUNHO (qa_checklist_rascunhos.itens),
// e só afetam clientes quando o admin clica em "Publicar", que reescreve
// qa_servicos_documentos (com snapshot antes).
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { grupoDaPendencia } from "./pendenciasGrupos";

export interface KanbanGrupo {
  id: string;
  slug: string;
  nome: string;
  cor: string;
  ordem: number;
  servico_id: number | null;
  ativo: boolean;
}

export interface KanbanItem {
  uid: string;
  biblioteca_id: string | null;
  tipo_documento: string;
  nome_documento: string;
  grupo_slug: string;
  obrigatorio: boolean;
  etapa: string;
  validade_dias: number | null;
  formato_aceito: string[] | null;
  link_emissao: string | null;
  instrucoes: string | null;
  observacoes_cliente: string | null;
  regra_validacao: any | null;
}

export interface KanbanRascunho {
  servico_id: number;
  itens: KanbanItem[];
  publicado_em: string | null;
  /** true = rascunho ainda não existia no banco (derivado do publicado). */
  novo: boolean;
}

export function novoUid(): string {
  return `k_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Grupos visíveis para um serviço: globais + extras daquele serviço. */
export function gruposDoServico(todos: KanbanGrupo[], servicoId: number): KanbanGrupo[] {
  return todos
    .filter((g) => g.ativo && (g.servico_id === null || g.servico_id === servicoId))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function carregarGrupos(): Promise<KanbanGrupo[]> {
  const { data } = await supabase
    .from("qa_checklist_grupos" as any)
    .select("id, slug, nome, cor, ordem, servico_id, ativo")
    .order("ordem");
  return ((data as any[]) ?? []) as KanbanGrupo[];
}

/** Slug do grupo para uma linha publicada (usa grupo_id quando existir). */
function slugDaLinha(row: any, grupos: KanbanGrupo[]): string {
  if (row.grupo_id) {
    const g = grupos.find((x) => x.id === row.grupo_id);
    if (g) return g.slug;
  }
  return grupoDaPendencia(row.tipo_documento).id;
}

function linhaParaItem(row: any, grupos: KanbanGrupo[]): KanbanItem {
  return {
    uid: novoUid(),
    biblioteca_id: row.biblioteca_id ?? null,
    tipo_documento: row.tipo_documento,
    nome_documento: row.nome_documento ?? row.tipo_documento,
    grupo_slug: slugDaLinha(row, grupos),
    obrigatorio: row.obrigatorio !== false,
    etapa: row.etapa || "base",
    validade_dias: row.validade_dias ?? null,
    formato_aceito: row.formato_aceito ?? null,
    link_emissao: row.link_emissao ?? null,
    instrucoes: row.instrucoes ?? null,
    observacoes_cliente: row.observacoes_cliente ?? null,
    regra_validacao: row.regra_validacao ?? null,
  };
}

/** Lê o publicado (qa_servicos_documentos) já no formato de cards. */
export async function carregarPublicado(servicoId: number, grupos: KanbanGrupo[]): Promise<KanbanItem[]> {
  const { data } = await supabase
    .from("qa_servicos_documentos" as any)
    .select(
      "id, biblioteca_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, grupo_id, validade_dias, formato_aceito, link_emissao, instrucoes, observacoes_cliente, regra_validacao",
    )
    .eq("servico_id", servicoId)
    .eq("ativo", true)
    .order("ordem");
  return ((data as any[]) ?? []).map((r) => linhaParaItem(r, grupos));
}

/** Carrega o rascunho; se não existir, deriva do que está publicado. */
export async function carregarRascunho(servicoId: number, grupos: KanbanGrupo[]): Promise<KanbanRascunho> {
  const { data } = await supabase
    .from("qa_checklist_rascunhos" as any)
    .select("servico_id, itens, publicado_em")
    .eq("servico_id", servicoId)
    .maybeSingle();

  if (data && Array.isArray((data as any).itens) && (data as any).itens.length > 0) {
    return {
      servico_id: servicoId,
      itens: ((data as any).itens as KanbanItem[]).map((i) => ({ ...i, uid: i.uid || novoUid() })),
      publicado_em: (data as any).publicado_em ?? null,
      novo: false,
    };
  }

  const itens = await carregarPublicado(servicoId, grupos);
  return { servico_id: servicoId, itens, publicado_em: (data as any)?.publicado_em ?? null, novo: true };
}

export async function salvarRascunho(servicoId: number, itens: KanbanItem[]): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("qa_checklist_rascunhos" as any)
    .upsert(
      { servico_id: servicoId, itens: itens as any, atualizado_por: auth?.user?.id ?? null },
      { onConflict: "servico_id" },
    );
  if (error) throw error;
}

export async function descartarRascunho(servicoId: number): Promise<void> {
  await supabase.from("qa_checklist_rascunhos" as any).delete().eq("servico_id", servicoId);
}

/**
 * Publica o rascunho: snapshot do estado atual → reescreve as exigências reais.
 * A ordem final respeita a ordem das colunas e a posição do card dentro dela.
 */
export async function publicarRascunho(
  servicoId: number,
  itens: KanbanItem[],
  grupos: KanbanGrupo[],
): Promise<void> {
  const visiveis = gruposDoServico(grupos, servicoId);
  const idPorSlug = new Map<string, string>();
  for (const g of visiveis) idPorSlug.set(g.slug, g.id);
  const ordemGrupo = new Map<string, number>();
  visiveis.forEach((g, i) => ordemGrupo.set(g.slug, i));

  const ordenados = [...itens].sort(
    (a, b) => (ordemGrupo.get(a.grupo_slug) ?? 999) - (ordemGrupo.get(b.grupo_slug) ?? 999),
  );

  // Snapshot antes de qualquer escrita destrutiva.
  const { data: atuais } = await supabase
    .from("qa_servicos_documentos" as any)
    .select("*")
    .eq("servico_id", servicoId);
  if (atuais && (atuais as any[]).length > 0) {
    await supabase.from("qa_servicos_documentos_snapshots" as any).insert({
      servico_id: servicoId,
      motivo: "kanban_publicacao",
      payload: atuais,
    });
  }

  const payload = ordenados.map((it, idx) => ({
    servico_id: servicoId,
    biblioteca_id: it.biblioteca_id,
    tipo_documento: it.tipo_documento,
    nome_documento: it.nome_documento,
    etapa: it.etapa || "base",
    obrigatorio: it.obrigatorio,
    ordem: (idx + 1) * 10,
    grupo_id: idPorSlug.get(it.grupo_slug) ?? null,
    validade_dias: it.validade_dias,
    formato_aceito: it.formato_aceito,
    link_emissao: it.link_emissao,
    instrucoes: it.instrucoes,
    observacoes_cliente: it.observacoes_cliente,
    regra_validacao: it.regra_validacao,
    ativo: true,
  }));

  const { error: errDel } = await supabase
    .from("qa_servicos_documentos" as any)
    .delete()
    .eq("servico_id", servicoId);
  if (errDel) throw errDel;

  if (payload.length > 0) {
    const { error } = await supabase.from("qa_servicos_documentos" as any).insert(payload as any[]);
    if (error) throw error;
  }

  await supabase
    .from("qa_checklist_rascunhos" as any)
    .upsert(
      { servico_id: servicoId, itens: itens as any, publicado_em: new Date().toISOString() },
      { onConflict: "servico_id" },
    );
}

/** Compara rascunho x publicado para exibir o selo "alterações não publicadas". */
export function assinaturaItens(itens: KanbanItem[]): string {
  return itens
    .map((i) => `${i.grupo_slug}|${i.tipo_documento}|${i.obrigatorio ? 1 : 0}`)
    .join("§");
}