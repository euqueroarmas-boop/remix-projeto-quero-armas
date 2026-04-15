import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, TrendingUp, TrendingDown, Users, FileText, CreditCard,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, Percent, Crown,
  ShoppingCart, Banknote, PiggyBank, BarChart3, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CalendarDays,
  Eye, EyeOff, X, Maximize2, Minimize2, ListFilter, Table2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);
const fmtDate = (d: string) => {
  if (!d) return "—";
  const p = d.split("-");
  if (p.length >= 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return d;
};

const COLORS = {
  primary: "hsl(230, 80%, 56%)",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  indigo: "#6366f1",
  teal: "#14b8a6",
  orange: "#f97316",
  cyan: "#06b6d4",
  slate: "#64748b",
};

const PIE_COLORS = [COLORS.emerald, COLORS.blue, COLORS.amber, COLORS.purple, COLORS.pink, COLORS.teal, COLORS.orange, COLORS.cyan];

const tooltipStyle = {
  background: "white",
  border: "1px solid hsl(220, 13%, 91%)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function MetricCard({ label, value, subtitle, icon: Icon, color, trend, bgColor, onClick }: {
  label: string; value: string; subtitle?: string; icon: any; color: string;
  trend?: { value: number; label: string }; bgColor?: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200/80 bg-white p-4 hover:shadow-md hover:border-slate-300/80 transition-all duration-300 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className={`text-xl font-bold font-mono tabular-nums mt-1.5 ${color}`}>{value}</p>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium ${trend.value >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {trend.value >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              <span>{trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}% {trend.label}</span>
            </div>
          )}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${bgColor || "bg-slate-50"}`}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
        <Icon className="h-4 w-4 text-indigo-600" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function ExpandableChartCard({ children, title, subtitle, icon, detailContent, defaultExpanded = false }: {
  children: React.ReactNode; title: string; subtitle?: string; icon: any;
  detailContent?: React.ReactNode; defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white transition-all duration-300 hover:shadow-sm">
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => detailContent && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon={icon} title={title} subtitle={subtitle} />
          {detailContent && (
            <button className="flex items-center gap-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {expanded ? "Recolher" : "Expandir detalhes"}
            </button>
          )}
        </div>
        <div onClick={e => e.stopPropagation()}>{children}</div>
      </div>
      {expanded && detailContent && (
        <div className="border-t border-slate-100 p-5 bg-slate-50/50 rounded-b-xl animate-in slide-in-from-top-2 duration-200">
          {detailContent}
        </div>
      )}
    </div>
  );
}

function MonthSelector({ months, selected, onSelect }: {
  months: string[]; selected: string | null; onSelect: (m: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  if (months.length === 0) return null;

  const selectedLabel = selected
    ? `${MONTH_NAMES[+selected.split("-")[1] - 1]} ${selected.split("-")[0]}`
    : "Todos os meses";

  // Navigate prev/next
  const currentIdx = selected ? months.indexOf(selected) : -1;
  const canPrev = currentIdx > 0;
  const canNext = selected ? currentIdx < months.length - 1 : months.length > 0;

  const goPrev = () => { if (canPrev) onSelect(months[currentIdx - 1]); };
  const goNext = () => {
    if (!selected && months.length > 0) { onSelect(months[0]); return; }
    if (canNext) onSelect(months[currentIdx + 1]);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
        <button
          onClick={goPrev}
          disabled={!canPrev}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors min-w-[140px] justify-center"
        >
          <CalendarDays className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">{selectedLabel}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <button
          onClick={goNext}
          disabled={!canNext}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${!selected ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Todos os meses
            </button>
            {[...months].reverse().map(m => {
              const [y, mo] = m.split("-");
              const label = `${MONTH_NAMES[+mo - 1]} ${y}`;
              const isActive = m === selected;
              return (
                <button
                  key={m}
                  onClick={() => { onSelect(m); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${isActive ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DetailTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            {headers.map((h, i) => (
              <th key={i} className={`py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-white transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`py-2.5 px-3 ${j === 0 ? "text-left text-slate-700 font-medium" : "text-right font-mono text-slate-600"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QAFinanceiroPage() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [vRes, iRes, cRes, sRes] = await Promise.all([
        supabase.from("qa_vendas" as any).select("*"),
        supabase.from("qa_itens_venda" as any).select("*"),
        supabase.from("qa_clientes" as any).select("id, nome_completo, excluido"),
        supabase.from("qa_servicos" as any).select("id, nome_servico, valor_servico"),
      ]);
      setVendas((vRes.data as any[]) || []);
      setItens((iRes.data as any[]) || []);
      setClientes(((cRes.data as any[]) || []).filter((c: any) => !c.excluido));
      setServicos((sRes.data as any[]) || []);
    } catch (err) {
      console.error("[QAFinanceiro] load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const servicoMap = useMemo(() => new Map(servicos.map(s => [s.id, s])), [servicos]);
  const clienteMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);

  // All months available
  const allMonths = useMemo(() => {
    const set = new Set<string>();
    vendas.forEach(v => {
      const m = (v.data_cadastro || "").slice(0, 7);
      if (m) set.add(m);
    });
    return Array.from(set).sort();
  }, [vendas]);

  // Filtered vendas/itens by selected month
  const filteredVendas = useMemo(() => {
    if (!selectedMonth) return vendas;
    return vendas.filter(v => (v.data_cadastro || "").startsWith(selectedMonth));
  }, [vendas, selectedMonth]);

  const filteredItens = useMemo(() => {
    if (!selectedMonth) return itens;
    const vendaIds = new Set(filteredVendas.map(v => v.id));
    return itens.filter(i => vendaIds.has(i.venda_id));
  }, [itens, filteredVendas, selectedMonth]);

  // ─── Core Metrics ───
  const metrics = useMemo(() => {
    const pagas = filteredVendas.filter(v => v.status === "PAGO");
    const naoPagas = filteredVendas.filter(v => ["NÃO PAGOU", "FALT. PARTE PAG.", "DESISTIU"].includes(v.status));
    const totalReceita = pagas.reduce((s, v) => s + (Number(v.valor_a_pagar) || 0), 0);
    const totalDescontos = filteredVendas.reduce((s, v) => s + (Number(v.desconto) || 0), 0);
    const totalPendente = filteredVendas.filter(v => v.status !== "PAGO").reduce((s, v) => s + (Number(v.valor_a_pagar) || 0), 0);
    const ticketMedio = pagas.length > 0 ? totalReceita / pagas.length : 0;
    const clientesUnicos = new Set(pagas.map(v => v.cliente_id)).size;
    const ltvMedio = clientesUnicos > 0 ? totalReceita / clientesUnicos : 0;
    const taxaConversao = filteredVendas.length > 0 ? (pagas.length / filteredVendas.length) * 100 : 0;
    const inadimplencia = filteredVendas.length > 0 ? (naoPagas.length / filteredVendas.length) * 100 : 0;

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    const thisMonthRev = pagas.filter(v => (v.data_cadastro || "").startsWith(thisMonth)).reduce((s, v) => s + (Number(v.valor_a_pagar) || 0), 0);
    const lastMonthRev = vendas.filter(v => v.status === "PAGO" && (v.data_cadastro || "").startsWith(lastMonth)).reduce((s, v) => s + (Number(v.valor_a_pagar) || 0), 0);
    const monthTrend = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

    const totalBruto = filteredVendas.reduce((s, v) => s + (Number(v.valor_a_pagar) || 0) + (Number(v.desconto) || 0), 0);

    return {
      totalReceita, totalDescontos, totalPendente, ticketMedio,
      clientesUnicos, ltvMedio, taxaConversao, inadimplencia,
      totalVendas: filteredVendas.length, totalPagas: pagas.length,
      thisMonthRev, lastMonthRev, monthTrend,
      totalServicosVendidos: filteredItens.length, totalBruto,
      totalNaoPagas: naoPagas.length,
    };
  }, [filteredVendas, filteredItens, vendas]);

  // ─── Revenue by Month ───
  const revenueByMonth = useMemo(() => {
    const map: Record<string, { mes: string; receita: number; vendas: number; descontos: number; pendente: number; pagas: number; naoPagas: number }> = {};
    vendas.forEach(v => {
      const m = (v.data_cadastro || "").slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { mes: m, receita: 0, vendas: 0, descontos: 0, pendente: 0, pagas: 0, naoPagas: 0 };
      map[m].vendas++;
      map[m].descontos += Number(v.desconto) || 0;
      if (v.status === "PAGO") {
        map[m].receita += Number(v.valor_a_pagar) || 0;
        map[m].pagas++;
      } else {
        map[m].pendente += Number(v.valor_a_pagar) || 0;
        if (["NÃO PAGOU", "FALT. PARTE PAG.", "DESISTIU"].includes(v.status)) map[m].naoPagas++;
      }
    });
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).map(d => ({
      ...d,
      label: (() => {
        const [y, m] = d.mes.split("-");
        return `${MONTH_NAMES[+m - 1]}/${y.slice(2)}`;
      })(),
      ticketMedio: d.pagas > 0 ? d.receita / d.pagas : 0,
      conversao: d.vendas > 0 ? (d.pagas / d.vendas) * 100 : 0,
    }));
  }, [vendas]);

  // ─── Revenue by Service ───
  const revenueByService = useMemo(() => {
    const map: Record<number, { nome: string; receita: number; qty: number; vendaIds: Set<any> }> = {};
    filteredItens.forEach(i => {
      const sid = i.servico_id;
      if (!sid) return;
      const svc = servicoMap.get(sid);
      const nome = svc?.nome_servico || `#${sid}`;
      if (!map[sid]) map[sid] = { nome, receita: 0, qty: 0, vendaIds: new Set() };
      map[sid].receita += Number(i.valor) || 0;
      map[sid].qty++;
      if (i.venda_id) map[sid].vendaIds.add(i.venda_id);
    });
    return Object.values(map)
      .sort((a, b) => b.receita - a.receita)
      .map(d => ({ nome: d.nome, receita: d.receita, qty: d.qty, clientesUnicos: d.vendaIds.size }));
  }, [filteredItens, servicoMap]);

  // ─── Revenue by Payment Method (only valid methods) ───
  const revenueByMethod = useMemo(() => {
    const allowed = new Set(["PIX", "CARTÃO DE CRÉDITO", "CARTÃO DE DÉBITO", "QR CODE", "DINHEIRO"]);
    const map: Record<string, { metodo: string; total: number; qty: number }> = {};
    filteredVendas.filter(v => v.status === "PAGO").forEach(v => {
      let m = (v.forma_pagamento || "").trim().toUpperCase();
      if (m.includes("PIX")) m = "PIX";
      else if (m.includes("DÉBITO") || m.includes("DEBITO")) m = "CARTÃO DE DÉBITO";
      else if (m.includes("CARTÃO") || m.includes("CREDITO") || m.includes("CRÉDITO")) m = "CARTÃO DE CRÉDITO";
      else if (m.includes("QR")) m = "QR CODE";
      else if (m.includes("DINHEIRO") || m.includes("ESPÉCIE") || m.includes("ESPECIE")) m = "DINHEIRO";
      else return; // skip invalid/unrecognized
      if (!allowed.has(m)) return;
      if (!map[m]) map[m] = { metodo: m, total: 0, qty: 0 };
      map[m].total += Number(v.valor_a_pagar) || 0;
      map[m].qty++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredVendas]);

  // ─── Top Clients by Revenue ───
  const topClients = useMemo(() => {
    const map: Record<number, { nome: string; total: number; vendas: number; ticketMedio: number; servicos: string[] }> = {};
    filteredVendas.filter(v => v.status === "PAGO").forEach(v => {
      const cid = v.cliente_id;
      const cli = clienteMap.get(cid);
      const nome = cli?.nome_completo || `#${cid}`;
      if (!map[cid]) map[cid] = { nome, total: 0, vendas: 0, ticketMedio: 0, servicos: [] };
      map[cid].total += Number(v.valor_a_pagar) || 0;
      map[cid].vendas++;
    });
    // Add ticket medio
    Object.values(map).forEach(c => { c.ticketMedio = c.vendas > 0 ? c.total / c.vendas : 0; });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 15);
  }, [filteredVendas, clienteMap]);

  // ─── Status Distribution ───
  const statusDist = useMemo(() => {
    const map: Record<string, { status: string; total: number; valor: number }> = {};
    filteredVendas.forEach(v => {
      const s = v.status || "Sem status";
      if (!map[s]) map[s] = { status: s, total: 0, valor: 0 };
      map[s].total++;
      map[s].valor += Number(v.valor_a_pagar) || 0;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [filteredVendas]);

  // ─── Pending items by client ───
  const pendingClients = useMemo(() => {
    const naoPagas = filteredVendas.filter(v => ["NÃO PAGOU", "FALT. PARTE PAG."].includes(v.status));
    return naoPagas.map(v => {
      const cli = clienteMap.get(v.cliente_id);
      return {
        nome: cli?.nome_completo || `#${v.cliente_id}`,
        valor: Number(v.valor_a_pagar) || 0,
        status: v.status,
        data: v.data_cadastro,
        forma: v.forma_pagamento || "—",
      };
    }).sort((a, b) => b.valor - a.valor);
  }, [filteredVendas, clienteMap]);

  // ─── Cumulative revenue ───
  const cumulativeRevenue = useMemo(() => {
    let cum = 0;
    return revenueByMonth.map(d => {
      cum += d.receita;
      return { ...d, acumulado: cum };
    });
  }, [revenueByMonth]);

  // ─── Daily breakdown for selected month ───
  const dailyBreakdown = useMemo(() => {
    if (!selectedMonth) return [];
    const map: Record<string, { dia: string; receita: number; vendas: number; descontos: number }> = {};
    filteredVendas.forEach(v => {
      const d = v.data_cadastro || "";
      if (!d.startsWith(selectedMonth)) return;
      if (!map[d]) map[d] = { dia: d, receita: 0, vendas: 0, descontos: 0 };
      map[d].vendas++;
      if (v.status === "PAGO") map[d].receita += Number(v.valor_a_pagar) || 0;
      map[d].descontos += Number(v.desconto) || 0;
    });
    return Object.values(map).sort((a, b) => a.dia.localeCompare(b.dia)).map(d => ({
      ...d,
      label: d.dia.split("-")[2] || d.dia,
    }));
  }, [filteredVendas, selectedMonth]);

  // ─── All sales listing for selected month ───
  const salesListing = useMemo(() => {
    return filteredVendas.map(v => {
      const cli = clienteMap.get(v.cliente_id);
      const vendaItens = filteredItens.filter(i => i.venda_id === v.id);
      const servicosNomes = vendaItens.map(i => {
        const svc = servicoMap.get(i.servico_id);
        return svc?.nome_servico || `#${i.servico_id}`;
      });
      return {
        id: v.id,
        data: v.data_cadastro,
        cliente: cli?.nome_completo || `#${v.cliente_id}`,
        servicos: servicosNomes.join(", ") || "—",
        valor: Number(v.valor_a_pagar) || 0,
        desconto: Number(v.desconto) || 0,
        forma: v.forma_pagamento || "—",
        status: v.status || "—",
        observacao: v.observacao || "",
      };
    }).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [filteredVendas, filteredItens, clienteMap, servicoMap]);

  const selectedMonthLabel = selectedMonth
    ? (() => { const [y, m] = selectedMonth.split("-"); return `${MONTH_NAMES[+m - 1]} ${y}`; })()
    : "Todos os meses";

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 tracking-wider">Carregando painel financeiro...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Painel Financeiro</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Inteligência financeira completa · {selectedMonthLabel}
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {/* Month Selector */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-3">Filtrar por período</p>
        <MonthSelector months={allMonths} selected={selectedMonth} onSelect={setSelectedMonth} />
      </div>

      {/* ─── KPI Row 1: Revenue ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard label="Receita Total" value={fmt(metrics.totalReceita)} icon={DollarSign}
          color="text-emerald-600" bgColor="bg-emerald-50"
          subtitle={`${metrics.totalPagas} vendas pagas`} />
        <MetricCard label={selectedMonth ? "Receita do Período" : "Receita do Mês"} value={fmt(selectedMonth ? metrics.totalReceita : metrics.thisMonthRev)} icon={TrendingUp}
          color="text-indigo-600" bgColor="bg-indigo-50"
          trend={!selectedMonth && metrics.lastMonthRev > 0 ? { value: metrics.monthTrend, label: "vs mês ant." } : undefined} />
        <MetricCard label="Ticket Médio" value={fmt(metrics.ticketMedio)} icon={CreditCard}
          color="text-purple-600" bgColor="bg-purple-50"
          subtitle={`por venda paga`} />
        <MetricCard label="LTV Médio" value={fmt(metrics.ltvMedio)} icon={Crown}
          color="text-amber-600" bgColor="bg-amber-50"
          subtitle={`${metrics.clientesUnicos} clientes únicos`} />
        <MetricCard label="Descontos" value={fmt(metrics.totalDescontos)} icon={Percent}
          color="text-orange-600" bgColor="bg-orange-50"
          subtitle={`${metrics.totalBruto > 0 ? ((metrics.totalDescontos / metrics.totalBruto) * 100).toFixed(1) : 0}% do bruto`} />
        <MetricCard label="A Receber" value={fmt(metrics.totalPendente)} icon={AlertTriangle}
          color="text-red-600" bgColor="bg-red-50"
          subtitle={`${metrics.inadimplencia.toFixed(1)}% inadimplência`} />
      </div>

      {/* ─── KPI Row 2: Operational ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total de Vendas" value={String(metrics.totalVendas)} icon={ShoppingCart}
          color="text-blue-600" bgColor="bg-blue-50" subtitle={`${metrics.totalPagas} pagas · ${metrics.totalNaoPagas} não pagas`} />
        <MetricCard label="Serviços Vendidos" value={String(metrics.totalServicosVendidos)} icon={FileText}
          color="text-teal-600" bgColor="bg-teal-50"
          subtitle={`${revenueByService.length} tipos diferentes`} />
        <MetricCard label="Taxa de Conversão" value={`${metrics.taxaConversao.toFixed(1)}%`} icon={CheckCircle2}
          color="text-emerald-600" bgColor="bg-emerald-50" subtitle="vendas pagas / total" />
        <MetricCard label="Clientes Ativos" value={String(clientes.length)} icon={Users}
          color="text-indigo-600" bgColor="bg-indigo-50"
          subtitle={`${metrics.clientesUnicos} compradores no período`} />
      </div>

      {/* ─── Daily Breakdown (only when month selected) ─── */}
      {selectedMonth && dailyBreakdown.length > 0 && (
        <ExpandableChartCard
          icon={CalendarDays}
          title={`Vendas Diárias — ${selectedMonthLabel}`}
          subtitle="Detalhamento dia a dia do mês selecionado"
          detailContent={
            <DetailTable
              headers={["Dia", "Vendas", "Receita", "Descontos"]}
              rows={dailyBreakdown.map(d => [
                fmtDate(d.dia),
                String(d.vendas),
                <span className="text-emerald-600 font-semibold">{fmt(d.receita)}</span>,
                fmt(d.descontos),
              ])}
            />
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyBreakdown} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => name === "vendas" ? `${v}` : fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receita" name="Receita" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
              <Bar dataKey="vendas" name="Vendas" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ExpandableChartCard>
      )}

      {/* ─── Charts Row 1: Revenue Over Time + Cumulative ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ExpandableChartCard
          icon={BarChart3}
          title="Receita por Mês"
          subtitle="Histórico de faturamento mensal"
          detailContent={
            <DetailTable
              headers={["Mês", "Receita", "Descontos", "Pendente", "Vendas", "Pagas", "Ticket Médio", "Conversão"]}
              rows={revenueByMonth.map(d => [
                d.label,
                <span className="text-emerald-600 font-semibold">{fmt(d.receita)}</span>,
                fmt(d.descontos),
                <span className="text-red-500">{fmt(d.pendente)}</span>,
                String(d.vendas),
                String(d.pagas),
                fmt(d.ticketMedio),
                `${d.conversao.toFixed(1)}%`,
              ])}
            />
          }
        >
          {revenueByMonth.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueByMonth} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="receita" name="Receita" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="descontos" name="Descontos" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ExpandableChartCard>

        <ExpandableChartCard
          icon={TrendingUp}
          title="Receita Acumulada"
          subtitle="Evolução patrimonial ao longo do tempo"
          detailContent={
            <DetailTable
              headers={["Mês", "Receita no Mês", "Acumulado"]}
              rows={cumulativeRevenue.map(d => [
                d.label,
                fmt(d.receita),
                <span className="text-emerald-600 font-bold">{fmt(d.acumulado)}</span>,
              ])}
            />
          }
        >
          {cumulativeRevenue.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={cumulativeRevenue} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAccum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke={COLORS.emerald} fill="url(#gradAccum)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ExpandableChartCard>
      </div>

      {/* ─── Charts Row 2: Payment Methods + Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ExpandableChartCard
          icon={CreditCard}
          title="Formas de Pagamento"
          subtitle="Cartão de Crédito · Débito · PIX · QR Code · Dinheiro"
          detailContent={
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 font-medium mb-2">Detalhamento completo por forma de pagamento:</p>
              {revenueByMethod.map((m, i) => {
                const pct = metrics.totalReceita > 0 ? (m.total / metrics.totalReceita) * 100 : 0;
                return (
                  <div key={m.metodo} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-100">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{m.metodo}</p>
                      <p className="text-[10px] text-slate-400">{m.qty} transações · {pct.toFixed(1)}% do faturamento</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-emerald-600">{fmt(m.total)}</p>
                      <p className="text-[10px] text-slate-400">ticket: {m.qty > 0 ? fmt(m.total / m.qty) : "—"}</p>
                    </div>
                  </div>
                );
              })}
              {revenueByMethod.length === 0 && <p className="text-xs text-slate-400">Nenhuma venda paga no período.</p>}
            </div>
          }
        >
          {revenueByMethod.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">Sem dados</p>
          ) : (
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={revenueByMethod} dataKey="total" nameKey="metodo" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {revenueByMethod.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ExpandableChartCard>

        <ExpandableChartCard
          icon={PiggyBank}
          title="Status das Vendas"
          subtitle="Distribuição por situação de pagamento"
          detailContent={
            <DetailTable
              headers={["Status", "Qtd", "Valor Total", "% Total", "Ticket Médio"]}
              rows={statusDist.map(s => {
                const pct = metrics.totalVendas > 0 ? (s.total / metrics.totalVendas) * 100 : 0;
                return [
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    s.status === "PAGO" ? "bg-emerald-100 text-emerald-700" : s.status.includes("NÃO") ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                  }`}>{s.status}</span>,
                  String(s.total),
                  fmt(s.valor),
                  `${pct.toFixed(1)}%`,
                  s.total > 0 ? fmt(s.valor / s.total) : "—",
                ];
              })}
            />
          }
        >
          <div className="space-y-2.5">
            {statusDist.map((s) => {
              const pct = metrics.totalVendas > 0 ? (s.total / metrics.totalVendas) * 100 : 0;
              const barColor = s.status === "PAGO" ? "bg-emerald-500" : s.status.includes("NÃO") ? "bg-red-400" : "bg-amber-400";
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-700 font-medium">{s.status}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">{s.total}x</span>
                      <span className="font-mono font-semibold text-slate-700">{fmt(s.valor)}</span>
                      <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandableChartCard>
      </div>

      {/* ─── Revenue by Service ─── */}
      <ExpandableChartCard
        icon={FileText}
        title="Receita por Serviço"
        subtitle="Performance financeira de cada serviço prestado"
        detailContent={
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500">Análise detalhada de cada serviço com ticket médio, quantidade e participação no faturamento total:</p>
            {revenueByService.map((s, i) => {
              const pct = metrics.totalReceita > 0 ? (s.receita / metrics.totalReceita) * 100 : 0;
              return (
                <div key={i} className="p-3 rounded-lg bg-white border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-800">{s.nome}</p>
                    <span className="text-sm font-bold font-mono text-emerald-600">{fmt(s.receita)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div className="bg-slate-50 rounded p-2">
                      <p className="text-slate-400">Quantidade</p>
                      <p className="font-bold text-slate-700 mt-0.5">{s.qty}x</p>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <p className="text-slate-400">Ticket Médio</p>
                      <p className="font-bold text-slate-700 mt-0.5">{s.qty > 0 ? fmt(s.receita / s.qty) : "—"}</p>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <p className="text-slate-400">% Faturamento</p>
                      <p className="font-bold text-indigo-600 mt-0.5">{pct.toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <p className="text-slate-400">Clientes</p>
                      <p className="font-bold text-slate-700 mt-0.5">{s.clientesUnicos}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        }
      >
        {revenueByService.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">Sem dados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">#</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Serviço</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Qtd</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Receita</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ticket</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">% Total</th>
                </tr>
              </thead>
              <tbody>
                {revenueByService.map((s, i) => {
                  const pct = metrics.totalReceita > 0 ? (s.receita / metrics.totalReceita) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{i + 1}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{s.nome}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{s.qty}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600">{fmt(s.receita)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">{s.qty > 0 ? fmt(s.receita / s.qty) : "—"}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ExpandableChartCard>

      {/* ─── Row: Top Clients + Pending ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ExpandableChartCard
          icon={Crown}
          title="Top 15 Clientes"
          subtitle="Ranking por receita total"
          detailContent={
            <DetailTable
              headers={["#", "Cliente", "Vendas", "Ticket Médio", "Receita Total"]}
              rows={topClients.map((c, i) => [
                String(i + 1),
                c.nome,
                String(c.vendas),
                fmt(c.ticketMedio),
                <span className="text-emerald-600 font-bold">{fmt(c.total)}</span>,
              ])}
            />
          }
        >
          {topClients.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">Sem dados</p>
          ) : (
            <div className="space-y-2">
              {topClients.slice(0, 10).map((c, i) => {
                const maxVal = topClients[0]?.total || 1;
                const pct = (c.total / maxVal) * 100;
                return (
                  <div key={i} className="group">
                    <div className="flex items-center gap-2.5 text-[12px]">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        i === 0 ? "bg-amber-50 text-amber-600" : i === 1 ? "bg-slate-100 text-slate-500" : i === 2 ? "bg-orange-50 text-orange-500" : "bg-slate-50 text-slate-400"
                      }`}>{i + 1}</span>
                      <span className="flex-1 min-w-0 truncate text-slate-700 font-medium">{c.nome}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{c.vendas}x</span>
                      <span className="font-mono font-semibold text-emerald-600 shrink-0">{fmt(c.total)}</span>
                    </div>
                    <div className="ml-8.5 mt-1">
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full transition-all group-hover:bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ExpandableChartCard>

        <ExpandableChartCard
          icon={AlertTriangle}
          title="Inadimplentes"
          subtitle="Vendas com pagamento pendente"
          detailContent={
            pendingClients.length > 0 ? (
              <DetailTable
                headers={["Cliente", "Data", "Forma", "Status", "Valor"]}
                rows={pendingClients.map(c => [
                  c.nome,
                  fmtDate(c.data),
                  c.forma,
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    c.status === "NÃO PAGOU" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                  }`}>{c.status}</span>,
                  <span className="text-red-600 font-semibold">{fmt(c.valor)}</span>,
                ])}
              />
            ) : undefined
          }
        >
          {pendingClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-xs text-emerald-600 font-medium">Nenhuma inadimplência!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingClients.slice(0, 8).map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-[12px] py-2 px-3 rounded-lg border border-red-100 bg-red-50/50">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-slate-700 font-medium">{c.nome}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    c.status === "NÃO PAGOU" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                  }`}>{c.status}</span>
                  <span className="font-mono font-semibold text-red-600 shrink-0">{fmt(c.valor)}</span>
                </div>
              ))}
              {pendingClients.length > 8 && (
                <p className="text-[10px] text-slate-400 text-center">+ {pendingClients.length - 8} inadimplentes (clique em expandir)</p>
              )}
            </div>
          )}
        </ExpandableChartCard>
      </div>

      {/* ─── Monthly Revenue Trend Line ─── */}
      <ExpandableChartCard
        icon={Banknote}
        title="Tendência Mensal"
        subtitle="Receita + Vendas ao longo dos meses"
        detailContent={
          <DetailTable
            headers={["Mês", "Receita", "Vendas", "Descontos", "Ticket Médio", "Conversão"]}
            rows={revenueByMonth.map(d => [
              d.label,
              <span className="text-emerald-600 font-semibold">{fmt(d.receita)}</span>,
              String(d.vendas),
              fmt(d.descontos),
              fmt(d.ticketMedio),
              `${d.conversao.toFixed(1)}%`,
            ])}
          />
        }
      >
        {revenueByMonth.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => name === "vendas" ? `${v} vendas` : fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="receita" name="Receita" stroke={COLORS.emerald} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="vendas" name="Vendas" stroke={COLORS.purple} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ExpandableChartCard>

      {/* ─── Full Sales Listing ─── */}
      <ExpandableChartCard
        icon={Table2}
        title={`Relatório de Vendas${selectedMonth ? ` — ${selectedMonthLabel}` : ""}`}
        subtitle={`${salesListing.length} vendas no período · Clique para ver todas as transações`}
        defaultExpanded={!!selectedMonth}
        detailContent={
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500 mb-3">
              Listagem completa de todas as vendas {selectedMonth ? `em ${selectedMonthLabel}` : ""} com cliente, serviços, valor, forma de pagamento e status.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Data</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cliente</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Serviços</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Forma</th>
                    <th className="text-right py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Desc.</th>
                    <th className="text-right py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Valor</th>
                    <th className="text-center py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesListing.map((v, i) => (
                    <tr key={v.id || i} className="border-b border-slate-50 hover:bg-white transition-colors">
                      <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{fmtDate(v.data)}</td>
                      <td className="py-2 px-2 text-slate-700 font-medium max-w-[160px] truncate">{v.cliente}</td>
                      <td className="py-2 px-2 text-slate-500 max-w-[200px] truncate">{v.servicos}</td>
                      <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{v.forma}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-400">{v.desconto > 0 ? fmt(v.desconto) : "—"}</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600">{fmt(v.valor)}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                          v.status === "PAGO" ? "bg-emerald-100 text-emerald-700" : v.status.includes("NÃO") ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                        }`}>{v.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        }
      >
        <div className="flex items-center gap-4 py-6 justify-center text-slate-400">
          <Table2 className="h-6 w-6" />
          <div>
            <p className="text-xs font-medium text-slate-600">{salesListing.length} vendas registradas</p>
            <p className="text-[10px] text-slate-400">Clique em "Expandir detalhes" para ver a listagem completa</p>
          </div>
        </div>
      </ExpandableChartCard>
    </div>
  );
}
