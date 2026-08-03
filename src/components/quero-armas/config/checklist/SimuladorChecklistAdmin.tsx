import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, PlayCircle, RotateCcw, CheckCircle2, CircleDashed, MinusCircle,
  Clock, AlertTriangle, ArrowRight, GripVertical, X, Plus, Search,
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
  simularChecklist, CONDICOES, MODALIDADES, grupoCanonico,
  type LinhaCatalogo, type ItemSimulado,
} from "@/lib/quero-armas/simuladorChecklist";

type Servico = { id: number; nome_servico: string };

/** Item da BIBLIOTECA — mesma fonte usada por Montar Checklist e Catálogo. */
type BibliotecaItem = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
  validade_dias: number | null;
  formato_aceito: string | null;
  link_emissao: string | null;
  descricao_como_enviar: string | null;
  observacao_cliente: string | null;
};

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

  // ── Adicionar exigência (mesma biblioteca do Montar Checklist) ────────────
  const [biblioteca, setBiblioteca] = useState<BibliotecaItem[]>([]);
  const [buscaBib, setBuscaBib] = useState("");
  const [condicaoNova, setCondicaoNova] = useState<string>("");
  const [adicionando, setAdicionando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("qa_servicos" as any)
        .select("id, nome_servico")
        .order("nome_servico");
      setServicos((data as any[])?.map((s) => ({ id: s.id, nome_servico: s.nome_servico })) ?? []);
    })();
    (async () => {
      const { data } = await supabase
        .from("qa_documentos_biblioteca" as any)
        .select("id, codigo, nome, categoria, validade_dias, formato_aceito, link_emissao, descricao_como_enviar, observacao_cliente")
        .eq("ativo", true)
        .order("nome");
      setBiblioteca(((data as any[]) ?? []) as BibliotecaItem[]);
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

  /**
   * Adiciona uma exigência ao serviço a partir da BIBLIOTECA — exatamente a
   * mesma tabela (qa_documentos_biblioteca) e a mesma gravação
   * (qa_servicos_documentos) usadas por Montar Checklist / Catálogo de Preços.
   * Não existe cadastro paralelo: o que é criado aqui aparece lá e vice-versa.
   */
  async function adicionarExigencia(item: BibliotecaItem) {
    if (!servicoId) { toast.error("ESCOLHA UM SERVIÇO PRIMEIRO"); return; }
    setAdicionando(true);
    try {
      // Entra no fim do grupo temático a que o documento pertence, para já
      // nascer na posição certa da lista que o cliente vê.
      const grupo = grupoCanonico(item.codigo);
      const doGrupo = linhas.filter((l) => grupoCanonico(l.tipo_documento) === grupo);
      const base = doGrupo.length
        ? Math.max(...doGrupo.map((l) => l.ordem ?? 0))
        : Math.max(0, ...linhas.map((l) => l.ordem ?? 0));
      const { error } = await supabase.from("qa_servicos_documentos" as any).insert({
        servico_id: servicoId,
        biblioteca_id: item.id,
        tipo_documento: item.codigo,
        nome_documento: item.nome,
        etapa: "base",
        obrigatorio: true,
        condicao_profissional: condicaoNova || null,
        validade_dias: item.validade_dias,
        formato_aceito: item.formato_aceito,
        link_emissao: item.link_emissao,
        instrucoes: item.descricao_como_enviar,
        observacoes_cliente: item.observacao_cliente,
        ordem: base + 1,
        ativo: true,
      });
      if (error) throw error;
      toast.success(`"${item.nome.toUpperCase()}" ADICIONADO AO CHECKLIST`);
      setBuscaBib("");
      await carregar(servicoId);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast.error(
        msg.includes("duplicate")
          ? "ESTE DOCUMENTO JÁ ESTÁ NO CHECKLIST DESTE SERVIÇO"
          : "NÃO FOI POSSÍVEL ADICIONAR: " + (msg || "ERRO"),
      );
    } finally {
      setAdicionando(false);
    }
  }

  /**
   * Remove a exigência do checklist. Não apaga a linha do catálogo: desativa
   * (`ativo = false`), que é o mesmo mecanismo do Montar Checklist — o item
   * some do simulador, do portal do cliente e de todos os motores, e pode ser
   * reativado a qualquer momento (inclusive pelo DESFAZER do toast).
   */
  async function removerItem(id: string, nome: string) {
    const anteriores = linhas;
    setLinhas((p) => p.filter((l) => l.id !== id));
    const { error } = await supabase
      .from("qa_servicos_documentos" as any)
      .update({ ativo: false })
      .eq("id", id);
    if (error) {
      setLinhas(anteriores);
      toast.error("NÃO FOI POSSÍVEL EXCLUIR: " + (error.message ?? "ERRO"));
      return;
    }
    toast.success(`"${String(nome).toUpperCase()}" REMOVIDO DO CHECKLIST`, {
      action: {
        label: "DESFAZER",
        onClick: async () => {
          const { error: e2 } = await supabase
            .from("qa_servicos_documentos" as any)
            .update({ ativo: true })
            .eq("id", id);
          if (e2) {
            toast.error("NÃO FOI POSSÍVEL REATIVAR");
            return;
          }
          setLinhas(anteriores);
          toast.success("EXIGÊNCIA RESTAURADA");
        },
      },
    });
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
  /**
   * Grava a nova estrutura (grupos + itens) em qa_servicos_documentos gravando
   * `etapa` e `ordem`. As linhas ocultas do catálogo (variantes condicionais que
   * não aparecem nesta combinação) acompanham o próprio grupo — assim nada fica
   * "solto" no fim da lista e todos os motores leem exatamente a mesma sequência.
   */
  async function persistirGrupos(gruposNovos: { grupo: string; ids: string[] }[]) {
    const visiveis = new Set(gruposNovos.flatMap((g) => g.ids));
    const porOrdem = (a: LinhaCatalogo, b: LinhaCatalogo) => (a.ordem ?? 999) - (b.ordem ?? 999);
    // O grupo é temático e vem do tipo de documento (mesma classificação do
    // portal do cliente). A coluna `etapa` do catálogo é preservada como está.
    const etapaDe = (l: LinhaCatalogo) => String(l.etapa || "base").trim().toLowerCase();
    const grupoDe = (l: LinhaCatalogo) => grupoCanonico(l.tipo_documento) as string;
    const linhaPorId = new Map(linhas.map((l) => [l.id, l]));

    const sequencia: { id: string; etapa: string }[] = [];
    for (const g of gruposNovos) {
      for (const id of g.ids) {
        const l = linhaPorId.get(id);
        sequencia.push({ id, etapa: l ? etapaDe(l) : "base" });
      }
      // variantes ocultas do mesmo grupo ficam logo abaixo, mantendo a ordem atual
      [...linhas]
        .filter((l) => !visiveis.has(l.id) && grupoDe(l) === g.grupo)
        .sort(porOrdem)
        .forEach((l) => sequencia.push({ id: l.id, etapa: etapaDe(l) }));
    }
    const incluidos = new Set(sequencia.map((s) => s.id));
    [...linhas]
      .filter((l) => !incluidos.has(l.id))
      .sort(porOrdem)
      .forEach((l) => sequencia.push({ id: l.id, etapa: etapaDe(l) }));

    const mapa = new Map(sequencia.map((s, idx) => [s.id, { ordem: (idx + 1) * 10, etapa: s.etapa }]));

    const anteriores = linhas;
    const atualizadas = linhas.map((l) => {
      const m = mapa.get(l.id);
      return m ? { ...l, ordem: m.ordem, etapa: m.etapa } : l;
    });
    setLinhas(atualizadas);

    const alterados = atualizadas.filter((l) => {
      const a = anteriores.find((x) => x.id === l.id);
      return !a || a.ordem !== l.ordem || a.etapa !== l.etapa;
    });
    if (alterados.length === 0) return;

    setSalvandoOrdem(true);
    try {
      for (const l of alterados) {
        const { error } = await supabase
          .from("qa_servicos_documentos" as any)
          .update({ ordem: l.ordem, etapa: l.etapa })
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

    // Estrutura atual: grupos na ordem em que o cliente vê, com seus itens.
    let estrutura = sim.grupos.map((g) => ({ grupo: g.grupo, ids: g.itens.map((i) => i.id) }));

    const grupoDoItem = (id: string) =>
      estrutura.findIndex((g) => g.ids.includes(id));

    // ── Arrasto de GRUPO INTEIRO ────────────────────────────────────────────
    if (activeId.startsWith("grupo:")) {
      const slug = activeId.slice("grupo:".length);
      const from = estrutura.findIndex((g) => g.grupo === slug);
      const to = overId.startsWith("grupo:")
        ? estrutura.findIndex((g) => g.grupo === overId.slice("grupo:".length))
        : grupoDoItem(overId);
      if (from < 0 || to < 0 || from === to) return;
      estrutura = arrayMove(estrutura, from, to);
      await persistirGrupos(estrutura);
      return;
    }

    // ── Arrasto de ITEM (dentro do grupo ou para outro grupo) ───────────────
    const gOrigem = grupoDoItem(activeId);
    if (gOrigem < 0) return;
    const gDestino = overId.startsWith("grupo:")
      ? estrutura.findIndex((g) => g.grupo === overId.slice("grupo:".length))
      : grupoDoItem(overId);
    if (gDestino < 0) return;

    estrutura = estrutura.map((g) => ({ ...g, ids: [...g.ids] }));
    const idxOrigem = estrutura[gOrigem].ids.indexOf(activeId);
    estrutura[gOrigem].ids.splice(idxOrigem, 1);
    const idxDestino = overId.startsWith("grupo:")
      ? estrutura[gDestino].ids.length
      : Math.max(0, estrutura[gDestino].ids.indexOf(overId));
    estrutura[gDestino].ids.splice(idxDestino, 0, activeId);

    await persistirGrupos(estrutura);
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

            {/* Adicionar exigência — mesma biblioteca do Montar Checklist */}
            <div className="mb-3 rounded-lg border p-2.5" style={{ borderColor: LINE, background: "hsl(220 20% 98%)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Plus className="h-3.5 w-3.5" style={{ color: BORDO }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                  Adicionar exigência (biblioteca oficial)
                </span>
                {adicionando && <Loader2 className="h-3 w-3 animate-spin" style={{ color: BORDO }} />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: MUTED }} />
                  <input
                    value={buscaBib}
                    onChange={(e) => setBuscaBib(e.target.value)}
                    placeholder="BUSCAR DOCUMENTO NA BIBLIOTECA..."
                    className="w-full rounded border bg-white pl-7 pr-2 py-1.5 text-[11px] uppercase"
                    style={{ borderColor: LINE, color: INK }}
                  />
                </div>
                <select
                  value={condicaoNova}
                  onChange={(e) => setCondicaoNova(e.target.value)}
                  className="rounded border bg-white px-2 py-1.5 text-[10px] uppercase"
                  style={{ borderColor: LINE, color: INK }}
                  title="Exigir só para esta condição profissional"
                >
                  <option value="">TODAS AS CONDIÇÕES</option>
                  {CONDICOES.map((c) => (
                    <option key={c.valor} value={c.valor}>{c.label}</option>
                  ))}
                </select>
              </div>
              {buscaBib.trim().length >= 2 && (
                <div className="mt-2 max-h-44 overflow-y-auto rounded border bg-white" style={{ borderColor: LINE }}>
                  {bibliotecaFiltrada.length === 0 && (
                    <div className="px-2 py-2 text-[10px] uppercase" style={{ color: MUTED }}>
                      Nenhum documento na biblioteca com esse termo — cadastre-o em Biblioteca de Documentos.
                    </div>
                  )}
                  {bibliotecaFiltrada.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      disabled={b.jaNoServico || adicionando}
                      onClick={() => adicionarExigencia(b)}
                      className="flex w-full items-start justify-between gap-2 border-b px-2 py-1.5 text-left last:border-b-0 disabled:opacity-40 hover:bg-slate-50"
                      style={{ borderColor: "hsl(220 13% 95%)" }}
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] leading-snug" style={{ color: INK }}>{b.nome}</span>
                        <span className="block text-[9px] font-mono" style={{ color: MUTED }}>{b.codigo}</span>
                      </span>
                      <span className="shrink-0 text-[9px] uppercase" style={{ color: b.jaNoServico ? MUTED : BORDO }}>
                        {b.jaNoServico ? "já está" : "adicionar"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                              onRemover={removerItem}
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

function BlocoGrupo({
  grupo,
  children,
}: {
  grupo: { grupo: string; rotulo: string; cumpridos: number; pendentes: number };
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `grupo:${grupo.grupo}`,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Mover grupo inteiro"
            title="Arraste para mover o grupo inteiro"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
            style={{ color: BORDO }}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: BORDO }}>
            {grupo.rotulo}
          </span>
        </div>
        <span className="text-[10px] font-mono tabular-nums" style={{ color: MUTED }}>
          {grupo.cumpridos}/{grupo.cumpridos + grupo.pendentes}
        </span>
      </div>
      {children}
    </div>
  );
}

function LinhaItem({
  item,
  onToggle,
  onResponder,
  onLimparResposta,
  onRemover,
}: {
  item: ItemSimulado;
  onToggle: (tipo: string) => void;
  onResponder: (chave: string, valor: string) => void;
  onLimparResposta: (chave: string) => void;
  onRemover: (id: string, nome: string) => void;
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
      <button
        type="button"
        aria-label="Excluir exigência do checklist"
        title="Excluir esta exigência do checklist"
        onClick={() => {
          if (
            window.confirm(
              `Excluir "${item.nome_documento}" do checklist?\n\nO item deixa de ser exigido no simulador, no portal do cliente e em todos os motores. Você pode desfazer logo em seguida.`,
            )
          ) {
            onRemover(item.id, item.nome_documento);
          }
        }}
        className="shrink-0 mt-[1px] rounded p-0.5 text-slate-400 hover:text-white"
        style={{ transition: "all .12s" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#7A1F2B")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}