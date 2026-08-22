import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, FileStack, RefreshCw, Filter, ChevronRight, XCircle, CheckCircle, Clock, Eye, Timer } from "lucide-react";
import { getStatusProcesso, formatDate, STATUS_PROCESSO } from "@/components/quero-armas/processos/processoConstants";
import { ProcessoDetalheDrawer } from "@/components/quero-armas/processos/ProcessoDetalheDrawer";
import { computeChecklistMetrics } from "@/lib/quero-armas/checklistMetrics";
import QASincronizarExigenciasBtn from "@/components/quero-armas/admin/QASincronizarExigenciasBtn";
import { ehRevisaoHumana } from "@/lib/quero-armas/statusRevisaoHumana";
import { nomeDaEtapa } from "@/lib/quero-armas/pendenciasGrupos";

interface ProcessoRow {
  id: string;
  cliente_id: number;
  servico_nome: string;
  servico_id: number | null;
  status: string;
  pagamento_status: string;
  data_criacao: string;
  updated_at: string;
  observacoes_admin: string | null;
  prazo_critico_data: string | null;
  etapa_liberada_ate: number | null;
  cliente?: { nome_completo: string; cpf: string | null; email: string | null };
  contadores?: { total: number; cumpridos: number; pendentes: number; emAnalise: number; outros: number };
}

// Nome da etapa = nome do grupo (pendenciasGrupos), igual em toda tela.
const ETAPA_LABEL: Record<number, string> = {
  1: nomeDaEtapa(1).toUpperCase(),
  2: nomeDaEtapa(2).toUpperCase(),
  3: nomeDaEtapa(3).toUpperCase(),
  4: nomeDaEtapa(4).toUpperCase(),
  5: nomeDaEtapa(5).toUpperCase(),
};

function diasAteData(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(`${d}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((t - today.getTime()) / 86400000);
}

/* Tons de prazo pelos tokens do tema real (--qa-*): no modo noturno a tela sai
   do filtro de inversão, então cor fixa de Tailwind não serve mais. */
function prazoTone(dias: number | null): { bg: string; fg: string; label: string } {
  if (dias === null) return { bg: "var(--qa-chip-bg)", fg: "var(--qa-tinta-3)", label: "—" };
  if (dias < 0) return { bg: "var(--qa-vermelho-bg)", fg: "var(--qa-vermelho)", label: `VENCIDO ${Math.abs(dias)}D` };
  if (dias <= 7) return { bg: "var(--qa-vermelho-bg)", fg: "var(--qa-vermelho)", label: `${dias}D` };
  if (dias <= 30) return { bg: "var(--qa-ambar-bg)", fg: "var(--qa-ambar)", label: `${dias}D` };
  return { bg: "var(--qa-verde-bg)", fg: "var(--qa-verde)", label: `${dias}D` };
}

export default function QAProcessosPage() {
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<ProcessoRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [prazoFilter, setPrazoFilter] = useState<"todos" | "vencidos" | "7d" | "30d">("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: procs, error } = await supabase
        .from("qa_processos")
        .select("id, cliente_id, servico_nome, servico_id, status, pagamento_status, data_criacao, updated_at, observacoes_admin, prazo_critico_data, etapa_liberada_ate")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const list = (procs ?? []) as ProcessoRow[];
      const clienteIds = [...new Set(list.map((p) => p.cliente_id))];
      const procIds = list.map((p) => p.id);

      const [{ data: clientes }, { data: docs }] = await Promise.all([
        clienteIds.length
          ? supabase.from("qa_clientes").select("id, nome_completo, cpf, email").in("id", clienteIds)
          : Promise.resolve({ data: [] as any[] }),
        procIds.length
          ? supabase.from("qa_processo_documentos").select("processo_id, status").in("processo_id", procIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const cliMap = new Map<number, any>((clientes ?? []).map((c: any) => [c.id, c]));
      const docsPorProcesso = new Map<string, Array<{ status: string | null }>>();
      (docs ?? []).forEach((d: any) => {
        const list = docsPorProcesso.get(d.processo_id) ?? [];
        list.push({ status: d.status });
        docsPorProcesso.set(d.processo_id, list);
      });
      const ctMap = new Map<string, ProcessoRow["contadores"]>();
      docsPorProcesso.forEach((procDocs, processoId) => {
        const m = computeChecklistMetrics(procDocs);
        ctMap.set(processoId, { total: m.total, cumpridos: m.cumpridos, pendentes: m.pendentes, emAnalise: m.emAnalise, outros: m.outros });
      });

      setProcessos(list.map((p) => ({ ...p, cliente: cliMap.get(p.cliente_id), contadores: ctMap.get(p.id) })));
    } catch (e: any) {
      toast.error("Erro ao carregar processos: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return processos.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (prazoFilter !== "todos") {
        const dias = diasAteData(p.prazo_critico_data);
        if (dias === null) return false;
        if (prazoFilter === "vencidos" && dias >= 0) return false;
        if (prazoFilter === "7d" && (dias < 0 || dias > 7)) return false;
        if (prazoFilter === "30d" && (dias < 0 || dias > 30)) return false;
      }
      if (!s) return true;
      return (
        p.cliente?.nome_completo?.toLowerCase().includes(s) ||
        p.cliente?.cpf?.includes(s) ||
        p.servico_nome?.toLowerCase().includes(s) ||
        p.id.includes(s)
      );
    });
  }, [processos, search, statusFilter, prazoFilter]);

  const kpis = useMemo(() => {
    const total = processos.length;
    const pendentes = processos.filter((p) => p.status === "aguardando_documentos").length;
    const revisao = processos.filter((p) => ehRevisaoHumana(p.status)).length;
    const aprovados = processos.filter((p) => p.status === "aprovado" || p.status === "concluido" || p.status === "em_andamento").length;
    const bloqueados = processos.filter((p) => p.status === "bloqueado").length;
    let vencidos = 0;
    let risco7 = 0;
    let risco30 = 0;
    for (const p of processos) {
      const d = diasAteData(p.prazo_critico_data);
      if (d === null) continue;
      if (d < 0) vencidos++;
      else if (d <= 7) risco7++;
      else if (d <= 30) risco30++;
    }
    return { total, pendentes, revisao, aprovados, bloqueados, vencidos, risco7, risco30 };
  }, [processos]);

  return (
    <div
      /* Tela migrada para o tema real, igual à Dashboard: a casca sai do filtro
         de inversão do modo noturno e desenha nos tokens --qa-*.
         Ver "PÁGINAS — tema real" em index.css. */
      data-qa-pagina
      className="space-y-5 md:space-y-6 w-full max-w-[1760px] ml-0 mr-auto"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-bold uppercase tracking-tight break-words [overflow-wrap:anywhere]" style={{ color: "var(--qa-tinta)" }}>
            CENTRAL DE DOCUMENTOS
          </h1>
          <p className="text-[10px] md:text-xs uppercase tracking-[0.14em] mt-1" style={{ color: "var(--qa-tinta-3)" }}>
            PROCESSOS, CHECKLISTS E VALIDAÇÕES POR CLIENTE
          </p>
        </div>
        <button
          onClick={carregar}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-lg border border-[var(--qa-linha)] bg-[var(--qa-paper)] text-xs uppercase tracking-wider font-bold hover:bg-[var(--qa-hover)] transition-colors"
          style={{ color: "var(--qa-tinta-2)" }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> ATUALIZAR
        </button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 md:gap-3">
        <KpiCard label="TOTAL" value={kpis.total} cor="var(--qa-tinta)" icon={<FileStack className="h-4 w-4" />} />
        <KpiCard label="AGUARDANDO DOCS" value={kpis.pendentes} cor="var(--qa-ambar)" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="REVISÃO HUMANA" value={kpis.revisao} cor="var(--qa-tinta-2)" icon={<Eye className="h-4 w-4" />} />
        <KpiCard label="APROVADOS / EM CURSO" value={kpis.aprovados} cor="var(--qa-verde)" icon={<CheckCircle className="h-4 w-4" />} />
        <KpiCard label="BLOQUEADOS" value={kpis.bloqueados} cor="var(--qa-vermelho)" icon={<XCircle className="h-4 w-4" />} />
      </div>

      {/* Matriz de prazos */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3">
        <PrazoKpi label="DOCS VENCIDOS" value={kpis.vencidos} cor="var(--qa-vermelho)" active={prazoFilter === "vencidos"} onClick={() => setPrazoFilter(prazoFilter === "vencidos" ? "todos" : "vencidos")} />
        <PrazoKpi label="EM RISCO ≤ 7 DIAS" value={kpis.risco7} cor="var(--qa-vermelho)" active={prazoFilter === "7d"} onClick={() => setPrazoFilter(prazoFilter === "7d" ? "todos" : "7d")} />
        <PrazoKpi label="ATENÇÃO ≤ 30 DIAS" value={kpis.risco30} cor="var(--qa-ambar)" active={prazoFilter === "30d"} onClick={() => setPrazoFilter(prazoFilter === "30d" ? "todos" : "30d")} />
      </div>

      {/* Filtros */}
      <div className="qa-card rounded-xl border border-[var(--qa-linha)] bg-[var(--qa-paper)] p-3 flex flex-wrap items-center gap-2.5 md:gap-3">
        <div className="relative w-full md:flex-1 md:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--qa-tinta-4)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="BUSCAR POR CLIENTE, CPF, SERVIÇO OU ID..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--qa-linha)] bg-[var(--qa-paper)] text-xs uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-[var(--qa-linha-2)]"
            style={{ color: "var(--qa-tinta)" }}
          />
        </div>
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <Filter className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--qa-tinta-4)" }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 min-w-0 flex-1 px-2 md:px-3 rounded-lg border border-[var(--qa-linha)] bg-[var(--qa-paper)] text-[11px] md:text-xs uppercase tracking-wide font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--qa-linha-2)]"
            style={{ color: "var(--qa-tinta-2)" }}
          >
            <option value="todos">TODOS OS STATUS</option>
            {Object.entries(STATUS_PROCESSO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <Timer className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--qa-tinta-4)" }} />
          <select
            value={prazoFilter}
            onChange={(e) => setPrazoFilter(e.target.value as any)}
            className="h-9 min-w-0 flex-1 px-2 md:px-3 rounded-lg border border-[var(--qa-linha)] bg-[var(--qa-paper)] text-[11px] md:text-xs uppercase tracking-wide font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--qa-linha-2)]"
            style={{ color: "var(--qa-tinta-2)" }}
          >
            <option value="todos">TODOS OS PRAZOS</option>
            <option value="vencidos">SOMENTE VENCIDOS</option>
            <option value="7d">EM RISCO ≤ 7D</option>
            <option value="30d">ATENÇÃO ≤ 30D</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="qa-card rounded-xl border border-[var(--qa-linha)] bg-[var(--qa-paper)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs uppercase tracking-wider" style={{ color: "var(--qa-tinta-4)" }}>CARREGANDO PROCESSOS...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs uppercase tracking-wider" style={{ color: "var(--qa-tinta-4)" }}>NENHUM PROCESSO ENCONTRADO</div>
        ) : (
          <>
            {/* CELULAR: um cartão por processo. A tabela espremida quebrava o
                texto letra a letra na vertical — mesmo padrão da Dashboard. */}
            <div className="md:hidden">
              {filtered.map((p) => {
                const st = getStatusProcesso(p.status);
                const c = p.contadores ?? { total: 0, cumpridos: 0, pendentes: 0, emAnalise: 0, outros: 0 };
                const dias = diasAteData(p.prazo_critico_data);
                const tone = prazoTone(dias);
                const etapa = Math.max(1, Math.min(5, p.etapa_liberada_ate ?? 1));
                return (
                  <div key={p.id} className="px-4 py-3 border-b border-[var(--qa-linha-4)]">
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-[12.5px] font-bold uppercase break-words [overflow-wrap:anywhere]" style={{ color: "var(--qa-tinta)" }}>
                          {p.cliente?.nome_completo ?? "—"}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--qa-tinta-4)" }} />
                      </div>
                      <div className="text-[10px] font-medium tabular-nums" style={{ color: "var(--qa-tinta-4)" }}>
                        {p.cliente?.cpf ?? "—"}
                      </div>
                      <div className="mt-1 text-[10.5px] font-medium uppercase tracking-wider break-words [overflow-wrap:anywhere]" style={{ color: "var(--qa-tinta-3)" }}>
                        {p.servico_nome}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9.5px] font-bold uppercase tracking-wider border ${st.bg} ${st.text} ${st.border}`}>
                          {st.label}
                        </span>
                        <Chip fundo="var(--qa-chip-bg)" cor="var(--qa-tinta-2)">
                          {etapa}/5 · {ETAPA_LABEL[etapa]}
                        </Chip>
                        {p.prazo_critico_data && (
                          <Chip fundo={tone.bg} cor={tone.fg} titulo={`Prazo crítico em ${formatDate(p.prazo_critico_data)}`}>
                            {tone.label}
                          </Chip>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Chip fundo="var(--qa-verde-bg)" cor="var(--qa-verde)" titulo="Documentos cumpridos">
                          {c.cumpridos}/{c.total}
                        </Chip>
                        {c.pendentes > 0 && <Chip fundo="var(--qa-ambar-bg)" cor="var(--qa-ambar)" titulo="Pendentes">{c.pendentes} PENDENTE(S)</Chip>}
                        {c.emAnalise > 0 && <Chip fundo="var(--qa-chip-bg)" cor="var(--qa-tinta-2)" titulo="Em análise">{c.emAnalise} EM ANÁLISE</Chip>}
                        {c.outros > 0 && <Chip fundo="var(--qa-chip-bg)" cor="var(--qa-tinta-3)" titulo="Outros">{c.outros} OUTROS</Chip>}
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--qa-tinta-4)" }}>
                          CRIADO {formatDate(p.data_criacao)}
                        </span>
                      </div>
                    </button>
                    <div className="mt-2">
                      <QASincronizarExigenciasBtn processoId={p.id} onDone={() => carregar()} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--qa-linha)]" style={{ background: "var(--qa-paper-2)" }}>
                  <tr className="text-[10px] uppercase tracking-[0.12em] font-bold" style={{ color: "var(--qa-tinta-3)" }}>
                    <th className="text-left px-4 py-3">CLIENTE</th>
                    <th className="text-left px-4 py-3">SERVIÇO</th>
                    <th className="text-left px-4 py-3">STATUS</th>
                    <th className="text-left px-4 py-3">ETAPA</th>
                    <th className="text-left px-4 py-3">PRAZO CRÍTICO</th>
                    <th className="text-left px-4 py-3">DOCUMENTOS</th>
                    <th className="text-left px-4 py-3 whitespace-nowrap">CRIADO</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const st = getStatusProcesso(p.status);
                    const c = p.contadores ?? { total: 0, cumpridos: 0, pendentes: 0, emAnalise: 0, outros: 0 };
                    const dias = diasAteData(p.prazo_critico_data);
                    const tone = prazoTone(dias);
                    const etapa = Math.max(1, Math.min(5, p.etapa_liberada_ate ?? 1));
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className="border-b border-[var(--qa-linha-4)] hover:bg-[var(--qa-hover)] cursor-pointer"
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-xs uppercase break-words [overflow-wrap:anywhere]" style={{ color: "var(--qa-tinta)" }}>
                            {p.cliente?.nome_completo ?? "—"}
                          </div>
                          <div className="text-[10px] tabular-nums" style={{ color: "var(--qa-tinta-4)" }}>{p.cliente?.cpf ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs uppercase break-words [overflow-wrap:anywhere]" style={{ color: "var(--qa-tinta-2)" }}>
                          {p.servico_nome}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border ${st.bg} ${st.text} ${st.border}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Chip fundo="var(--qa-chip-bg)" cor="var(--qa-tinta-2)">
                            {etapa}/5 · {ETAPA_LABEL[etapa]}
                          </Chip>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {p.prazo_critico_data ? (
                            <div className="flex flex-col gap-0.5">
                              <Chip fundo={tone.bg} cor={tone.fg}>{tone.label}</Chip>
                              <span className="text-[10px] whitespace-nowrap" style={{ color: "var(--qa-tinta-3)" }}>{formatDate(p.prazo_critico_data)}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] uppercase" style={{ color: "var(--qa-tinta-4)" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Chip fundo="var(--qa-verde-bg)" cor="var(--qa-verde)" titulo="Cumpridos">{c.cumpridos}/{c.total}</Chip>
                            {c.pendentes > 0 && <Chip fundo="var(--qa-ambar-bg)" cor="var(--qa-ambar)" titulo="Pendentes">{c.pendentes}</Chip>}
                            {c.emAnalise > 0 && <Chip fundo="var(--qa-chip-bg)" cor="var(--qa-tinta-2)" titulo="Em análise">{c.emAnalise}</Chip>}
                            {c.outros > 0 && <Chip fundo="var(--qa-chip-bg)" cor="var(--qa-tinta-3)" titulo="Outros">{c.outros}</Chip>}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs whitespace-nowrap" style={{ color: "var(--qa-tinta-3)" }}>{formatDate(p.data_criacao)}</td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="inline-flex items-center gap-2">
                            <QASincronizarExigenciasBtn processoId={p.id} onDone={() => carregar()} />
                            <ChevronRight className="h-4 w-4 inline" style={{ color: "var(--qa-tinta-4)" }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selectedId && (
        /* O drawer agora desenha nos tokens --qa-* (ilha de tema real), então
           abre igual aqui e nas telas ainda não migradas. */
        <ProcessoDetalheDrawer processoId={selectedId} equipeMode onClose={() => setSelectedId(null)} onUpdated={carregar} />
      )}
    </div>
  );
}

function Chip({ children, fundo, cor, titulo }: { children: React.ReactNode; fundo: string; cor: string; titulo?: string }) {
  return (
    <span
      title={titulo}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: fundo, color: cor }}
    >
      {children}
    </span>
  );
}

function KpiCard({ label, value, cor, icon }: { label: string; value: number; cor: string; icon: React.ReactNode }) {
  return (
    <div className="qa-card rounded-xl border border-[var(--qa-linha)] bg-[var(--qa-paper)] p-3 md:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] md:text-[10px] uppercase tracking-[0.14em] font-bold leading-tight break-words [overflow-wrap:anywhere]" style={{ color: "var(--qa-tinta-3)" }}>
          {label}
        </span>
        <span className="shrink-0" style={{ color: cor }}>{icon}</span>
      </div>
      <div className="text-xl md:text-2xl font-bold mt-2 tabular-nums" style={{ color: cor }}>{value}</div>
    </div>
  );
}

function PrazoKpi({ label, value, cor, active, onClick }: { label: string; value: number; cor: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="qa-card rounded-xl border border-[var(--qa-linha)] bg-[var(--qa-paper)] text-left p-3 md:p-4 transition hover:bg-[var(--qa-hover)]"
      style={active ? { borderColor: cor, boxShadow: `0 0 0 2px ${cor}33` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] md:text-[10px] uppercase tracking-[0.14em] font-bold leading-tight break-words [overflow-wrap:anywhere]" style={{ color: "var(--qa-tinta-3)" }}>
          {label}
        </span>
        <Timer className="h-4 w-4 shrink-0" style={{ color: cor }} />
      </div>
      <div className="text-xl md:text-2xl font-bold mt-2 tabular-nums" style={{ color: cor }}>{value}</div>
      <div className="text-[9px] md:text-[10px] uppercase tracking-wider mt-1 leading-tight" style={{ color: "var(--qa-tinta-4)" }}>
        {active ? "FILTRO ATIVO · TOQUE PARA LIMPAR" : "TOQUE PARA FILTRAR"}
      </div>
    </button>
  );
}
