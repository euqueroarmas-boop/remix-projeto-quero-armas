// ============================================================================
// KanbanExigenciasAdmin
// ----------------------------------------------------------------------------
// Painel Kanban das exigências por serviço do catálogo.
//  • Colunas = grupos (globais + extras do serviço) — criar / editar / excluir.
//  • Cards   = exigências vindas da biblioteca de documentos.
//  • Arraste dentro do quadro = mover de grupo. Arraste entre quadros = COPIAR
//    a exigência de um processo para outro.
//  • Tudo é rascunho: só o botão "Publicar" grava nas exigências reais do
//    cliente (com snapshot automático antes).
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Columns3, Plus, Trash2, Loader2, Search, X, Check, Pencil,
  Upload, RotateCcw, GripVertical, Copy, AlertTriangle,
} from "lucide-react";
import {
  DndContext, DragOverlay, closestCenter, PointerSensor,
  useSensor, useSensors, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  KanbanGrupo, KanbanItem, carregarGrupos, carregarRascunho, carregarPublicado,
  descartarRascunho, gruposDoServico, novoUid, publicarRascunho, salvarRascunho,
  assinaturaItens,
} from "@/lib/quero-armas/kanbanChecklist";

type Servico = { id: number; nome_servico: string };
type BibItem = {
  id: string; codigo: string; nome: string; categoria: string;
  descricao_como_enviar: string | null; observacao_cliente: string | null;
  validade_dias: number | null; formato_aceito: string[] | null; link_emissao: string | null;
};

type Estado = {
  itens: KanbanItem[];
  publicadoSig: string;
};

const CARD_BASE =
  "group rounded-lg border border-[#E3DED5] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export default function KanbanExigenciasAdmin() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [grupos, setGrupos] = useState<KanbanGrupo[]>([]);
  const [biblioteca, setBiblioteca] = useState<BibItem[]>([]);
  const [quadros, setQuadros] = useState<number[]>([]);
  const [estado, setEstado] = useState<Record<number, Estado>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [publicando, setPublicando] = useState<number | null>(null);
  const [picker, setPicker] = useState<{ servicoId: number; grupoSlug: string } | null>(null);
  const [busca, setBusca] = useState("");
  const [gerenciarGrupos, setGerenciarGrupos] = useState(false);

  // ── carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [gs, sv, bib] = await Promise.all([
        carregarGrupos(),
        (async () => {
          const { data: catRows } = await supabase
            .from("qa_servicos_catalogo" as any)
            .select("servico_id, nome, display_order")
            .eq("ativo", true)
            .not("servico_id", "is", null)
            .order("display_order", { ascending: true })
            .order("nome", { ascending: true });
          const dedup = new Map<number, Servico>();
          ((catRows as any[]) ?? []).forEach((r: any) => {
            const id = Number(r.servico_id);
            if (Number.isFinite(id) && !dedup.has(id))
              dedup.set(id, { id, nome_servico: String(r.nome || "").trim() });
          });
          return { data: Array.from(dedup.values()), error: null };
        })(),
        supabase
          .from("qa_documentos_biblioteca" as any)
          .select("id, codigo, nome, categoria, descricao_como_enviar, observacao_cliente, validade_dias, formato_aceito, link_emissao")
          .eq("ativo", true)
          .order("nome"),
      ]);
      setGrupos(gs);
      setServicos(((sv.data as any[]) ?? []) as Servico[]);
      setBiblioteca(((bib.data as any[]) ?? []) as BibItem[]);
      setLoading(false);
    })();
  }, []);

  async function abrirQuadro(servicoId: number) {
    if (quadros.includes(servicoId)) return;
    const rasc = await carregarRascunho(servicoId, grupos);
    const publicado = await carregarPublicado(servicoId, grupos);
    setEstado((prev) => ({
      ...prev,
      [servicoId]: { itens: rasc.itens, publicadoSig: assinaturaItens(publicado) },
    }));
    setQuadros((q) => [...q, servicoId]);
  }

  function fecharQuadro(servicoId: number) {
    setQuadros((q) => q.filter((s) => s !== servicoId));
  }

  function nomeServico(id: number) {
    return servicos.find((s) => s.id === id)?.nome_servico ?? `Serviço #${id}`;
  }

  // ── mutações de rascunho ────────────────────────────────────────────────
  function mutar(servicoId: number, fn: (itens: KanbanItem[]) => KanbanItem[]) {
    setEstado((prev) => {
      const atual = prev[servicoId];
      if (!atual) return prev;
      return { ...prev, [servicoId]: { ...atual, itens: fn(atual.itens) } };
    });
  }

  async function persistir(servicoId: number) {
    const itens = estado[servicoId]?.itens ?? [];
    setSalvando(servicoId);
    try {
      await salvarRascunho(servicoId, itens);
      toast.success("Rascunho salvo");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar rascunho");
    } finally {
      setSalvando(null);
    }
  }

  async function publicar(servicoId: number) {
    const itens = estado[servicoId]?.itens ?? [];
    if (!confirm(`Publicar as exigências de "${nomeServico(servicoId)}"? Isso passa a valer para os clientes.`)) return;
    setPublicando(servicoId);
    try {
      await publicarRascunho(servicoId, itens, grupos);
      const publicado = await carregarPublicado(servicoId, grupos);
      setEstado((prev) => ({ ...prev, [servicoId]: { itens, publicadoSig: assinaturaItens(publicado) } }));
      toast.success("Exigências publicadas para os clientes");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao publicar");
    } finally {
      setPublicando(null);
    }
  }

  async function descartar(servicoId: number) {
    if (!confirm("Descartar o rascunho e voltar ao que está publicado?")) return;
    await descartarRascunho(servicoId);
    const publicado = await carregarPublicado(servicoId, grupos);
    setEstado((prev) => ({ ...prev, [servicoId]: { itens: publicado, publicadoSig: assinaturaItens(publicado) } }));
    toast.success("Rascunho descartado");
  }

  // ── drag & drop (@dnd-kit) ──────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [dragging, setDragging] = useState<{ servicoId: number; item: KanbanItem } | null>(null);

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { servicoId: number; uid: string } | undefined;
    if (!data) return;
    const item = estado[data.servicoId]?.itens.find((i) => i.uid === data.uid);
    if (item) setDragging({ servicoId: data.servicoId, item });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;
    const activeData = active.data.current as { servicoId: number; uid: string } | undefined;
    const overData = over.data.current as { servicoId: number; grupoSlug: string } | undefined;
    if (!activeData || !overData) return;
    const { servicoId: origem, uid } = activeData;
    const { servicoId: destServicoId, grupoSlug } = overData;
    const item = estado[origem]?.itens.find((i) => i.uid === uid);
    if (!item) return;

    if (origem === destServicoId) {
      if (item.grupo_slug === grupoSlug) return;
      mutar(destServicoId, (itens) =>
        itens.map((i) => (i.uid === uid ? { ...i, grupo_slug: grupoSlug } : i)),
      );
      return;
    }
    // Entre quadros = cópia (mantém no processo de origem).
    const jaTem = (estado[destServicoId]?.itens ?? []).some((i) => i.tipo_documento === item.tipo_documento);
    if (jaTem) { toast.error("Este processo já tem essa exigência"); return; }
    mutar(destServicoId, (itens) => [...itens, { ...item, uid: novoUid(), grupo_slug: grupoSlug }]);
    toast.success(`"${item.nome_documento}" copiado para ${nomeServico(destServicoId)}`);
  }

  // ── adicionar da biblioteca ─────────────────────────────────────────────
  function adicionar(bib: BibItem) {
    if (!picker) return;
    const { servicoId, grupoSlug } = picker;
    const jaTem = (estado[servicoId]?.itens ?? []).some((i) => i.tipo_documento === bib.codigo);
    if (jaTem) { toast.error("Exigência já está neste processo"); return; }
    mutar(servicoId, (itens) => [
      ...itens,
      {
        uid: novoUid(),
        biblioteca_id: bib.id,
        tipo_documento: bib.codigo,
        nome_documento: bib.nome,
        grupo_slug: grupoSlug,
        obrigatorio: true,
        etapa: "base",
        validade_dias: bib.validade_dias,
        formato_aceito: bib.formato_aceito,
        link_emissao: bib.link_emissao,
        instrucoes: bib.descricao_como_enviar,
        observacoes_cliente: bib.observacao_cliente,
        regra_validacao: null,
      },
    ]);
    toast.success(`"${bib.nome}" adicionado`);
  }

  const bibFiltrada = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const usados = new Set((picker ? estado[picker.servicoId]?.itens ?? [] : []).map((i) => i.tipo_documento));
    return biblioteca
      .filter((i) => (b ? i.nome.toLowerCase().includes(b) || i.codigo.toLowerCase().includes(b) : true))
      .map((i) => ({ ...i, jaUsado: usados.has(i.codigo) }));
  }, [biblioteca, busca, picker, estado]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-600 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando painel…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]">
            <Columns3 className="h-4 w-4 text-[#7A1F2B]" /> Painel Kanban de Exigências
          </h2>
          <p className="mt-1 text-[11px] text-slate-600">
            Abra um ou mais processos, arraste exigências entre grupos e entre processos. Nada afeta o cliente
            até você clicar em <strong>Publicar</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-[#E3DED5] bg-white px-2 text-[12px] text-slate-800"
            value=""
            onChange={(e) => e.target.value && abrirQuadro(Number(e.target.value))}
          >
            <option value="">+ Abrir processo…</option>
            {servicos.filter((s) => !quadros.includes(s.id)).map((s) => (
              <option key={s.id} value={s.id}>{s.nome_servico}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setGerenciarGrupos(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E3DED5] bg-white px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Grupos
          </button>
        </div>
      </div>

      {quadros.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#E3DED5] bg-[#FAF6F1] p-8 text-center text-[12px] text-slate-600">
          Escolha um processo do catálogo acima para montar o quadro.
        </div>
      )}

      {/* Quadros — um por processo, colunas (grupos) lado a lado */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="space-y-5">
          {quadros.map((servicoId) => {
            const st = estado[servicoId];
            const cols = gruposDoServico(grupos, servicoId);
            const alterado = st ? assinaturaItens(st.itens) !== st.publicadoSig : false;
            return (
              <div key={servicoId} className="rounded-xl border border-[#E3DED5] bg-[#FAF6F1] p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-bold uppercase tracking-[0.1em] text-[#0A0A0A]">
                      {nomeServico(servicoId)}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                      {st?.itens.length ?? 0} exigências
                      {alterado && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[#7A1F2B]">
                          <AlertTriangle className="h-3 w-3" /> não publicado
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => fecharQuadro(servicoId)} className="text-slate-400 hover:text-[#7A1F2B]">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => persistir(servicoId)}
                    disabled={salvando === servicoId}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E3DED5] bg-white px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700 hover:bg-slate-50"
                  >
                    {salvando === servicoId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Salvar rascunho
                  </button>
                  <button
                    type="button"
                    onClick={() => publicar(servicoId)}
                    disabled={publicando === servicoId}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#7A1F2B] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#631a23]"
                  >
                    {publicando === servicoId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Publicar
                  </button>
                  <button
                    type="button"
                    onClick={() => descartar(servicoId)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E3DED5] bg-white px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Descartar
                  </button>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {cols.map((g) => (
                    <KanbanColuna
                      key={g.id}
                      servicoId={servicoId}
                      grupo={g}
                      cards={(st?.itens ?? []).filter((i) => i.grupo_slug === g.slug)}
                      onAdd={() => { setBusca(""); setPicker({ servicoId, grupoSlug: g.slug }); }}
                      onToggleObrig={(uid) =>
                        mutar(servicoId, (itens) =>
                          itens.map((x) => (x.uid === uid ? { ...x, obrigatorio: !x.obrigatorio } : x)),
                        )
                      }
                      onRemove={(uid) => mutar(servicoId, (itens) => itens.filter((x) => x.uid !== uid))}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {dragging ? (
            <div className={`${CARD_BASE} w-[260px] shadow-lg`}>
              <div className="flex items-start gap-1.5">
                <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold leading-snug text-[#0A0A0A]">
                    {dragging.item.nome_documento}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-slate-400">
                    {dragging.item.tipo_documento}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {quadros.length > 1 && (
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
          <Copy className="h-3 w-3" /> Arrastar um card para outro processo copia a exigência (não remove da origem).
        </p>
      )}

      {/* Picker da biblioteca */}
      {picker && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setPicker(null)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#E3DED5] px-4 py-3 pr-12 relative">
              <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]">Adicionar exigência</div>
              <button type="button" onClick={() => setPicker(null)} className="absolute right-3 top-3 rounded-md bg-[#7A1F2B] p-1 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-[#E3DED5] p-3">
              <div className="flex items-center gap-2 rounded-md border border-[#E3DED5] px-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar na biblioteca…"
                  className="h-9 w-full bg-transparent text-[12px] outline-none"
                />
              </div>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {bibFiltrada.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={b.jaUsado}
                  onClick={() => { adicionar(b); setPicker(null); }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-[#FAF6F1] disabled:opacity-40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-[#0A0A0A]">{b.nome}</div>
                    <div className="truncate text-[9px] uppercase tracking-wider text-slate-400">{b.codigo}</div>
                  </div>
                  {b.jaUsado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Plus className="h-3.5 w-3.5 text-slate-400" />}
                </button>
              ))}
              {bibFiltrada.length === 0 && (
                <div className="p-4 text-center text-[11px] text-slate-500">Nenhum documento encontrado.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {gerenciarGrupos && (
        <GerenciarGruposModal
          grupos={grupos}
          servicos={servicos}
          onClose={() => setGerenciarGrupos(false)}
          onChanged={async () => setGrupos(await carregarGrupos())}
        />
      )}
    </div>
  );
}

// ============================================================================
// Coluna (grupo) — área onde os cards podem ser soltos
// ============================================================================
function KanbanColuna({
  servicoId, grupo, cards, onAdd, onToggleObrig, onRemove,
}: {
  servicoId: number;
  grupo: KanbanGrupo;
  cards: KanbanItem[];
  onAdd: () => void;
  onToggleObrig: (uid: string) => void;
  onRemove: (uid: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${servicoId}::${grupo.slug}`,
    data: { servicoId, grupoSlug: grupo.slug },
  });

  return (
    <div className="flex w-[260px] shrink-0 flex-col rounded-lg border border-[#E9E4DB] bg-white/70">
      <div className="flex items-center justify-between gap-2 border-b border-[#E9E4DB] px-2 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: grupo.cor }} />
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">
            {grupo.nome}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400">({cards.length})</span>
          {grupo.servico_id !== null && (
            <span className="shrink-0 rounded bg-[#7A1F2B]/10 px-1 text-[9px] font-bold uppercase text-[#7A1F2B]">extra</span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 text-slate-400 hover:text-[#7A1F2B]"
          title="Adicionar exigência neste grupo"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        style={{ minHeight: 72 }}
        className={`flex-1 space-y-1.5 p-2 transition-colors ${
          isOver ? "bg-[#7A1F2B]/5 ring-2 ring-inset ring-[#7A1F2B]/30" : ""
        }`}
      >
        {cards.length === 0 && (
          <div className="rounded border border-dashed border-[#E9E4DB] px-2 py-3 text-center text-[10px] text-slate-400">
            Arraste uma exigência para cá
          </div>
        )}
        {cards.map((it) => (
          <KanbanCard
            key={it.uid}
            servicoId={servicoId}
            item={it}
            onToggleObrig={() => onToggleObrig(it.uid)}
            onRemove={() => onRemove(it.uid)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Card — exigência arrastável
// ============================================================================
function KanbanCard({
  servicoId, item, onToggleObrig, onRemove,
}: {
  servicoId: number;
  item: KanbanItem;
  onToggleObrig: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.uid,
    data: { servicoId, uid: item.uid },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className={CARD_BASE}>
      <div className="flex items-start gap-1.5">
        <span
          {...listeners}
          {...attributes}
          role="button"
          tabIndex={0}
          aria-label="Arrastar exigência"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-slate-300 hover:text-slate-500"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold leading-snug text-[#0A0A0A]">{item.nome_documento}</div>
          <div className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-slate-400">
            {item.tipo_documento}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={item.obrigatorio ? "Obrigatória" : "Opcional"}
            onClick={onToggleObrig}
            className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
              item.obrigatorio ? "bg-[#7A1F2B] text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {item.obrigatorio ? "obrig." : "opc."}
          </button>
          <button type="button" title="Remover do processo" onClick={onRemove} className="text-slate-300 hover:text-[#7A1F2B]">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Modal de grupos (colunas)
// ============================================================================
function GerenciarGruposModal({
  grupos, servicos, onClose, onChanged,
}: {
  grupos: KanbanGrupo[];
  servicos: Servico[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#7A1F2B");
  const [escopo, setEscopo] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  function slugify(v: string) {
    return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  async function criar() {
    const n = nome.trim();
    if (!n) { toast.error("Informe o nome do grupo"); return; }
    setSalvando(true);
    try {
      const maxOrdem = grupos.reduce((m, g) => Math.max(m, g.ordem), 0);
      const { error } = await supabase.from("qa_checklist_grupos" as any).insert({
        slug: slugify(n),
        nome: n,
        cor,
        ordem: maxOrdem + 1,
        servico_id: escopo ? Number(escopo) : null,
      });
      if (error) throw error;
      setNome("");
      await onChanged();
      toast.success("Grupo criado");
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Já existe um grupo com esse nome neste escopo" : e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function atualizar(g: KanbanGrupo, patch: Partial<KanbanGrupo>) {
    const { error } = await supabase.from("qa_checklist_grupos" as any).update(patch as any).eq("id", g.id);
    if (error) { toast.error(error.message); return; }
    await onChanged();
  }

  async function excluir(g: KanbanGrupo) {
    if (!confirm(`Excluir o grupo "${g.nome}"? As exigências dele voltam para "Outros documentos".`)) return;
    const { error } = await supabase.from("qa_checklist_grupos" as any).delete().eq("id", g.id);
    if (error) { toast.error(error.message); return; }
    await onChanged();
    toast.success("Grupo excluído");
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative border-b border-[#E3DED5] px-4 py-3 pr-12">
          <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]">Grupos do Kanban</div>
          <p className="mt-0.5 text-[10px] text-slate-500">Globais valem para todos os processos. Extras aparecem só no processo escolhido.</p>
          <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-md bg-[#7A1F2B] p-1 text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-[#E3DED5] p-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do novo grupo"
            className="h-9 w-full rounded-md border border-[#E3DED5] px-2 text-[12px] outline-none"
          />
          <div className="flex items-center gap-2">
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-10 rounded border border-[#E3DED5]" />
            <select
              value={escopo}
              onChange={(e) => setEscopo(e.target.value)}
              className="h-9 flex-1 rounded-md border border-[#E3DED5] px-2 text-[12px]"
            >
              <option value="">Global (todos os processos)</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>Extra — {s.nome_servico}</option>)}
            </select>
            <button
              type="button"
              onClick={criar}
              disabled={salvando}
              className="inline-flex h-9 items-center gap-1 rounded-md bg-[#7A1F2B] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
            >
              {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Criar
            </button>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {grupos.map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#FAF6F1]">
              <input
                type="color"
                value={g.cor}
                onChange={(e) => atualizar(g, { cor: e.target.value })}
                className="h-6 w-6 rounded border border-[#E3DED5]"
              />
              <input
                defaultValue={g.nome}
                onBlur={(e) => e.target.value.trim() && e.target.value !== g.nome && atualizar(g, { nome: e.target.value.trim() })}
                className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[#0A0A0A] outline-none"
              />
              <input
                type="number"
                defaultValue={g.ordem}
                onBlur={(e) => Number(e.target.value) !== g.ordem && atualizar(g, { ordem: Number(e.target.value) })}
                className="w-14 rounded border border-[#E3DED5] px-1 text-[10px]"
                title="Ordem da coluna"
              />
              {g.servico_id !== null && (
                <span className="rounded bg-[#7A1F2B]/10 px-1 text-[9px] font-bold uppercase text-[#7A1F2B]">extra</span>
              )}
              <button type="button" onClick={() => excluir(g)} className="text-slate-300 hover:text-[#7A1F2B]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}