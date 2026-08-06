// Simulador do popup do cliente — usa o PendenciasGuiadasPopup real.
// O admin seleciona um processo ativo e caminha pelo checklist exatamente
// como o cliente faz, usando qa_processo_documentos (não o catálogo).

import { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toHubTipoCompartilhado } from "@/lib/quero-armas/hubTipoMap";
import PendenciasGuiadasPopup, {
  type PendenciaItem,
} from "@/components/quero-armas/portal/PendenciasGuiadasPopup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Play, RotateCcw, X, AlertCircle, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Processo = {
  id: string;
  servico_nome: string;
  status: string;
  cliente_nome: string | null;
  cliente_id: number;
  data_criacao: string;
};

type DocProcesso = {
  id: string;
  processo_id: string;
  tipo_documento: string;
  nome_documento: string;
  obrigatorio: boolean;
  status: string;
  etapa: string | null;
  ordem_grupo_checklist: number | null;
  grupo_checklist: string | null;
  instrucoes: string | null;
  link_emissao: string | null;
  observacoes_cliente: string | null;
  regra_validacao: Record<string, any> | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPendencias(
  docs: DocProcesso[],
  entregues: Set<string>,
  onEntregar: (id: string) => void,
): PendenciaItem[] {
  const items: PendenciaItem[] = [];

  for (const doc of docs) {
    if (!doc.obrigatorio) continue;
    if (entregues.has(doc.id)) continue;
    // No simulador mostramos todos os pendentes (não filtrar por etapa)
    if (doc.status === "aprovado") continue;

    const rawTipo = doc.tipo_documento.toLowerCase();
    const rv = doc.regra_validacao as any;
    const isPergunta = rv?.tipo === "pergunta";
    const chave = String(rv?.chave || "");
    const opcoes = Array.isArray(rv?.opcoes) ? rv.opcoes : [];

    if (isPergunta && (!chave || opcoes.length === 0)) continue;

    const hubTipo = isPergunta ? rawTipo : toHubTipoCompartilhado(rawTipo);

    const item: PendenciaItem = {
      id: doc.id,
      kind: isPergunta ? "pergunta" : "documento",
      label: doc.nome_documento,
      tipo: hubTipo,
      rawTipo,
      fallbackNome: doc.nome_documento,
      contexto: isPergunta ? "Pergunta rápida" : "Exigência do processo",
      instrucoesCatalogo: doc.instrucoes,
      linkEmissao: doc.link_emissao,
      observacoesCatalogo: doc.observacoes_cliente,
      onPrimary: () => {},
      onEntregar: () => onEntregar(doc.id),
      entregarLabel: "Simular entrega ✓",
    };

    if (isPergunta) {
      item.perguntaChave = chave;
      item.perguntaOpcoes = opcoes.map((op: any) => ({
        valor: String(op.valor),
        label: op.label ? String(op.label) : undefined,
      }));
      item.respostaAtual = null;
      item.onResponder = async () => onEntregar(doc.id);
    }

    items.push(item);
  }

  // Ordem: grupo_checklist → criação
  items.sort((a, b) => {
    const da = docs.find((d) => d.id === a.id);
    const db = docs.find((d) => d.id === b.id);
    const groupDiff =
      (da?.ordem_grupo_checklist ?? 9999) - (db?.ordem_grupo_checklist ?? 9999);
    return groupDiff;
  });

  return items;
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Fase = "selecao" | "simulando" | "concluido";

export default function SimuladorClienteChecklist() {
  const [fase, setFase] = useState<Fase>("selecao");
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Processo | null>(null);
  const [docs, setDocs] = useState<DocProcesso[]>([]);
  const [entregues, setEntregues] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(true);

  // Carrega lista de processos cujo serviço está no catálogo de preços ativo.
  // Processos de teste com serviços fora do catálogo não aparecem aqui.
  useEffect(() => {
    (async () => {
      setCarregandoLista(true);
      try {
        // Passo 1: IDs válidos do catálogo
        const { data: catalogoRows } = await supabase
          .from("qa_servicos_catalogo" as any)
          .select("servico_id")
          .eq("ativo", true)
          .not("servico_id", "is", null);

        const idsCatalogo = ((catalogoRows as any[]) ?? [])
          .map((r: any) => Number(r.servico_id))
          .filter((n: number) => Number.isFinite(n));

        if (idsCatalogo.length === 0) return;

        // Passo 2: processos filtrando pelos IDs válidos
        const { data } = await supabase
          .from("qa_processos" as any)
          .select("id, servico_nome, status, cliente_id, data_criacao, qa_clientes(nome_completo)")
          .not("status", "in", "(deferido,indeferido,finalizado,cancelado)")
          .in("servico_id", idsCatalogo)
          .order("data_criacao", { ascending: false })
          .limit(200);

        if (data) {
          setProcessos(
            (data as any[]).map((p) => ({
              id: p.id,
              servico_nome: p.servico_nome ?? "Serviço",
              status: p.status ?? "",
              cliente_id: p.cliente_id,
              cliente_nome: p.qa_clientes?.nome_completo ?? null,
              data_criacao: p.data_criacao,
            })),
          );
        }
      } finally {
        setCarregandoLista(false);
      }
    })();
  }, []);

  const processosFiltrados = useMemo(() => {
    if (!busca.trim()) return processos;
    const q = busca.toLowerCase();
    return processos.filter(
      (p) =>
        (p.cliente_nome ?? "").toLowerCase().includes(q) ||
        p.servico_nome.toLowerCase().includes(q),
    );
  }, [processos, busca]);

  const iniciarSimulacao = async () => {
    if (!selecionado) return;
    setCarregando(true);
    try {
      const { data } = await supabase
        .from("qa_processo_documentos" as any)
        .select(
          "id, processo_id, tipo_documento, nome_documento, obrigatorio, status, etapa, ordem_grupo_checklist, grupo_checklist, instrucoes, link_emissao, observacoes_cliente, regra_validacao",
        )
        .eq("processo_id", selecionado.id)
        .order("ordem_grupo_checklist", { ascending: true });

      setDocs((data as unknown as DocProcesso[]) ?? []);
      setEntregues(new Set());
      setFase("simulando");
    } finally {
      setCarregando(false);
    }
  };

  const onEntregar = useCallback((id: string) => {
    setEntregues((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const pendencias = useMemo(
    () => buildPendencias(docs, entregues, onEntregar),
    [docs, entregues, onEntregar],
  );

  const totalObrigatorios = useMemo(
    () => docs.filter((d) => d.obrigatorio && d.status !== "aprovado").length,
    [docs],
  );

  // Detecta conclusão quando a fila esvazia
  useEffect(() => {
    if (fase === "simulando" && pendencias.length === 0 && docs.length > 0) {
      setFase("concluido");
    }
  }, [fase, pendencias.length, docs.length]);

  const reiniciar = () => {
    setEntregues(new Set());
    setFase("simulando");
  };

  const recomecar = () => {
    setFase("selecao");
    setSelecionado(null);
    setDocs([]);
    setEntregues(new Set());
  };

  const semDocs = fase === "simulando" && docs.length === 0;

  // ── Fase: Seleção ──────────────────────────────────────────────────────────
  if (fase === "selecao") {
    return (
      <div className="max-w-lg mx-auto py-8 px-4 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Simular checklist como cliente</h2>
          <p className="text-sm text-slate-500 mt-1">
            Selecione um processo ativo e avance o popup exatamente como o cliente faz —
            usando os documentos reais do processo.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente ou serviço…"
            className="pl-9 text-sm"
          />
        </div>

        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {carregandoLista && (
            <p className="text-sm text-slate-400 text-center py-4">Carregando processos…</p>
          )}
          {!carregandoLista && processosFiltrados.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum processo encontrado.</p>
          )}
          {processosFiltrados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelecionado(p.id === selecionado?.id ? null : p)}
              className={cn(
                "w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                selecionado?.id === p.id
                  ? "border-[#8A1224] bg-[#8A1224]/5"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              )}
            >
              <User className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {p.cliente_nome ?? `Cliente #${p.cliente_id}`}
                </p>
                <p className="text-xs text-slate-500 truncate">{p.servico_nome}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">
                  {p.status} · {new Date(p.data_criacao).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={iniciarSimulacao}
          disabled={!selecionado || carregando}
          className="w-full gap-2 bg-[#8A1224] hover:bg-[#6e0e1c] text-white"
        >
          <Play className="h-4 w-4" />
          {carregando
            ? "Carregando…"
            : selecionado
            ? `Simular: ${selecionado.cliente_nome ?? "Cliente"}`
            : "Selecione um processo"}
        </Button>
      </div>
    );
  }

  // ── Fase: Concluído ────────────────────────────────────────────────────────
  if (fase === "concluido") {
    return (
      <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Simulação concluída</h2>
            <p className="text-sm text-slate-500">
              {totalObrigatorios} item{totalObrigatorios !== 1 ? "s" : ""} obrigatório
              {totalObrigatorios !== 1 ? "s" : ""} percorrido{totalObrigatorios !== 1 ? "s" : ""}.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Todos os documentos pendentes do processo foram simulados com sucesso.
        </div>

        <div className="flex gap-3">
          <Button onClick={reiniciar} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Simular de novo
          </Button>
          <Button onClick={recomecar} variant="ghost" className="gap-2">
            Trocar processo
          </Button>
        </div>
      </div>
    );
  }

  // ── Fase: Simulando ────────────────────────────────────────────────────────
  const progresso =
    totalObrigatorios > 0 ? Math.round((entregues.size / totalObrigatorios) * 100) : 0;

  return (
    <div className="flex flex-col">
      {/* Barra de controle */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs text-slate-500 shrink-0">
            <span className="font-semibold text-slate-800">{entregues.size}</span>
            <span> / {totalObrigatorios} simulados</span>
          </span>
          <div className="h-1.5 flex-1 max-w-[140px] rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-[#8A1224] transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
          {selecionado && (
            <span className="text-[11px] text-slate-500 truncate hidden sm:block">
              {selecionado.cliente_nome ?? "Cliente"}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={recomecar} className="shrink-0 gap-1.5 text-xs h-7">
          <X className="h-3.5 w-3.5" />
          Encerrar
        </Button>
      </div>

      {/* Aviso de modo simulação */}
      <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-2 text-xs text-amber-800">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>Modo simulação</strong> — clique em{" "}
          <strong>"Simular entrega ✓"</strong> para avançar cada item como se o cliente tivesse entregado.
        </span>
      </div>

      {/* Popup real ou estado vazio */}
      {semDocs ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-slate-700">Nenhum documento pendente</p>
          <p className="text-xs text-slate-500 max-w-xs">
            Todos os documentos obrigatórios deste processo já estão aprovados, ou o processo
            não tem documentos registrados em{" "}
            <code className="font-mono bg-slate-100 px-1 rounded">qa_processo_documentos</code>.
          </p>
          <Button onClick={recomecar} variant="outline" size="sm" className="mt-2">
            Trocar processo
          </Button>
        </div>
      ) : (
        <PendenciasGuiadasPopup
          open={true}
          pendencias={pendencias}
          onDismiss={() => {}}
          bloqueante={false}
          asPage={true}
          nomeCliente={selecionado?.cliente_nome ?? "[Cliente de Teste]"}
        />
      )}
    </div>
  );
}
