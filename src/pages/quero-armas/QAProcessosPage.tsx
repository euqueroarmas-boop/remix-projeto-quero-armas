import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, FileStack, RefreshCw, Filter, ChevronRight, FileText, AlertTriangle, CheckCircle, Clock, Sparkles, Eye, Upload, XCircle, User as UserIcon, Calendar, Timer } from "lucide-react";
import { getStatusProcesso, getStatusDocumento, formatDate, formatDateTime, STATUS_PROCESSO } from "@/components/quero-armas/processos/processoConstants";
import { ProcessoDetalheDrawer } from "@/components/quero-armas/processos/ProcessoDetalheDrawer";
import { computeChecklistMetrics } from "@/lib/quero-armas/checklistMetrics";

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

const ETAPA_LABEL: Record<number, string> = {
  1: "ENDEREÇO",
  2: "CONDIÇÃO PROFISSIONAL",
  3: "ANTECEDENTES",
  4: "DECLARAÇÕES",
  5: "EXAMES",
};

function diasAteData(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(`${d}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((t - today.getTime()) / 86400000);
}

function prazoTone(dias: number | null) {
  if (dias === null) return { bg: "bg-slate-100", text: "text-slate-500", label: "—" };
  if (dias < 0) return { bg: "bg-red-600", text: "text-white", label: `VENCIDO ${Math.abs(dias)}D` };
  if (dias <= 3) return { bg: "bg-red-500", text: "text-white", label: `${dias}D` };
  if (dias <= 7) return { bg: "bg-orange-500", text: "text-white", label: `${dias}D` };
  if (dias <= 30) return { bg: "bg-amber-500", text: "text-white", label: `${dias}D` };
  return { bg: "bg-emerald-600", text: "text-white", label: `${dias}D` };
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
    const revisao = processos.filter((p) => p.status === "em_revisao_humana").length;
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
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight" style={{ color: "#0F172A" }}>CENTRAL DE DOCUMENTOS</h1>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 mt-1">PROCESSOS, CHECKLISTS E VALIDAÇÕES POR CLIENTE</p>
        </div>
        <button onClick={carregar} className="h-9 px-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-xs uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> ATUALIZAR
        </button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="TOTAL" value={kpis.total} color="#0F172A" icon={<FileStack className="h-4 w-4" />} />
        <KpiCard label="AGUARDANDO DOCS" value={kpis.pendentes} color="#F59E0B" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="REVISÃO HUMANA" value={kpis.revisao} color="#0EA5E9" icon={<Eye className="h-4 w-4" />} />
        <KpiCard label="APROVADOS / EM CURSO" value={kpis.aprovados} color="#10B981" icon={<CheckCircle className="h-4 w-4" />} />
        <KpiCard label="BLOQUEADOS" value={kpis.bloqueados} color="#EF4444" icon={<XCircle className="h-4 w-4" />} />
      </div>

      {/* Matriz de prazos */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <PrazoKpi
          label="DOCS VENCIDOS"
          value={kpis.vencidos}
          color="#dc2626"
          active={prazoFilter === "vencidos"}
          onClick={() => setPrazoFilter(prazoFilter === "vencidos" ? "todos" : "vencidos")}
        />
        <PrazoKpi
          label="EM RISCO ≤ 7 DIAS"
          value={kpis.risco7}
          color="#ea580c"
          active={prazoFilter === "7d"}
          onClick={() => setPrazoFilter(prazoFilter === "7d" ? "todos" : "7d")}
        />
        <PrazoKpi
          label="ATENÇÃO ≤ 30 DIAS"
          value={kpis.risco30}
          color="#f59e0b"
          active={prazoFilter === "30d"}
          onClick={() => setPrazoFilter(prazoFilter === "30d" ? "todos" : "30d")}
        />
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="BUSCAR POR CLIENTE, CPF, SERVIÇO OU ID..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs uppercase tracking-wide placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-xs uppercase tracking-wide font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="todos">TODOS OS STATUS</option>
            {Object.entries(STATUS_PROCESSO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={prazoFilter}
            onChange={(e) => setPrazoFilter(e.target.value as any)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-xs uppercase tracking-wide font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="todos">TODOS OS PRAZOS</option>
            <option value="vencidos">SOMENTE VENCIDOS</option>
            <option value="7d">EM RISCO ≤ 7D</option>
            <option value="30d">ATENÇÃO ≤ 30D</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs uppercase tracking-wider text-slate-400">CARREGANDO PROCESSOS...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs uppercase tracking-wider text-slate-400">NENHUM PROCESSO ENCONTRADO</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-500">
                  <th className="text-left px-4 py-3">CLIENTE</th>
                  <th className="text-left px-4 py-3">SERVIÇO</th>
                  <th className="text-left px-4 py-3">STATUS</th>
                  <th className="text-left px-4 py-3">ETAPA</th>
                  <th className="text-left px-4 py-3">PRAZO CRÍTICO</th>
                  <th className="text-left px-4 py-3">DOCUMENTOS</th>
                  <th className="text-left px-4 py-3">CRIADO</th>
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
                    <tr key={p.id} onClick={() => setSelectedId(p.id)} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 text-xs uppercase">{p.cliente?.nome_completo ?? "—"}</div>
                        <div className="text-[10px] text-slate-400">{p.cliente?.cpf ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase text-slate-700">{p.servico_nome}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${st.bg} ${st.text} border ${st.border}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {etapa}/5 · {ETAPA_LABEL[etapa]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.prazo_critico_data ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tone.bg} ${tone.text}`}>
                              {tone.label}
                            </span>
                            <span className="text-[10px] text-slate-500">{formatDate(p.prazo_critico_data)}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] uppercase text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase">
                          <Badge color="#10B981" label={`${c.cumpridos}/${c.total}`} title="CUMPRIDOS" />
                          {c.pendentes > 0 && <Badge color="#F59E0B" label={`${c.pendentes}`} title="PENDENTES" />}
                          {c.emAnalise > 0 && <Badge color="#0EA5E9" label={`${c.emAnalise}`} title="EM ANÁLISE" />}
                          {c.outros > 0 && <Badge color="#94A3B8" label={`${c.outros}`} title="OUTROS" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.data_criacao)}</td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="h-4 w-4 text-slate-400 inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId && (
        <ProcessoDetalheDrawer processoId={selectedId} equipeMode onClose={() => setSelectedId(null)} onUpdated={carregar} />
      )}
    </div>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-2xl font-bold mt-2" style={{ color }}>{value}</div>
    </div>
  );
}

function PrazoKpi({ label, value, color, active, onClick }: { label: string; value: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white border rounded-xl p-4 transition hover:shadow-sm ${active ? "ring-2" : "border-slate-200"}`}
      style={active ? { borderColor: color, boxShadow: `0 0 0 2px ${color}20` } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500">{label}</span>
        <Timer className="h-4 w-4" style={{ color }} />
      </div>
      <div className="text-2xl font-bold mt-2" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
        {active ? "FILTRO ATIVO · CLIQUE PARA LIMPAR" : "CLIQUE PARA FILTRAR"}
      </div>
    </button>
  );
}

function Badge({ color, label, title }: { color: string; label: string; title: string }) {
  return (
    <span title={title} className="inline-flex items-center px-1.5 py-0.5 rounded text-white" style={{ background: color }}>
      {label}
    </span>
  );
}