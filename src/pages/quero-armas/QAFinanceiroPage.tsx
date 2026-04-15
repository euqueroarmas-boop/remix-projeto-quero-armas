import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, TrendingUp, TrendingDown, Users, FileText, CreditCard,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, Percent, Crown,
  ShoppingCart, Banknote, PiggyBank, BarChart3, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);

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

function MetricCard({ label, value, subtitle, icon: Icon, color, trend, bgColor }: {
  label: string; value: string; subtitle?: string; icon: any; color: string;
  trend?: { value: number; label: string }; bgColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
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

function ChartCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-white p-5 ${className || ""}`}>
      {children}
    </div>
  );
}

export default function QAFinanceiroPage() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
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
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const servicoMap = useMemo(() => new Map(servicos.map(s => [s.id, s])), [servicos]);
  const clienteMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);

  // ─── Core Metrics ───
  const metrics = useMemo(() => {
    const pagas = vendas.filter(v => v.status === "PAGO");
    const naoPagas = vendas.filter(v => ["NÃO PAGOU", "FALT. PARTE PAG.", "DESISTIU"].includes(v.status));
    const totalReceita = pagas.reduce((s, v) => s + (Number(v.valor_a_pagar) || 0), 0);
    const totalDescontos = vendas.reduce((s, v) => s + (Number(v.desconto) || 0), 0);
    const totalPendente = vendas.filter(v => v.status !== "PAGO").reduce((s, v) => s + (Number(v.valor_a_pagar) || 0), 0);
    const ticketMedio = pagas.length > 0 ? totalReceita / pagas.length : 0;
    const clientesUnicos = new Set(pagas.map(v => v.cliente_id)).size;
    const ltvMedio = clientesUnicos > 0 ? totalReceita / clientesUnicos : 0;
    const taxaConversao = vendas.length > 0 ? (pagas.length / vendas.length) * 100 : 0;
    const inadimplencia = vendas.length > 0 ? (naoPagas.length / vendas.length) * 100 : 0;

    // Monthly comparison
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    const thisMonthRev = pagas.filter(v => (v.data_cadastro || "").startsWith(thisMonth)).reduce((s, v) => s + (Number(v.valor_a_pagar) || 0), 0);
    const lastMonthRev = pagas.filter(v => (v.data_cadastro || "").startsWith(lastMonth)).reduce((s, v) => s + (Number(v.valor_a_pagar) || 0), 0);
    const monthTrend = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

    return {
      totalReceita, totalDescontos, totalPendente, ticketMedio,
      clientesUnicos, ltvMedio, taxaConversao, inadimplencia,
      totalVendas: vendas.length, totalPagas: pagas.length,
      thisMonthRev, lastMonthRev, monthTrend,
      totalServicosVendidos: itens.length,
    };
  }, [vendas, itens]);

  // ─── Revenue by Month ───
  const revenueByMonth = useMemo(() => {
    const map: Record<string, { mes: string; receita: number; vendas: number; descontos: number }> = {};
    vendas.filter(v => v.status === "PAGO").forEach(v => {
      const m = (v.data_cadastro || "").slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { mes: m, receita: 0, vendas: 0, descontos: 0 };
      map[m].receita += Number(v.valor_a_pagar) || 0;
      map[m].vendas++;
      map[m].descontos += Number(v.desconto) || 0;
    });
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).map(d => ({
      ...d,
      label: (() => {
        const [y, m] = d.mes.split("-");
        return `${new Date(+y, +m - 1).toLocaleDateString("pt-BR", { month: "short" })}/${y.slice(2)}`;
      })(),
    }));
  }, [vendas]);

  // ─── Revenue by Service ───
  const revenueByService = useMemo(() => {
    const map: Record<number, { nome: string; receita: number; qty: number }> = {};
    itens.forEach(i => {
      const sid = i.servico_id;
      if (!sid) return;
      const svc = servicoMap.get(sid);
      const nome = svc?.nome_servico || `#${sid}`;
      if (!map[sid]) map[sid] = { nome, receita: 0, qty: 0 };
      map[sid].receita += Number(i.valor) || 0;
      map[sid].qty++;
    });
    return Object.values(map)
      .sort((a, b) => b.receita - a.receita)
      .map(d => ({
        ...d,
        shortName: d.nome.length > 35 ? d.nome.slice(0, 33) + "…" : d.nome,
      }));
  }, [itens, servicoMap]);

  // ─── Revenue by Payment Method ───
  const revenueByMethod = useMemo(() => {
    const VALID_METHODS = ["PIX", "CARTÃO DE CRÉDITO", "DÉBITO", "QR CODE", "DINHEIRO"];
    const map: Record<string, { metodo: string; total: number; qty: number }> = {};
    vendas.filter(v => v.status === "PAGO").forEach(v => {
      let m = (v.forma_pagamento || "").trim().toUpperCase();
      // Normalize to valid methods
      if (m.includes("PIX")) m = "PIX";
      else if (m.includes("DÉBITO") || m.includes("DEBITO")) m = "DÉBITO";
      else if (m.includes("CARTÃO") || m.includes("CREDITO") || m.includes("CRÉDITO")) m = "CARTÃO DE CRÉDITO";
      else if (m.includes("QR")) m = "QR CODE";
      else if (m.includes("DINHEIRO") || m.includes("ESPÉCIE") || m.includes("ESPECIE")) m = "DINHEIRO";
      else m = "DINHEIRO"; // fallback
      if (!map[m]) map[m] = { metodo: m, total: 0, qty: 0 };
      map[m].total += Number(v.valor_a_pagar) || 0;
      map[m].qty++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [vendas]);

  // ─── Top Clients by Revenue ───
  const topClients = useMemo(() => {
    const map: Record<number, { nome: string; total: number; vendas: number }> = {};
    vendas.filter(v => v.status === "PAGO").forEach(v => {
      const cid = v.cliente_id;
      const cli = clienteMap.get(cid);
      const nome = cli?.nome_completo || `#${cid}`;
      if (!map[cid]) map[cid] = { nome, total: 0, vendas: 0 };
      map[cid].total += Number(v.valor_a_pagar) || 0;
      map[cid].vendas++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [vendas, clienteMap]);

  // ─── Status Distribution ───
  const statusDist = useMemo(() => {
    const map: Record<string, { status: string; total: number; valor: number }> = {};
    vendas.forEach(v => {
      const s = v.status || "Sem status";
      if (!map[s]) map[s] = { status: s, total: 0, valor: 0 };
      map[s].total++;
      map[s].valor += Number(v.valor_a_pagar) || 0;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [vendas]);

  // ─── Pending items by client ───
  const pendingClients = useMemo(() => {
    const naoPagas = vendas.filter(v => ["NÃO PAGOU", "FALT. PARTE PAG."].includes(v.status));
    return naoPagas.map(v => {
      const cli = clienteMap.get(v.cliente_id);
      return {
        nome: cli?.nome_completo || `#${v.cliente_id}`,
        valor: Number(v.valor_a_pagar) || 0,
        status: v.status,
        data: v.data_cadastro,
      };
    }).sort((a, b) => b.valor - a.valor);
  }, [vendas, clienteMap]);

  // ─── Cumulative revenue ───
  const cumulativeRevenue = useMemo(() => {
    let cum = 0;
    return revenueByMonth.map(d => {
      cum += d.receita;
      return { ...d, acumulado: cum };
    });
  }, [revenueByMonth]);

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
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Painel Financeiro</h1>
          <p className="text-sm text-slate-400 mt-0.5">Inteligência financeira completa · Receita · Serviços · Clientes</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {/* ─── KPI Row 1: Revenue ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard label="Receita Total" value={fmt(metrics.totalReceita)} icon={DollarSign}
          color="text-emerald-600" bgColor="bg-emerald-50"
          subtitle={`${metrics.totalPagas} vendas pagas`} />
        <MetricCard label="Receita do Mês" value={fmt(metrics.thisMonthRev)} icon={TrendingUp}
          color="text-indigo-600" bgColor="bg-indigo-50"
          trend={metrics.lastMonthRev > 0 ? { value: metrics.monthTrend, label: "vs mês ant." } : undefined} />
        <MetricCard label="Ticket Médio" value={fmt(metrics.ticketMedio)} icon={CreditCard}
          color="text-purple-600" bgColor="bg-purple-50" />
        <MetricCard label="LTV Médio" value={fmt(metrics.ltvMedio)} icon={Crown}
          color="text-amber-600" bgColor="bg-amber-50"
          subtitle={`${metrics.clientesUnicos} clientes únicos`} />
        <MetricCard label="Descontos Dados" value={fmt(metrics.totalDescontos)} icon={Percent}
          color="text-orange-600" bgColor="bg-orange-50"
          subtitle={`${metrics.totalReceita > 0 ? ((metrics.totalDescontos / (metrics.totalReceita + metrics.totalDescontos)) * 100).toFixed(1) : 0}% do bruto`} />
        <MetricCard label="A Receber" value={fmt(metrics.totalPendente)} icon={AlertTriangle}
          color="text-red-600" bgColor="bg-red-50"
          subtitle={`${metrics.inadimplencia.toFixed(1)}% inadimplência`} />
      </div>

      {/* ─── KPI Row 2: Operational ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total de Vendas" value={String(metrics.totalVendas)} icon={ShoppingCart}
          color="text-blue-600" bgColor="bg-blue-50" subtitle={`${metrics.totalPagas} pagas`} />
        <MetricCard label="Serviços Vendidos" value={String(metrics.totalServicosVendidos)} icon={FileText}
          color="text-teal-600" bgColor="bg-teal-50" />
        <MetricCard label="Taxa de Conversão" value={`${metrics.taxaConversao.toFixed(1)}%`} icon={CheckCircle2}
          color="text-emerald-600" bgColor="bg-emerald-50" subtitle="vendas pagas / total" />
        <MetricCard label="Clientes Ativos" value={String(clientes.length)} icon={Users}
          color="text-indigo-600" bgColor="bg-indigo-50"
          subtitle={`${metrics.clientesUnicos} compradores`} />
      </div>

      {/* ─── Charts Row 1: Revenue Over Time + Cumulative ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard>
          <SectionTitle icon={BarChart3} title="Receita por Mês" subtitle="Histórico de faturamento mensal" />
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
        </ChartCard>

        <ChartCard>
          <SectionTitle icon={TrendingUp} title="Receita Acumulada" subtitle="Evolução patrimonial ao longo do tempo" />
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
        </ChartCard>
      </div>

      {/* ─── Charts Row 2: Payment Methods + Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard>
          <SectionTitle icon={CreditCard} title="Formas de Pagamento" subtitle="Distribuição por método" />
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
        </ChartCard>

        <ChartCard>
          <SectionTitle icon={PiggyBank} title="Status das Vendas" subtitle="Distribuição por situação" />
          <div className="space-y-2.5">
            {statusDist.map((s, i) => {
              const pct = metrics.totalVendas > 0 ? (s.total / metrics.totalVendas) * 100 : 0;
              const isPago = s.status === "PAGO";
              const barColor = isPago ? "bg-emerald-500" : s.status.includes("NÃO") ? "bg-red-400" : "bg-amber-400";
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
        </ChartCard>
      </div>

      {/* ─── Revenue by Service ─── */}
      <ChartCard>
        <SectionTitle icon={FileText} title="Receita por Serviço" subtitle="Performance financeira de cada serviço" />
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
      </ChartCard>

      {/* ─── Row: Top Clients + Pending ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard>
          <SectionTitle icon={Crown} title="Top 10 Clientes" subtitle="Por receita total" />
          {topClients.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">Sem dados</p>
          ) : (
            <div className="space-y-2">
              {topClients.map((c, i) => {
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
        </ChartCard>

        <ChartCard>
          <SectionTitle icon={AlertTriangle} title="Inadimplentes" subtitle="Vendas com pagamento pendente" />
          {pendingClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-xs text-emerald-600 font-medium">Nenhuma inadimplência!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingClients.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-[12px] py-2 px-3 rounded-lg border border-red-100 bg-red-50/50">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-slate-700 font-medium">{c.nome}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    c.status === "NÃO PAGOU" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                  }`}>{c.status}</span>
                  <span className="font-mono font-semibold text-red-600 shrink-0">{fmt(c.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ─── Monthly Revenue Trend Line ─── */}
      <ChartCard>
        <SectionTitle icon={Banknote} title="Tendência Mensal" subtitle="Receita + Vendas ao longo dos meses" />
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
      </ChartCard>
    </div>
  );
}
