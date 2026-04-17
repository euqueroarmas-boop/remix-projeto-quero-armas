/**
 * Monitor Operacional de Processos
 * KPIs + lista de serviços em etapas críticas:
 *  - AGUARDANDO DOCUMENTOS DO CLIENTE  (inclui legado "AGUARDANDO DOCUMENTAÇÃO")
 *  - MONTANDO PASTA
 *
 * Fonte de dados: qa_itens_venda + qa_vendas + qa_clientes + qa_servicos.
 * Tempo parado = dias desde data_ultima_atualizacao (fallback: data_protocolo,
 * data_cadastro da venda, created_at da venda).
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderKanban, FileWarning, Users, Clock, ArrowUpRight,
  Search, AlertTriangle, ChevronRight, Loader2,
} from "lucide-react";

/* ================================================================
 * Status canônicos
 * ================================================================ */

const AGUARDANDO_DOCS = ["AGUARDANDO DOCUMENTOS DO CLIENTE", "AGUARDANDO DOCUMENTAÇÃO"];
const MONTANDO_PASTA = ["MONTANDO PASTA"];

const TARGET_STATUSES = [...AGUARDANDO_DOCS, ...MONTANDO_PASTA];

type FilterKey = "todos" | "aguardando_docs" | "montando_pasta";
type SortKey = "tempo_parado" | "recente" | "cliente" | "status" | "servico";

interface ItemRow {
  id: number;
  venda_id: number;
  servico_id: number | null;
  status: string;
  valor: number | null;
  data_protocolo: string | null;
  data_ultima_atualizacao: string | null;
}
interface VendaRow {
  id: number;
  cliente_id: number | null;
  data_cadastro: string | null;
  created_at: string | null;
}
interface ClienteRow { id: number; nome_completo: string | null; }
interface ServicoRow { id: number; nome_servico: string | null; }

interface MonitorRow {
  itemId: number;
  vendaId: number;
  clienteId: number | null;
  clienteNome: string;
  servicoNome: string;
  status: string;
  bucket: "aguardando_docs" | "montando_pasta";
  vendaDate: string | null;       // ISO yyyy-mm-dd
  diasParado: number;
  proximaAcao: string;
}

/* ================================================================
 * Helpers
 * ================================================================ */

const todayISO = () => new Date().toISOString().slice(0, 10);

function diffDays(fromISO: string | null, toISO: string = todayISO()): number {
  if (!fromISO) return 0;
  const a = new Date(fromISO + (fromISO.length === 10 ? "T00:00:00" : ""));
  const b = new Date(toISO + "T00:00:00");
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function fmtBR(iso: string | null): string {
  if (!iso) return "—";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

function bucketOf(status: string): MonitorRow["bucket"] | null {
  const up = (status || "").toUpperCase().trim();
  if (AGUARDANDO_DOCS.includes(up)) return "aguardando_docs";
  if (MONTANDO_PASTA.includes(up)) return "montando_pasta";
  return null;
}

function proximaAcaoFor(bucket: MonitorRow["bucket"]): string {
  return bucket === "aguardando_docs"
    ? "Cobrar documentos do cliente"
    : "Montar pasta e protocolar";
}

function urgencyClass(dias: number): string {
  if (dias >= 15) return "bg-rose-50 text-rose-700 border-rose-200";
  if (dias >= 7) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

/* ================================================================
 * Componente
 * ================================================================ */

export default function DashboardProcessosMonitor() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [sortBy, setSortBy] = useState<SortKey>("tempo_parado");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 1. Itens nas etapas alvo
        const { data: itens, error: e1 } = await supabase
          .from("qa_itens_venda" as any)
          .select("id, venda_id, servico_id, status, valor, data_protocolo, data_ultima_atualizacao")
          .in("status", TARGET_STATUSES);
        if (e1) throw e1;

        const itensList = (itens as any[] as ItemRow[]) || [];
        if (itensList.length === 0) {
          if (mounted) { setRows([]); setLoading(false); }
          return;
        }

        const vendaIds = Array.from(new Set(itensList.map(i => i.venda_id).filter(Boolean)));
        const servicoIds = Array.from(new Set(itensList.map(i => i.servico_id).filter(Boolean) as number[]));

        // 2. Vendas + Clientes + Serviços em paralelo
        const [vRes, sRes] = await Promise.all([
          supabase.from("qa_vendas" as any)
            .select("id, cliente_id, data_cadastro, created_at")
            .in("id", vendaIds),
          servicoIds.length
            ? supabase.from("qa_servicos" as any).select("id, nome_servico").in("id", servicoIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const vendas = (vRes.data as any[] as VendaRow[]) || [];
        const clienteIds = Array.from(new Set(vendas.map(v => v.cliente_id).filter(Boolean) as number[]));
        const cRes = clienteIds.length
          ? await supabase.from("qa_clientes" as any).select("id, nome_completo").in("id", clienteIds)
          : { data: [] as any[] };

        const vendasMap = new Map<number, VendaRow>(vendas.map(v => [v.id, v]));
        const clientesMap = new Map<number, ClienteRow>(((cRes.data as any[]) || []).map((c: any) => [c.id, c]));
        const servicosMap = new Map<number, ServicoRow>(((sRes.data as any[]) || []).map((s: any) => [s.id, s]));

        const built: MonitorRow[] = itensList.map((it) => {
          const venda = vendasMap.get(it.venda_id);
          const cliente = venda?.cliente_id ? clientesMap.get(venda.cliente_id) : undefined;
          const servico = it.servico_id ? servicosMap.get(it.servico_id) : undefined;
          const b = bucketOf(it.status)!;
          const vendaDate = venda?.data_cadastro || (venda?.created_at ? venda.created_at.slice(0, 10) : null);
          const stopRef = it.data_ultima_atualizacao || it.data_protocolo || vendaDate;
          return {
            itemId: it.id,
            vendaId: it.venda_id,
            clienteId: venda?.cliente_id ?? null,
            clienteNome: cliente?.nome_completo || "—",
            servicoNome: servico?.nome_servico || `Serviço #${it.servico_id ?? "?"}`,
            status: (it.status || "").toUpperCase(),
            bucket: b,
            vendaDate,
            diasParado: diffDays(stopRef),
            proximaAcao: proximaAcaoFor(b),
          };
        });

        if (mounted) setRows(built);
      } catch (err) {
        console.error("[DashboardProcessosMonitor] load error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const aguard = rows.filter(r => r.bucket === "aguardando_docs");
    const mont = rows.filter(r => r.bucket === "montando_pasta");
    return {
      aguard: {
        total: aguard.length,
        clientes: new Set(aguard.map(r => r.clienteId)).size,
      },
      mont: {
        total: mont.length,
        clientes: new Set(mont.map(r => r.clienteId)).size,
      },
    };
  }, [rows]);

  /* ── Lista filtrada + ordenada ── */
  const visible = useMemo(() => {
    let list = rows;
    if (filter !== "todos") list = list.filter(r => r.bucket === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.clienteNome.toLowerCase().includes(q) ||
        r.servicoNome.toLowerCase().includes(q) ||
        String(r.vendaId).includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "recente": return (b.vendaDate || "").localeCompare(a.vendaDate || "");
        case "cliente": return a.clienteNome.localeCompare(b.clienteNome);
        case "status": return a.status.localeCompare(b.status);
        case "servico": return a.servicoNome.localeCompare(b.servicoNome);
        case "tempo_parado":
        default:
          return b.diasParado - a.diasParado;
      }
    });
    return list;
  }, [rows, filter, sortBy, search]);

  if (loading) {
    return (
      <div className="qa-card p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base md:text-lg font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Monitor Operacional de Processos
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            Etapas críticas — visão por serviço e cliente
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KPICard
          icon={FileWarning}
          label="Aguardando documentos do cliente"
          total={kpis.aguard.total}
          clientes={kpis.aguard.clientes}
          tone="amber"
          active={filter === "aguardando_docs"}
          onClick={() => setFilter(filter === "aguardando_docs" ? "todos" : "aguardando_docs")}
        />
        <KPICard
          icon={FolderKanban}
          label="Montando pasta"
          total={kpis.mont.total}
          clientes={kpis.mont.clientes}
          tone="blue"
          active={filter === "montando_pasta"}
          onClick={() => setFilter(filter === "montando_pasta" ? "todos" : "montando_pasta")}
        />
      </div>

      {/* Toolbar */}
      <div className="qa-card p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1 flex-wrap">
            <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")}>Todos ({rows.length})</FilterChip>
            <FilterChip active={filter === "aguardando_docs"} onClick={() => setFilter("aguardando_docs")}>
              Aguardando docs ({kpis.aguard.total})
            </FilterChip>
            <FilterChip active={filter === "montando_pasta"} onClick={() => setFilter("montando_pasta")}>
              Montando pasta ({kpis.mont.total})
            </FilterChip>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, serviço ou nº venda..."
              className="pl-7 pr-3 h-8 w-full md:w-56 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="tempo_parado">Mais tempo parado</option>
            <option value="recente">Mais recente</option>
            <option value="cliente">Cliente (A→Z)</option>
            <option value="status">Status</option>
            <option value="servico">Serviço</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="qa-card overflow-hidden">
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-slate-400">
            Nenhum serviço nas etapas selecionadas.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="text-left font-medium px-3 py-2">Cliente</th>
                    <th className="text-left font-medium px-3 py-2">Serviço</th>
                    <th className="text-left font-medium px-3 py-2">Venda</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                    <th className="text-left font-medium px-3 py-2">Data venda</th>
                    <th className="text-left font-medium px-3 py-2">Tempo parado</th>
                    <th className="text-left font-medium px-3 py-2">Próxima ação</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.itemId} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-700">{r.clienteNome}</td>
                      <td className="px-3 py-2 text-slate-600">{r.servicoNome}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">#{r.vendaId}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          r.bucket === "aguardando_docs"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{fmtBR(r.vendaDate)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${urgencyClass(r.diasParado)}`}>
                          <Clock className="w-3 h-3" />
                          {r.diasParado}d
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{r.proximaAcao}</td>
                      <td className="px-3 py-2 text-right">
                        {r.clienteId && (
                          <Link
                            to={`/quero-armas/clientes?cliente=${r.clienteId}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                          >
                            Abrir <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {visible.map((r) => (
                <div key={r.itemId} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-slate-700 truncate">{r.clienteNome}</div>
                      <div className="text-[11.5px] text-slate-500 truncate">{r.servicoNome}</div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${urgencyClass(r.diasParado)}`}>
                      <Clock className="w-3 h-3" />
                      {r.diasParado}d
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      r.bucket === "aguardando_docs"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>{r.status}</span>
                    <span className="text-[10px] text-slate-400 font-mono">#{r.vendaId}</span>
                    <span className="text-[10px] text-slate-400">• {fmtBR(r.vendaDate)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-slate-400" />
                      {r.proximaAcao}
                    </div>
                    {r.clienteId && (
                      <Link
                        to={`/quero-armas/clientes?cliente=${r.clienteId}`}
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600"
                      >
                        Abrir <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
 * UI helpers
 * ================================================================ */

function KPICard({
  icon: Icon, label, total, clientes, tone, active, onClick,
}: {
  icon: any; label: string; total: number; clientes: number;
  tone: "amber" | "blue"; active: boolean; onClick: () => void;
}) {
  const palette = tone === "amber"
    ? { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", ring: "ring-amber-300" }
    : { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", ring: "ring-blue-300" };
  return (
    <button
      onClick={onClick}
      className={`text-left qa-card p-4 transition-all hover:shadow-md ${active ? `ring-2 ${palette.ring}` : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${palette.bg} border ${palette.border}`}>
          <Icon className={`w-4.5 h-4.5 ${palette.icon}`} />
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums" style={{ color: "hsl(220 20% 18%)" }}>{total}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">serviços</div>
        </div>
      </div>
      <div className="mt-3 text-[12.5px] font-semibold text-slate-700">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Users className="w-3 h-3" />
        {clientes} cliente{clientes === 1 ? "" : "s"} impactado{clientes === 1 ? "" : "s"}
      </div>
    </button>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 h-7 rounded-full text-[11px] font-medium border transition-colors ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
