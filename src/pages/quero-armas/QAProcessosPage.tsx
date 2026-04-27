import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, FileStack, RefreshCw, Filter, ChevronRight, FileText, AlertTriangle, CheckCircle, Clock, Sparkles, Eye, Upload, XCircle, User as UserIcon, Calendar } from "lucide-react";
import { getStatusProcesso, getStatusDocumento, formatDate, formatDateTime, STATUS_PROCESSO } from "@/components/quero-armas/processos/processoConstants";
import { ProcessoDetalheDrawer } from "@/components/quero-armas/processos/ProcessoDetalheDrawer";

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
  cliente?: { nome_completo: string; cpf: string | null; email: string | null };
  contadores?: { total: number; aprovados: number; pendentes: number; invalidos: number; divergentes: number; revisao: number };
}

export default function QAProcessosPage() {
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<ProcessoRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: procs, error } = await supabase
        .from("qa_processos")
        .select("id, cliente_id, servico_nome, servico_id, status, pagamento_status, data_criacao, updated_at, observacoes_admin")
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
      const ctMap = new Map<string, ProcessoRow["contadores"]>();
      (docs ?? []).forEach((d: any) => {
        const c = ctMap.get(d.processo_id) ?? { total: 0, aprovados: 0, pendentes: 0, invalidos: 0, divergentes: 0, revisao: 0 };
        c.total++;
        if (d.status === "aprovado") c.aprovados++;
        else if (d.status === "invalido") c.invalidos++;
        else if (d.status === "divergente") c.divergentes++;
        else if (d.status === "revisao_humana") c.revisao++;
        else c.pendentes++;
        ctMap.set(d.processo_id, c);
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
      if (!s) return true;
      return (
        p.cliente?.nome_completo?.toLowerCase().includes(s) ||
        p.cliente?.cpf?.includes(s) ||
        p.servico_nome?.toLowerCase().includes(s) ||
        p.id.includes(s)
      );
    });
  }, [processos, search, statusFilter]);

  const kpis = useMemo(() => {
    const total = processos.length;
    const pendentes = processos.filter((p) => p.status === "aguardando_documentos").length;
    const revisao = processos.filter((p) => p.status === "em_revisao_humana").length;
    const aprovados = processos.filter((p) => p.status === "aprovado" || p.status === "concluido" || p.status === "em_andamento").length;
    const bloqueados = processos.filter((p) => p.status === "bloqueado").length;
    return { total, pendentes, revisao, aprovados, bloqueados };
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
                  <th className="text-left px-4 py-3">DOCUMENTOS</th>
                  <th className="text-left px-4 py-3">CRIADO</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = getStatusProcesso(p.status);
                  const c = p.contadores ?? { total: 0, aprovados: 0, pendentes: 0, invalidos: 0, divergentes: 0, revisao: 0 };
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
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase">
                          <Badge color="#10B981" label={`${c.aprovados}/${c.total}`} title="APROVADOS" />
                          {c.pendentes > 0 && <Badge color="#F59E0B" label={`${c.pendentes}`} title="PENDENTES" />}
                          {c.revisao > 0 && <Badge color="#0EA5E9" label={`${c.revisao}`} title="REVISÃO" />}
                          {c.divergentes > 0 && <Badge color="#F59E0B" label={`${c.divergentes}`} title="DIVERGENTES" />}
                          {c.invalidos > 0 && <Badge color="#EF4444" label={`${c.invalidos}`} title="INVÁLIDOS" />}
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
        <ProcessoDetalheDrawer processoId={selectedId} adminMode onClose={() => setSelectedId(null)} onUpdated={carregar} />
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

function Badge({ color, label, title }: { color: string; label: string; title: string }) {
  return (
    <span title={title} className="inline-flex items-center px-1.5 py-0.5 rounded text-white" style={{ background: color }}>
      {label}
    </span>
  );
}