// Simulador do popup do cliente — usa o PendenciasGuiadasPopup real.
// O admin seleciona um ou mais serviços e avança o checklist como se fosse
// o cliente entregando cada documento. Detecta gaps de hub e de biblioteca.

import { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toHubTipoCompartilhado } from "@/lib/quero-armas/hubTipoMap";
import PendenciasGuiadasPopup, {
  type PendenciaItem,
} from "@/components/quero-armas/portal/PendenciasGuiadasPopup";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Play, RotateCcw, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Servico = { id: number; nome_servico: string };

type DocCatalogo = {
  id: string;
  servico_id: number;
  tipo_documento: string;
  nome_documento: string;
  obrigatorio: boolean;
  ativo: boolean;
  ordem: number | null;
  ordem_grupo_checklist: number | null;
  grupo_checklist: string | null;
  instrucoes: string | null;
  link_emissao: string | null;
  observacoes_cliente: string | null;
  regra_validacao: Record<string, any> | null;
};

type Gap = {
  tipo: string;
  nome: string;
  semHub: boolean;
  semBiblioteca: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPendencias(
  docs: DocCatalogo[],
  servicoNomeById: Map<number, string>,
  entregues: Set<string>,
  onEntregar: (id: string) => void,
): PendenciaItem[] {
  const items: PendenciaItem[] = [];

  for (const doc of docs) {
    if (!doc.obrigatorio || !doc.ativo) continue;
    if (entregues.has(doc.id)) continue;

    const rawTipo = doc.tipo_documento.toLowerCase();
    const rv = doc.regra_validacao as any;
    const isPergunta = rv?.tipo === "pergunta";
    const chave = String(rv?.chave || "");
    const opcoes = Array.isArray(rv?.opcoes) ? rv.opcoes : [];

    if (isPergunta && (!chave || opcoes.length === 0)) continue;

    const hubTipo = isPergunta ? rawTipo : toHubTipoCompartilhado(rawTipo);
    const servicoLabel = servicoNomeById.get(doc.servico_id) ?? null;

    const item: PendenciaItem = {
      id: doc.id,
      kind: isPergunta ? "pergunta" : "documento",
      servicoId: doc.servico_id,
      servicoLabel,
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

  // Ordenação: mesma lógica do portal — ordem do catálogo, depois criação
  items.sort((a, b) => {
    const da = docs.find((d) => d.id === a.id);
    const db = docs.find((d) => d.id === b.id);
    const servicoDiff = (da?.servico_id ?? 0) - (db?.servico_id ?? 0);
    if (servicoDiff !== 0) return servicoDiff;
    const groupDiff =
      (da?.ordem_grupo_checklist ?? 9999) - (db?.ordem_grupo_checklist ?? 9999);
    if (groupDiff !== 0) return groupDiff;
    return (da?.ordem ?? 9999) - (db?.ordem ?? 9999);
  });

  return items;
}

function detectarGaps(docs: DocCatalogo[], bibliotecaCodigos: Set<string>): Gap[] {
  const vistos = new Set<string>();
  const gaps: Gap[] = [];

  for (const doc of docs) {
    if (!doc.obrigatorio || !doc.ativo) continue;
    const rv = doc.regra_validacao as any;
    if (rv?.tipo === "pergunta") continue; // perguntas não precisam de hub

    const rawTipo = doc.tipo_documento.toLowerCase();
    if (vistos.has(rawTipo)) continue;
    vistos.add(rawTipo);

    const hubTipo = toHubTipoCompartilhado(rawTipo);
    const semHub = hubTipo === "outro";
    const semBiblioteca = !bibliotecaCodigos.has(rawTipo);

    if (semHub || semBiblioteca) {
      gaps.push({ tipo: rawTipo, nome: doc.nome_documento, semHub, semBiblioteca });
    }
  }

  return gaps;
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Fase = "selecao" | "simulando" | "concluido";

export default function SimuladorClienteChecklist() {
  const [fase, setFase] = useState<Fase>("selecao");
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [docs, setDocs] = useState<DocCatalogo[]>([]);
  const [bibliotecaCodigos, setBibliotecaCodigos] = useState<Set<string>>(new Set());
  const [entregues, setEntregues] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    supabase
      .from("qa_servicos" as any)
      .select("id, nome_servico")
      .order("nome_servico")
      .then(({ data }) => {
        if (data) setServicos(data as Servico[]);
      });
  }, []);

  const servicoNomeById = useMemo(
    () => new Map(servicos.map((s) => [s.id, s.nome_servico])),
    [servicos],
  );

  const toggleServico = (id: number) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const iniciarSimulacao = async () => {
    if (!selecionados.length) return;
    setCarregando(true);
    try {
      const [docsRes, bibRes] = await Promise.all([
        supabase
          .from("qa_servicos_documentos" as any)
          .select(
            "id, servico_id, tipo_documento, nome_documento, obrigatorio, ativo, ordem, ordem_grupo_checklist, grupo_checklist, instrucoes, link_emissao, observacoes_cliente, regra_validacao",
          )
          .in("servico_id", selecionados)
          .eq("ativo", true)
          .order("ordem", { ascending: true }),
        supabase
          .from("qa_documentos_biblioteca" as any)
          .select("codigo")
          .eq("ativo", true),
      ]);
      setDocs((docsRes.data as DocCatalogo[]) ?? []);
      setBibliotecaCodigos(
        new Set(((bibRes.data as any[]) ?? []).map((r) => String(r.codigo).toLowerCase())),
      );
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
    () => buildPendencias(docs, servicoNomeById, entregues, onEntregar),
    [docs, servicoNomeById, entregues, onEntregar],
  );

  const gaps = useMemo(
    () => detectarGaps(docs, bibliotecaCodigos),
    [docs, bibliotecaCodigos],
  );

  const totalObrigatorios = useMemo(
    () => docs.filter((d) => d.obrigatorio && d.ativo).length,
    [docs],
  );

  // Detecta conclusão quando a fila esvazia
  useEffect(() => {
    if (fase === "simulando" && pendencias.length === 0 && docs.length > 0) {
      setFase("concluido");
    }
  }, [fase, pendencias.length, docs.length]);

  const semDocs = fase === "simulando" && docs.length === 0;

  const reiniciar = () => {
    setEntregues(new Set());
    setFase("simulando");
  };

  const recomecar = () => {
    setFase("selecao");
    setSelecionados([]);
    setDocs([]);
    setEntregues(new Set());
  };

  // ── Fase: Seleção ──────────────────────────────────────────────────────────
  if (fase === "selecao") {
    return (
      <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Simular checklist como cliente</h2>
          <p className="text-sm text-slate-500 mt-1">
            Selecione um ou mais serviços e avance o popup exatamente como o cliente faz —
            detecta gaps de hub e de biblioteca antes de o processo estar ativo.
          </p>
        </div>

        <div className="space-y-2">
          {servicos.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Carregando serviços…</p>
          )}
          {servicos.map((s) => (
            <label
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors",
                selecionados.includes(s.id)
                  ? "border-[#8A1224] bg-[#8A1224]/5"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              )}
            >
              <input
                type="checkbox"
                checked={selecionados.includes(s.id)}
                onChange={() => toggleServico(s.id)}
                className="h-4 w-4 rounded accent-[#8A1224]"
              />
              <span className="text-sm font-medium text-slate-900">{s.nome_servico}</span>
            </label>
          ))}
        </div>

        <Button
          onClick={iniciarSimulacao}
          disabled={!selecionados.length || carregando}
          className="w-full gap-2 bg-[#8A1224] hover:bg-[#6e0e1c] text-white"
        >
          <Play className="h-4 w-4" />
          {carregando ? "Carregando…" : `Iniciar simulação${selecionados.length > 1 ? ` (${selecionados.length} serviços)` : ""}`}
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

        {gaps.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {gaps.length} gap{gaps.length !== 1 ? "s" : ""} encontrado{gaps.length !== 1 ? "s" : ""}
            </div>
            <ul className="space-y-2">
              {gaps.map((g) => (
                <li key={g.tipo} className="text-xs">
                  <span className="font-semibold text-amber-900">{g.nome}</span>
                  <ul className="mt-0.5 ml-3 space-y-0.5">
                    {g.semHub && (
                      <li className="text-amber-700">
                        • Sem mapeamento de entrega — cliente usa slot genérico "outro" no Hub
                      </li>
                    )}
                    {g.semBiblioteca && (
                      <li className="text-amber-700">
                        • Sem instrução na biblioteca — cadastre com código{" "}
                        <code className="font-mono bg-amber-100 px-1 rounded">{g.tipo}</code>
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Nenhum gap detectado. Todos os documentos têm mapeamento de entrega e instrução na biblioteca.
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={reiniciar} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Simular de novo
          </Button>
          <Button onClick={recomecar} variant="ghost" className="gap-2">
            Trocar serviços
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
          {gaps.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 shrink-0">
              <AlertTriangle className="h-3 w-3" />
              {gaps.length} gap{gaps.length !== 1 ? "s" : ""}
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

      {/* O popup real */}
      {semDocs ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-slate-700">Nenhum documento encontrado</p>
          <p className="text-xs text-slate-500 max-w-xs">
            O(s) serviço(s) selecionado(s) não têm documentos cadastrados em{" "}
            <code className="font-mono bg-slate-100 px-1 rounded">qa_servicos_documentos</code>{" "}
            com <code className="font-mono bg-slate-100 px-1 rounded">ativo = true</code>.
          </p>
          <p className="text-[11px] text-slate-400">
            IDs buscados: {selecionados.join(", ")}
          </p>
        </div>
      ) : (
        <PendenciasGuiadasPopup
          open={true}
          pendencias={pendencias}
          onDismiss={() => {}}
          bloqueante={false}
          asPage={true}
          nomeCliente="[Cliente de Teste]"
        />
      )}
    </div>
  );
}
