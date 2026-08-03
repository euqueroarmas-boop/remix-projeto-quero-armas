import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, PlayCircle, RotateCcw, CheckCircle2, CircleDashed, MinusCircle,
  Clock, AlertTriangle, ArrowRight, GripVertical,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  simularChecklist, CONDICOES, MODALIDADES,
  type LinhaCatalogo, type ItemSimulado,
} from "@/lib/quero-armas/simuladorChecklist";

type Servico = { id: number; nome_servico: string };

const INK = "hsl(220 20% 18%)";
const MUTED = "hsl(220 10% 45%)";
const LINE = "hsl(220 13% 91%)";
const BORDO = "#7A1F2B";

export default function SimuladorChecklistAdmin() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoId, setServicoId] = useState<number | null>(null);
  const [linhas, setLinhas] = useState<LinhaCatalogo[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);

  const [modalidade, setModalidade] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [entregues, setEntregues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("qa_servicos" as any)
        .select("id, nome_servico")
        .order("nome_servico");
      setServicos((data as any[])?.map((s) => ({ id: s.id, nome_servico: s.nome_servico })) ?? []);
    })();
  }, []);

  async function carregar(id: number) {
    setLoading(true);
    setRespostas({});
    setEntregues({});
    const { data } = await supabase
      .from("qa_servicos_documentos" as any)
      .select("*")
      .eq("servico_id", id)
      .order("ordem", { ascending: true });
    setLinhas(((data as any[]) ?? []) as LinhaCatalogo[]);
    setLoading(false);
  }

  const condicao = respostas["condicao_profissional"] ?? null;

  const sim = useMemo(
    () => simularChecklist({ linhas, condicao, modalidade, respostas, entregues }),
    [linhas, condicao, modalidade, respostas, entregues],
  );

  function responder(chave: string, valor: string) {
    setRespostas((p) => ({ ...p, [chave]: valor }));
  }
  function alternarEntrega(tipo: string) {
    setEntregues((p) => ({ ...p, [tipo]: !p[tipo] }));
  }
  function limparResposta(chave: string) {
    setRespostas((p) => {
      const n = { ...p };
      delete n[chave];
      return n;
    });
  }
  function reiniciar() {
    setRespostas({});
    setEntregues({});
  }

  const servicoNome = servicos.find((s) => s.id === servicoId)?.nome_servico ?? "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Reordena o que o cliente vê e grava a nova ordem em qa_servicos_documentos —
   * fonte única lida por TODOS os motores (Preços e Serviços / Montar Checklist,
   * catálogo, explosão do checklist do processo e portal do cliente).
   */
  async function persistirSequencia(novaOrdemVisivel: string[]) {
    // Ordem global: itens visíveis primeiro (na nova sequência), depois o restante
    // do catálogo do serviço preservando a ordem relativa atual.
    const restantes = [...linhas]
      .filter((l) => !novaOrdemVisivel.includes(l.id))
      .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
      .map((l) => l.id);
    const sequencia = [...novaOrdemVisivel, ...restantes];

    const mapaOrdem = new Map<string, number>();
    sequencia.forEach((id, idx) => mapaOrdem.set(id, (idx + 1) * 10));

    const anteriores = linhas;
    const atualizadas = linhas.map((l) => ({ ...l, ordem: mapaOrdem.get(l.id) ?? l.ordem }));
    setLinhas(atualizadas);

    const alterados = atualizadas.filter(
      (l) => l.ordem !== anteriores.find((a) => a.id === l.id)?.ordem,
    );
    if (alterados.length === 0) return;

    setSalvandoOrdem(true);
    try {
      for (const l of alterados) {
        const { error } = await supabase
          .from("qa_servicos_documentos" as any)
          .update({ ordem: l.ordem })
          .eq("id", l.id);
        if (error) throw error;
      }
      toast.success("ORDEM ATUALIZADA EM TODOS OS MOTORES DO CHECKLIST");
    } catch (e: any) {
      setLinhas(anteriores);
      toast.error("NÃO FOI POSSÍVEL SALVAR A ORDEM: " + (e?.message ?? "ERRO"));
    } finally {
      setSalvandoOrdem(false);
    }
  }

  /** Move um item dentro/entre grupos OU um grupo inteiro (id "grupo:<slug>"). */
  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // ── Arrasto de GRUPO INTEIRO ────────────────────────────────────────────
    if (activeId.startsWith("grupo:")) {
      const gruposIds = sim.grupos.map((g) => `grupo:${g.grupo}`);
      const overGrupo = overId.startsWith("grupo:")
        ? overId
        : `grupo:${sim.grupos.find((g) => g.itens.some((i) => i.id === overId))?.grupo ?? ""}`;
      const from = gruposIds.indexOf(activeId);
      const to = gruposIds.indexOf(overGrupo);
      if (from < 0 || to < 0 || from === to) return;
      const novaOrdemGrupos = arrayMove(gruposIds, from, to);
      const novaOrdemVisivel = novaOrdemGrupos.flatMap((gid) => {
        const slug = gid.slice("grupo:".length);
        return sim.grupos.find((g) => g.grupo === slug)?.itens.map((i) => i.id) ?? [];
      });
      await persistirSequencia(novaOrdemVisivel);
      return;
    }

    // ── Arrasto de ITEM ─────────────────────────────────────────────────────
    const visiveisIds = sim.grupos.flatMap((g) => g.itens.map((i) => i.id));
    const from = visiveisIds.indexOf(activeId);
    const to = visiveisIds.indexOf(overId);
    if (from < 0 || to < 0) return;
    await persistirSequencia(arrayMove(visiveisIds, from, to));
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho / seleção */}
      <div className="qa-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <PlayCircle className="h-4 w-4" style={{ color: BORDO }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            Simulador do Checklist
          </span>
        </div>
        <p className="text-[11px] mb-4" style={{ color: MUTED }}>
          Avance respondendo como o cliente responderia. O resultado usa exatamente as
          exigências cadastradas em Preços e Serviços / Montar Checklist — nada é inventado aqui.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-7">
            <label className="text-[10px] uppercase block mb-1" style={{ color: MUTED }}>Serviço</label>
            <select
              value={servicoId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setServicoId(id);
                if (id) carregar(id);
                else setLinhas([]);
              }}
              className="h-9 w-full rounded-md border bg-white px-2 text-xs uppercase"
              style={{ borderColor: LINE, color: INK }}
            >
              <option value="">SELECIONE O SERVIÇO...</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>{s.nome_servico}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] uppercase block mb-1" style={{ color: MUTED }}>Modalidade</label>
            <select
              value={modalidade ?? ""}
              onChange={(e) => setModalidade(e.target.value || null)}
              className="h-9 w-full rounded-md border bg-white px-2 text-xs uppercase"
              style={{ borderColor: LINE, color: INK }}
            >
              <option value="">TODAS</option>
              {MODALIDADES.map((m) => (
                <option key={m.valor} value={m.valor}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={reiniciar}
              disabled={!servicoId}
              className="h-9 w-full rounded-md border text-[11px] uppercase flex items-center justify-center gap-1 disabled:opacity-40"
              style={{ borderColor: LINE, color: INK }}
            >
              <RotateCcw className="h-3 w-3" /> Reiniciar
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="qa-card p-8 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: BORDO }} />
        </div>
      )}

      {!loading && servicoId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Coluna 1 — passo atual */}
          <div className="qa-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Passo atual do cliente
              </span>
              <span className="text-[10px] font-mono tabular-nums" style={{ color: MUTED }}>
                {sim.totalCumpridos}/{sim.totalCumpridos + sim.totalPendentes}
              </span>
            </div>

            <div className="h-1.5 w-full rounded-full mb-4" style={{ background: "hsl(220 13% 93%)" }}>
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${sim.progresso}%`,
                  background: sim.progresso >= 100 ? "#059669" : BORDO,
                }}
              />
            </div>

            {!sim.proximo && (
              <div
                className="rounded-lg border p-4 text-xs"
                style={{ borderColor: "#05966933", background: "#05966910", color: "#065F46" }}
              >
                CHECKLIST COMPLETO — o cliente não tem mais nenhuma exigência aberta nesta
                combinação de respostas.
              </div>
            )}

            {sim.proximo && (
              <div className="rounded-lg border p-4" style={{ borderColor: LINE }}>
                <div className="text-[10px] uppercase mb-1" style={{ color: BORDO }}>
                  {sim.proximo.rotuloGrupo} · ORDEM {sim.proximo.ordem}
                </div>
                <div className="text-sm font-semibold mb-3" style={{ color: INK }}>
                  {sim.proximo.nome_documento}
                </div>

                {sim.proximo.tipo === "pergunta" && sim.proximo.opcoes?.length ? (
                  <div className="flex flex-col gap-2">
                    {sim.proximo.opcoes.map((o) => (
                      <button
                        key={o.valor}
                        onClick={() => responder(sim.proximo!.chave as string, o.valor)}
                        className="h-9 rounded-md border px-3 text-[11px] uppercase text-left hover:bg-slate-50"
                        style={{ borderColor: LINE, color: INK }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : sim.proximo.tipo === "pergunta" ? (
                  <div className="text-[11px]" style={{ color: "#B91C1C" }}>
                    Esta pergunta não tem opções cadastradas em regra_validacao.opcoes — o cliente
                    ficaria travado aqui.
                  </div>
                ) : (
                  <button
                    onClick={() => alternarEntrega(sim.proximo!.tipo_documento)}
                    className="h-9 w-full rounded-md text-[11px] uppercase text-white"
                    style={{ background: BORDO }}
                  >
                    Simular envio deste documento
                  </button>
                )}

                <div className="mt-3 text-[10px] font-mono" style={{ color: MUTED }}>
                  {sim.proximo.tipo_documento} · etapa {sim.proximo.etapa}
                  {sim.proximo.obrigatorio ? " · OBRIGATÓRIO" : " · OPCIONAL"}
                </div>
              </div>
            )}

            {sim.alertas.length > 0 && (
              <div className="mt-4 space-y-2">
                {sim.alertas.map((a, i) => (
                  <div
                    key={i}
                    className="flex gap-2 rounded-lg border p-2.5 text-[11px]"
                    style={{
                      borderColor: a.nivel === "erro" ? "#B91C1C33" : "#D9770633",
                      background: a.nivel === "erro" ? "#B91C1C0D" : "#D977060D",
                      color: a.nivel === "erro" ? "#991B1B" : "#92400E",
                    }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-[1px]" />
                    <span>{a.texto}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coluna 2 — checklist projetado */}
          <div className="qa-card p-5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5" style={{ color: BORDO }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                  O que o cliente vê — {servicoNome}
                </span>
              </div>
              {salvandoOrdem && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: BORDO }} />}
            </div>
            <p className="text-[10px] mb-3" style={{ color: MUTED }}>
              Arraste pelo punho ⠿ do item para reordenar dentro/entre grupos, ou pelo punho do
              título do grupo para mover o grupo inteiro. A nova ordem é gravada no
              catálogo e passa a valer em todos os motores (Preços e Serviços, Montar Checklist,
              processos e portal do cliente).
            </p>

            <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={sim.grupos.map((g) => `grupo:${g.grupo}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {sim.grupos.map((g) => (
                    <BlocoGrupo key={g.grupo} grupo={g}>
                      <SortableContext
                        items={g.itens.map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1">
                          {g.itens.map((i) => (
                            <LinhaItem
                              key={i.id}
                              item={i}
                              onToggle={alternarEntrega}
                              onResponder={responder}
                              onLimparResposta={limparResposta}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </BlocoGrupo>
                  ))}
                </SortableContext>
              </DndContext>
              {sim.grupos.length === 0 && (
                <p className="text-xs py-6 text-center" style={{ color: MUTED }}>
                  Nenhuma exigência ativa para esta combinação.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaItem({
  item,
  item,
  onToggle,
  onResponder,
  onLimparResposta,
}: {
  item: ItemSimulado;
  onToggle: (tipo: string) => void;
  onResponder: (chave: string, valor: string) => void;
  onLimparResposta: (chave: string) => void;
}) {
  const cfg = {
    cumprido:   { icon: CheckCircle2, cor: "#059669", label: "OK" },
    pendente:   { icon: CircleDashed, cor: "#7A1F2B", label: "PENDENTE" },
    dispensado: { icon: MinusCircle,  cor: "hsl(220 10% 62%)", label: "NÃO EXIGIDO" },
    aguardando: { icon: Clock,        cor: "#D97706", label: "AGUARDA RESPOSTA" },
  }[item.estado];
  const Icon = cfg.icon;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      className="flex items-start gap-2 rounded-md border px-2.5 py-1.5"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : undefined,
        position: "relative",
        background: isDragging ? "#FFFFFF" : undefined,
        boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.12)" : undefined,
        borderColor: "hsl(220 13% 93%)",
        opacity: item.estado === "dispensado" ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        title="Clique, segure e arraste para reordenar"
        {...attributes}
        {...listeners}
        className="shrink-0 mt-[1px] cursor-grab active:cursor-grabbing touch-none text-slate-400 hover:text-slate-600"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Icon className="h-3.5 w-3.5 shrink-0 mt-[2px]" style={{ color: cfg.cor }} />
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] leading-snug"
          style={{
            color: "hsl(220 20% 18%)",
            textDecoration: item.estado === "cumprido" ? "line-through" : undefined,
          }}
        >
          {item.nome_documento}
        </div>
        <div className="text-[9px] font-mono" style={{ color: "hsl(220 10% 55%)" }}>
          ordem {item.ordem} · {item.tipo_documento}
          {item.motivo ? ` · ${item.motivo}` : ""}
        </div>

        {item.tipo === "pergunta" && item.estado !== "dispensado" && item.estado !== "aguardando" && !!item.opcoes?.length && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.opcoes.map((o) => {
              const ativa = item.estado === "cumprido" && String(item.motivo ?? "").endsWith(o.valor.toUpperCase());
              return (
                <button
                  key={o.valor}
                  onClick={() => onResponder(item.chave as string, o.valor)}
                  className="rounded border px-1.5 py-0.5 text-[9px] uppercase"
                  style={{
                    borderColor: ativa ? "#7A1F2B" : "hsl(220 13% 88%)",
                    background: ativa ? "#7A1F2B" : "transparent",
                    color: ativa ? "#FFFFFF" : "hsl(220 20% 18%)",
                  }}
                >
                  {o.label}
                </button>
              );
            })}
            {item.estado === "cumprido" && (
              <button
                onClick={() => onLimparResposta(item.chave as string)}
                className="text-[9px] uppercase underline"
                style={{ color: "hsl(220 10% 45%)" }}
              >
                corrigir
              </button>
            )}
          </div>
        )}
      </div>
      {item.tipo === "documento" && item.estado !== "dispensado" && item.estado !== "aguardando" && (
        <button
          onClick={() => onToggle(item.tipo_documento)}
          className="text-[9px] uppercase shrink-0 underline"
          style={{ color: "hsl(220 10% 45%)" }}
        >
          {item.estado === "cumprido" ? "desfazer" : "enviar"}
        </button>
      )}
    </div>
  );
}