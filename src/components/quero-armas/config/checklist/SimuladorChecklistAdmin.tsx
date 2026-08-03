import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, PlayCircle, RotateCcw, CheckCircle2, CircleDashed, MinusCircle,
  Clock, AlertTriangle, ArrowRight, GripVertical, X, Plus, Search,
  ListOrdered, ChevronRight, ChevronDown,
} from "lucide-react";
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  simularChecklist, CONDICOES, MODALIDADES, grupoCanonico,
  CONDICOES_CHECKLIST,
  parseCondicoes, serializarCondicoes,
  type LinhaCatalogo, type ItemSimulado,
} from "@/lib/quero-armas/simuladorChecklist";
import { PENDENCIA_GRUPOS, type PendenciaGrupoId } from "@/lib/quero-armas/pendenciasGrupos";
import { RECEITAS, aplicarReceita, type ReceitaChecklist } from "@/lib/quero-armas/receitasChecklist";

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

const INK = "#111418";
const MUTED = "#4A5361";
const LINE = "hsl(220 13% 91%)";
const BORDO = "#7A1F2B";
const GRUPOS_MOVIMENTO = Object.values(PENDENCIA_GRUPOS).filter(
  (g) => g.id !== "assinaturas" && g.id !== "perguntas",
);

export default function SimuladorChecklistAdmin() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoId, setServicoId] = useState<number | null>(null);
  const [linhas, setLinhas] = useState<LinhaCatalogo[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [gruposAbertos, setGruposAbertos] = useState<string[]>([]);

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

  /** Busca na biblioteca oficial, marcando o que já está neste serviço. */
  const bibliotecaFiltrada = useMemo(() => {
    const b = buscaBib.trim().toLowerCase();
    if (b.length < 2) return [] as (BibliotecaItem & { jaNoServico: boolean })[];
    // Só conta como "já está" o que estiver ATIVO. Linha desativada precisa
    // poder voltar pela busca — senão o documento fica invisível no simulador
    // e ao mesmo tempo bloqueado para adicionar.
    const ativas = linhas.filter((l) => (l as any).ativo !== false);
    const usados = new Set(ativas.map((l) => l.tipo_documento));
    const bibUsadas = new Set(
      ativas.map((l) => (l as any).biblioteca_id as string | null).filter(Boolean) as string[],
    );
    return biblioteca
      .filter((i) => i.nome.toLowerCase().includes(b) || i.codigo.toLowerCase().includes(b))
      .slice(0, 40)
      .map((i) => ({ ...i, jaNoServico: usados.has(i.codigo) || bibUsadas.has(i.id) }));
  }, [biblioteca, buscaBib, linhas]);

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
      // Se a exigência já existe mas está desativada, REATIVA em vez de tentar
      // inserir de novo (o insert bateria na unicidade e o item seguiria oculto).
      const desativada = linhas.find(
        (l) =>
          (l as any).ativo === false &&
          (l.tipo_documento === item.codigo || (l as any).biblioteca_id === item.id),
      );
      if (desativada) {
        const { error: errReativar } = await supabase
          .from("qa_servicos_documentos" as any)
          .update({ ativo: true })
          .eq("id", desativada.id);
        if (errReativar) throw errReativar;
        toast.success(`"${item.nome.toUpperCase()}" REATIVADO NO CHECKLIST`);
        setBuscaBib("");
        await carregar(servicoId);
        return;
      }
      // Entra no fim do grupo temático a que o documento pertence, para já
      // nascer na posição certa da lista que o cliente vê.
      const grupo = grupoCanonico(item.codigo);
      const doGrupo = linhas.filter((l) => grupoCanonico(l.tipo_documento, l.regra_validacao) === grupo);
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
   */
  async function aplicarBloco(receita: ReceitaChecklist) {
    if (!servicoId) { toast.error("ESCOLHA UM SERVIÇO PRIMEIRO"); return; }
    setAdicionando(true);
    try {
      const r = await aplicarReceita(receita, servicoId);
      toast.success(
        `BLOCO APLICADO — ${r.criadas} CRIADA(S), ${r.atualizadas} AJUSTADA(S)`,
      );
      await carregar(servicoId);
    } catch (e: any) {
      toast.error("NÃO FOI POSSÍVEL APLICAR O BLOCO: " + (e?.message ?? "ERRO"));
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

  /**
   * Define manualmente o número de ordem de uma exigência. É o MESMO campo
   * `ordem` de qa_servicos_documentos lido por todos os motores — digitar aqui
   * equivale a arrastar, só que com precisão.
   */
  async function definirOrdem(id: string, novaOrdem: number) {
    if (!Number.isFinite(novaOrdem) || novaOrdem < 0) return;
    const anteriores = linhas;
    setLinhas((p) => p.map((l) => (l.id === id ? { ...l, ordem: novaOrdem } : l)));
    const { error } = await supabase
      .from("qa_servicos_documentos" as any)
      .update({ ordem: novaOrdem })
      .eq("id", id);
    if (error) {
      setLinhas(anteriores);
      toast.error("NÃO FOI POSSÍVEL SALVAR A ORDEM: " + (error.message ?? "ERRO"));
    }
  }

  /**
   * Renomeia o "nome amigável" da exigência (campo `nome_documento`).
   * NÃO toca em `tipo_documento`/`codigo` — esses são a chave técnica usada por
   * parser, motores e uploads. Só muda o texto que o cliente lê, e é esse mesmo
   * texto que aparece no título do Checklist Guiado da área do cliente.
   */
  async function renomearItem(id: string, novoNome: string) {
    const nome = novoNome.trim();
    if (!nome) return;
    const anteriores = linhas;
    setLinhas((p) => p.map((l) => (l.id === id ? { ...l, nome_documento: nome } : l)));
    const { error } = await supabase
      .from("qa_servicos_documentos" as any)
      .update({ nome_documento: nome })
      .eq("id", id);
    if (error) {
      setLinhas(anteriores);
      toast.error("NÃO FOI POSSÍVEL RENOMEAR: " + (error.message ?? "ERRO"));
      return;
    }
    toast.success("NOME ATUALIZADO");
  }

  /**
   * Define (ou remove) o "SE" da exigência: `condicao_profissional`.
   * Vazio = vale para todo mundo. Com valor = a exigência só nasce no processo
   * depois que o cliente responder aquela condição profissional. É o MESMO
   * campo lido pelo portal, pelo explodir_checklist e pelo simulador.
   */
  async function definirCondicao(id: string, valores: string[]) {
    const cond = serializarCondicoes(valores);
    const anteriores = linhas;
    setLinhas((p) => p.map((l) => (l.id === id ? { ...l, condicao_profissional: cond } : l)));
    const { error } = await supabase
      .from("qa_servicos_documentos" as any)
      .update({ condicao_profissional: cond })
      .eq("id", id);
    if (error) {
      setLinhas(anteriores);
      toast.error("NÃO FOI POSSÍVEL SALVAR A CONDIÇÃO: " + (error.message ?? "ERRO"));
      return;
    }
    toast.success(cond ? "CONDIÇÕES PROFISSIONAIS APLICADAS" : "EXIGÊNCIA AGORA VALE PARA TODOS");
  }

  /**
   * Renumera tudo em 10, 20, 30… seguindo exatamente a sequência que o cliente
   * vê agora. Resolve os "buracos" (ex.: endereço em 160 depois de 40) sem
   * mudar nada de lugar.
   */
  async function renumerar() {
    await persistirGrupos(sim.grupos.map((g) => ({ grupo: g.grupo, ids: g.itens.map((i) => i.id) })));
  }

  async function definirPosicaoGrupo(grupo: string, novaPosicao: number) {
    const estrutura = sim.grupos.map((g) => ({ grupo: g.grupo, ids: g.itens.map((i) => i.id) }));
    const atual = estrutura.findIndex((g) => g.grupo === grupo);
    if (atual < 0 || !Number.isFinite(novaPosicao)) return;
    const destino = Math.max(0, Math.min(estrutura.length - 1, Math.round(novaPosicao) - 1));
    if (atual === destino) return;
    await persistirGrupos(arrayMove(estrutura, atual, destino));
  }

  async function moverItemParaGrupo(id: string, grupoDestino: PendenciaGrupoId) {
    const estrutura = sim.grupos.map((g) => ({ grupo: g.grupo, ids: g.itens.map((i) => i.id) }));
    const origem = estrutura.findIndex((g) => g.ids.includes(id));
    if (origem < 0 || estrutura[origem].grupo === grupoDestino) return;
    estrutura[origem].ids = estrutura[origem].ids.filter((itemId) => itemId !== id);
    let destino = estrutura.findIndex((g) => g.grupo === grupoDestino);
    if (destino < 0) {
      estrutura.push({ grupo: grupoDestino, ids: [] });
      destino = estrutura.length - 1;
    }
    estrutura[destino].ids.push(id);
    await persistirGrupos(estrutura.filter((g) => g.ids.length > 0));
  }

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
    const grupoDe = (l: LinhaCatalogo) => grupoCanonico(l.tipo_documento, l.regra_validacao) as string;
    const linhaPorId = new Map(linhas.map((l) => [l.id, l]));

    const sequencia: { id: string; etapa: string; grupo: string; ordemGrupo: number }[] = [];
    for (const [indiceGrupo, g] of gruposNovos.entries()) {
      const ordemGrupo = (indiceGrupo + 1) * 10;
      for (const id of g.ids) {
        const l = linhaPorId.get(id);
        sequencia.push({ id, etapa: l ? etapaDe(l) : "base", grupo: g.grupo, ordemGrupo });
      }
      // variantes ocultas do mesmo grupo ficam logo abaixo, mantendo a ordem atual
      [...linhas]
        .filter((l) => !visiveis.has(l.id) && grupoDe(l) === g.grupo)
        .sort(porOrdem)
        .forEach((l) => sequencia.push({ id: l.id, etapa: etapaDe(l), grupo: g.grupo, ordemGrupo }));
    }
    const incluidos = new Set(sequencia.map((s) => s.id));
    [...linhas]
      .filter((l) => !incluidos.has(l.id))
      .sort(porOrdem)
      .forEach((l) => {
        const grupo = grupoDe(l);
        const indiceGrupo = Math.max(0, gruposNovos.findIndex((g) => g.grupo === grupo));
        sequencia.push({ id: l.id, etapa: etapaDe(l), grupo, ordemGrupo: (indiceGrupo + 1) * 10 });
      });

    const mapa = new Map(sequencia.map((s, idx) => [s.id, {
      ordem: (idx + 1) * 10,
      etapa: s.etapa,
      regra_validacao: {
        ...(linhaPorId.get(s.id)?.regra_validacao ?? {}),
        grupo_checklist: s.grupo,
        ordem_grupo_checklist: s.ordemGrupo,
      },
    }]));

    const anteriores = linhas;
    const atualizadas = linhas.map((l) => {
      const m = mapa.get(l.id);
      return m ? { ...l, ordem: m.ordem, etapa: m.etapa, regra_validacao: m.regra_validacao } : l;
    });
    setLinhas(atualizadas);

    const alterados = atualizadas.filter((l) => {
      const a = anteriores.find((x) => x.id === l.id);
      return !a || a.ordem !== l.ordem || a.etapa !== l.etapa
        || JSON.stringify(a.regra_validacao) !== JSON.stringify(l.regra_validacao);
    });
    if (alterados.length === 0) return;

    setSalvandoOrdem(true);
    try {
      for (const l of alterados) {
        const { error } = await supabase
          .from("qa_servicos_documentos" as any)
          .update({ ordem: l.ordem, etapa: l.etapa, regra_validacao: l.regra_validacao })
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
    setArrastandoId(null);
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

  function onDragStart(event: DragStartEvent) {
    setArrastandoId(String(event.active.id));
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
        <p className="text-[12.5px] mb-4" style={{ color: MUTED }}>
          Avance respondendo como o cliente responderia. O resultado usa exatamente as
          exigências cadastradas em Preços e Serviços / Montar Checklist — nada é inventado aqui.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-7">
            <label className="text-[11.5px] uppercase block mb-1" style={{ color: MUTED }}>Serviço</label>
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
            <label className="text-[11.5px] uppercase block mb-1" style={{ color: MUTED }}>Modalidade</label>
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
              className="h-9 w-full rounded-md border text-[12.5px] uppercase flex items-center justify-center gap-1 disabled:opacity-40"
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
              <span className="text-[11.5px] font-mono tabular-nums" style={{ color: MUTED }}>
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
                <div className="text-[11.5px] uppercase mb-1" style={{ color: BORDO }}>
                  {sim.proximo.rotuloGrupo} · ORDEM {sim.proximo.ordem}
                </div>
                <div className="text-sm font-semibold mb-3" style={{ color: INK }}>
                  {sim.proximo.nome_documento}
                </div>

                {sim.proximo.linha?.instrucoes ? (
                  <div
                    className="mb-3 rounded-md border p-2.5 text-[11.5px] leading-snug whitespace-pre-line"
                    style={{ borderColor: LINE, background: "hsl(220 13% 97%)", color: MUTED }}
                  >
                    {sim.proximo.linha.instrucoes}
                  </div>
                ) : null}

                {sim.proximo.tipo === "pergunta" && sim.proximo.opcoes?.length ? (
                  <div className="flex flex-col gap-2">
                    {sim.proximo.opcoes.map((o) => (
                      <button
                        key={o.valor}
                        onClick={() => responder(sim.proximo!.chave as string, o.valor)}
                        className="min-h-9 rounded-md border px-3 py-2 text-[12.5px] leading-snug uppercase text-left whitespace-normal break-words hover:bg-slate-50"
                        style={{ borderColor: LINE, color: INK }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : sim.proximo.tipo === "pergunta" ? (
                  (sim.proximo.linha?.regra_validacao as any)?.entrada === "texto" ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const el = (e.currentTarget.elements.namedItem("resp") as HTMLInputElement);
                        const v = el.value.trim();
                        if (v) responder(sim.proximo!.chave as string, v);
                      }}
                    >
                      <input
                        name="resp"
                        autoComplete="off"
                        placeholder="DIGITE A RESPOSTA"
                        className="h-9 flex-1 rounded-md border px-3 text-[12.5px] uppercase"
                        style={{ borderColor: LINE, color: INK }}
                      />
                      <button
                        type="submit"
                        className="h-9 rounded-md px-3 text-[12.5px] uppercase text-white"
                        style={{ background: BORDO }}
                      >
                        Responder
                      </button>
                    </form>
                  ) : (
                    <div className="text-[12.5px]" style={{ color: "#B91C1C" }}>
                      Esta pergunta não tem opções cadastradas em regra_validacao.opcoes — o cliente
                      ficaria travado aqui.
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => alternarEntrega(sim.proximo!.tipo_documento)}
                    className="h-9 w-full rounded-md text-[12.5px] uppercase text-white"
                    style={{ background: BORDO }}
                  >
                    Simular envio deste documento
                  </button>
                )}

                <div className="mt-3 text-[11.5px] font-mono" style={{ color: MUTED }}>
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
                    className="flex gap-2 rounded-lg border p-2.5 text-[12.5px]"
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
              <div className="flex items-center gap-2">
                {salvandoOrdem && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: BORDO }} />}
                <button
                  type="button"
                  onClick={renumerar}
                  disabled={salvandoOrdem || sim.grupos.length === 0}
                  title="Renumerar tudo em 10, 20, 30… na sequência atual"
                  className="inline-flex items-center gap-1 rounded-md border px-2 h-7 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                  style={{ borderColor: LINE, color: BORDO }}
                >
                  <ListOrdered className="h-3 w-3" /> Renumerar
                </button>
              </div>
            </div>
            <p className="text-[11.5px] mb-3" style={{ color: MUTED }}>
              Arraste pelo punho ⠿ do item para reordenar dentro/entre grupos, ou pelo punho do
              título do grupo para mover o grupo inteiro. A nova ordem é gravada no
              catálogo e passa a valer em todos os motores (Preços e Serviços, Montar Checklist,
              processos e portal do cliente).
              <br />
              Você também pode digitar o número de ordem direto no campo de cada linha —
              e usar RENUMERAR para fechar os buracos (10, 20, 30…) sem mudar nada de lugar.
            </p>

            {/* Adicionar exigência — mesma biblioteca do Montar Checklist */}
            <div className="mb-3 rounded-lg border p-2.5" style={{ borderColor: LINE, background: "hsl(220 20% 98%)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Plus className="h-3.5 w-3.5" style={{ color: BORDO }} />
                <span className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
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
                    className="w-full rounded border bg-white pl-7 pr-2 py-1.5 text-[12.5px] uppercase"
                    style={{ borderColor: LINE, color: INK }}
                  />
                </div>
                <select
                  value={condicaoNova}
                  onChange={(e) => setCondicaoNova(e.target.value)}
                  className="rounded border bg-white px-2 py-1.5 text-[11.5px] uppercase"
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
                    <div className="px-2 py-2 text-[11.5px] uppercase" style={{ color: MUTED }}>
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
                        <span className="block text-[12.5px] leading-snug" style={{ color: INK }}>{b.nome}</span>
                        <span className="block text-[11px] font-mono" style={{ color: MUTED }}>{b.codigo}</span>
                      </span>
                      <span className="shrink-0 text-[11px] uppercase" style={{ color: b.jaNoServico ? MUTED : BORDO }}>
                        {b.jaNoServico ? "já está" : "adicionar"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={onDragStart}
                onDragCancel={() => setArrastandoId(null)}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={sim.grupos.map((g) => `grupo:${g.grupo}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {sim.grupos.map((g) => (
                    <BlocoGrupo
                      key={g.grupo}
                      grupo={g}
                      posicao={sim.grupos.findIndex((x) => x.grupo === g.grupo) + 1}
                      totalGrupos={sim.grupos.length}
                      onDefinirPosicao={definirPosicaoGrupo}
                      aberto={gruposAbertos.includes(g.grupo)}
                      onAlternar={() =>
                        setGruposAbertos((prev) =>
                          prev.includes(g.grupo) ? prev.filter((x) => x !== g.grupo) : [...prev, g.grupo],
                        )
                      }
                    >
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
                              onDefinirOrdem={definirOrdem}
                              onMoverGrupo={moverItemParaGrupo}
                              onDefinirCondicao={definirCondicao}
                              onRenomear={renomearItem}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </BlocoGrupo>
                  ))}
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {arrastandoId ? (
                    <div className="w-[min(520px,70vw)] rounded-md border bg-white px-3 py-2 shadow-xl" style={{ borderColor: LINE }}>
                      <span className="block truncate text-[12.5px] font-semibold" style={{ color: INK }}>
                        {arrastandoId.startsWith("grupo:")
                          ? sim.grupos.find((g) => `grupo:${g.grupo}` === arrastandoId)?.rotulo
                          : sim.visiveis.find((i) => i.id === arrastandoId)?.nome_documento}
                      </span>
                      <span className="text-[11px] uppercase" style={{ color: MUTED }}>MOVER PARA A NOVA POSIÇÃO</span>
                    </div>
                  ) : null}
                </DragOverlay>
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
  posicao,
  totalGrupos,
  onDefinirPosicao,
  aberto,
  onAlternar,
  children,
}: {
  grupo: { grupo: string; rotulo: string; cumpridos: number; pendentes: number };
  posicao: number;
  totalGrupos: number;
  onDefinirPosicao: (grupo: string, posicao: number) => void;
  aberto: boolean;
  onAlternar: () => void;
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
        transition: isDragging ? undefined : transition,
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
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={aberto}
            title={aberto ? "Recolher grupo" : "Expandir grupo"}
            className="flex items-center gap-1 text-left"
            style={{ color: BORDO }}
          >
            {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span className="text-[11.5px] font-semibold uppercase tracking-wider">
              {grupo.rotulo}
            </span>
          </button>
        </div>
        <span className="text-[11.5px] font-mono tabular-nums" style={{ color: MUTED }}>
          {grupo.cumpridos}/{grupo.cumpridos + grupo.pendentes}
        </span>
      </div>
      {aberto && (
      <div className="flex items-center gap-1">
        <span className="text-[11px] uppercase" style={{ color: MUTED }}>posição do grupo</span>
        <input
          type="number"
          min={1}
          max={totalGrupos}
          key={`${grupo.grupo}-${posicao}`}
          defaultValue={posicao}
          onBlur={(e) => onDefinirPosicao(grupo.grupo, Number(e.currentTarget.value))}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="h-5 w-10 rounded border bg-white px-1 text-center text-[11px] font-mono"
          style={{ borderColor: LINE, color: INK }}
        />
      </div>
      )}
      {aberto && children}
    </div>
  );
}

function LinhaItem({
  item,
  onToggle,
  onResponder,
  onLimparResposta,
  onRemover,
  onDefinirOrdem,
  onMoverGrupo,
  onDefinirCondicao,
  onRenomear,
}: {
  item: ItemSimulado;
  onToggle: (tipo: string) => void;
  onResponder: (chave: string, valor: string) => void;
  onLimparResposta: (chave: string) => void;
  onRemover: (id: string, nome: string) => void;
  onDefinirOrdem: (id: string, novaOrdem: number) => void;
  onMoverGrupo: (id: string, grupo: PendenciaGrupoId) => void;
  onDefinirCondicao: (id: string, valores: string[]) => void;
  onRenomear: (id: string, novoNome: string) => void;
}) {
  const cfg = {
    cumprido:   { icon: CheckCircle2, cor: "#059669", label: "OK" },
    pendente:   { icon: CircleDashed, cor: "#7A1F2B", label: "PENDENTE" },
    dispensado: { icon: MinusCircle,  cor: "hsl(220 12% 38%)", label: "NÃO EXIGIDO" },
    aguardando: { icon: Clock,        cor: "#D97706", label: "AGUARDA RESPOSTA" },
  }[item.estado];
  const Icon = cfg.icon;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [editandoNome, setEditandoNome] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className="flex items-start gap-2 rounded-md border px-2.5 py-1.5"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
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
        className="shrink-0 mt-[1px] cursor-grab active:cursor-grabbing touch-none text-slate-600 hover:text-slate-600"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Icon className="h-3.5 w-3.5 shrink-0 mt-[2px]" style={{ color: cfg.cor }} />
      <div className="min-w-0 flex-1">
        {editandoNome ? (
          <input
            autoFocus
            defaultValue={item.nome_documento}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              setEditandoNome(false);
              if (v && v !== item.nome_documento) onRenomear(item.id, v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              if (e.key === "Escape") setEditandoNome(false);
            }}
            className="w-full rounded border px-1.5 py-0.5 text-[12.5px] leading-snug"
            style={{ borderColor: "hsl(220 13% 80%)", color: "hsl(220 20% 18%)" }}
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditandoNome(true);
            }}
            title="Clique para editar o nome que o cliente vê (não muda o código técnico)"
            className="text-left text-[12.5px] leading-snug hover:underline decoration-dotted"
            style={{
              color: "hsl(220 20% 18%)",
              textDecoration: item.estado === "cumprido" ? "line-through" : undefined,
            }}
          >
            {item.nome_documento}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono" style={{ color: "hsl(220 12% 38%)" }}>
          <span
            className={`font-sans text-[9.5px] font-bold tracking-wide px-1.5 py-[2px] rounded border ${
              item.tipo === "pergunta"
                ? "text-sky-800 bg-sky-50 border-sky-200"
                : "text-[#7B1C2E] bg-[#7B1C2E]/[0.06] border-[#7B1C2E]/25"
            }`}
            title={item.tipo === "pergunta" ? "O cliente responde — não envia arquivo" : "O cliente precisa enviar o arquivo (PDF)"}
          >
            {item.tipo === "pergunta" ? "PERGUNTA" : "ENVIAR DOCUMENTO"}
          </span>
          <span className="uppercase">ordem</span>
          <input
            type="number"
            min={0}
            step={10}
            defaultValue={item.ordem}
            key={`ord-${item.id}-${item.ordem}`}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = Number(e.currentTarget.value);
              if (Number.isFinite(v) && v !== item.ordem) onDefinirOrdem(item.id, v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
            title="Digite o número de ordem desta exigência"
            className="w-12 rounded border px-1 py-0 text-[11px] font-mono tabular-nums"
            style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 18%)" }}
          />
          <span>· {item.tipo_documento}</span>
          {item.motivo ? <span>· {item.motivo}</span> : null}
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-[11px] uppercase" style={{ color: MUTED }}>grupo</span>
          <select
            value={item.grupo}
            onChange={(e) => onMoverGrupo(item.id, e.currentTarget.value as PendenciaGrupoId)}
            onClick={(e) => e.stopPropagation()}
            disabled={item.estado === "dispensado"}
            className="h-5 min-w-0 max-w-[210px] rounded border bg-white px-1 text-[11px] uppercase"
            style={{ borderColor: LINE, color: INK }}
            title="Escolha em qual grupo esta exigência deve aparecer para o cliente"
          >
            {GRUPOS_MOVIMENTO.map((grupo) => (
              <option key={grupo.id} value={grupo.id}>{grupo.label}</option>
            ))}
          </select>
        </div>

        {item.tipo !== "pergunta" && (() => {
          const selecionadas = parseCondicoes(item.linha?.condicao_profissional);
          const alternar = (valor: string) => {
            const nova = selecionadas.includes(valor)
              ? selecionadas.filter((v) => v !== valor)
              : [...selecionadas, valor];
            onDefinirCondicao(item.id, nova);
          };
          return (
            <div
              className="mt-1 flex flex-wrap items-center gap-1"
              onClick={(e) => e.stopPropagation()}
              title="Marque uma ou mais condições profissionais. Nenhuma marcada = exigido de todos."
            >
              <span className="text-[11px] uppercase" style={{ color: MUTED }}>só se</span>
              <button
                type="button"
                onClick={() => onDefinirCondicao(item.id, [])}
                className="rounded border px-1.5 py-0.5 text-[10px] uppercase"
                style={{
                  borderColor: selecionadas.length === 0 ? "#7A1F2B" : LINE,
                  background: selecionadas.length === 0 ? "#7A1F2B" : "transparent",
                  color: selecionadas.length === 0 ? "#FFFFFF" : MUTED,
                }}
              >
                TODOS
              </button>
              {CONDICOES_CHECKLIST.map((c) => {
                const ativa = selecionadas.includes(c.valor);
                return (
                  <button
                    key={c.valor}
                    type="button"
                    onClick={() => alternar(c.valor)}
                    className="rounded border px-1.5 py-0.5 text-[10px] uppercase"
                    style={{
                      borderColor: ativa ? "#7A1F2B" : LINE,
                      background: ativa ? "#7A1F2B" : "transparent",
                      color: ativa ? "#FFFFFF" : INK,
                    }}
                    title={c.label}
                  >
                    {c.label.split("—")[0].split("(")[0].trim()}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {item.tipo === "pergunta" && item.estado !== "dispensado" && item.estado !== "aguardando" && !!item.opcoes?.length && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.opcoes.map((o) => {
              const ativa = item.estado === "cumprido" && String(item.motivo ?? "").endsWith(o.valor.toUpperCase());
              return (
                <button
                  key={o.valor}
                  onClick={() => onResponder(item.chave as string, o.valor)}
                  className="rounded border px-1.5 py-0.5 text-[11px] uppercase"
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
                className="text-[11px] uppercase underline"
                style={{ color: "hsl(220 14% 32%)" }}
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
          className="text-[11px] uppercase shrink-0 underline"
          style={{ color: "hsl(220 14% 32%)" }}
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
        className="shrink-0 mt-[1px] rounded p-0.5 text-slate-600 hover:text-white"
        style={{ transition: "all .12s" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#7A1F2B")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}