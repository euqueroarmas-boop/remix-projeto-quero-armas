import { useEffect, useState, useMemo, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle, Clock, XCircle, PenTool, BookOpen,
  ArrowRight, FileText, Shield, TrendingUp, TrendingDown, Users,
  Scale, Gavel, BarChart3, Activity, ArrowUpRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// LazyOnVisible removido dos widgets críticos por estabilidade (mount único, sem IO).

const DashboardExames = lazy(() => import("@/components/quero-armas/dashboard/DashboardExames"));
const DashboardProcessosMonitor = lazy(() => import("@/components/quero-armas/dashboard/DashboardProcessosMonitor"));
const DashboardPrazosRecursais = lazy(() => import("@/components/quero-armas/dashboard/DashboardPrazosRecursais"));

interface Stats {
  documentos: number;
  normas: number;
  jurisprudencias: number;
  pecas: number;
  pendentes: number;
  erros: number;
  consultas: number;
  aprovadas: number;
  referencias: number;
  rascunhos: number;
  novosCadastros: number;
}

interface DayCount { day: string; total: number }
interface MonthCount { month: string; total: number }
interface ServicoCount { name: string; value: number }

interface RecentItem {
  id: string;
  titulo: string;
  tipo: string;
  created_at: string;
  status?: string;
}

interface NovoCadastro {
  id: string;
  nome_completo: string;
  cpf: string;
  telefone_principal: string;
  email: string;
  end1_cidade: string;
  end1_estado: string;
  servico_interesse: string;
  status: string;
  pago?: boolean | null;
  created_at: string;
}

// Premium chart colors
const COLORS = {
  blue: "hsl(230 80% 56%)",
  purple: "hsl(262 60% 55%)",
  cyan: "hsl(190 80% 42%)",
  green: "hsl(152 60% 42%)",
  amber: "hsl(38 92% 50%)",
  rose: "hsl(0 72% 55%)",
};

const PIE_COLORS = [COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.green, COLORS.amber];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="qa-tooltip">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 text-xs">{p.name}:</span>
          <span className="font-semibold text-slate-700 text-xs">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function QADashboardPage() {
  const [stats, setStats] = useState<Stats>({
    documentos: 0, normas: 0, jurisprudencias: 0, pecas: 0,
    pendentes: 0, erros: 0, consultas: 0, aprovadas: 0, referencias: 0, rascunhos: 0, novosCadastros: 0,
  });
  const [novosCadastros, setNovosCadastros] = useState<NovoCadastro[]>([]);
  const [recentPecas, setRecentPecas] = useState<RecentItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<RecentItem[]>([]);
  const [cadastrosPorDia, setCadastrosPorDia] = useState<DayCount[]>([]);
  const [cadastrosPorMes, setCadastrosPorMes] = useState<MonthCount[]>([]);
  const [servicosDistrib, setServicosDistrib] = useState<ServicoCount[]>([]);
  const [loading, setLoading] = useState(true);
  // Widgets pesados (Prazos, Exames, Processos) só montam depois da parte estática.
  const [mountHeavy, setMountHeavy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Safety: nunca deixar o spinner principal eterno.
    const safety = setTimeout(() => {
      if (!cancelled) {
        console.warn("[QADashboard] safety timeout 5s — liberando UI");
        setLoading(false);
      }
    }, 5000);

    // ============================================================
    // ONDA 1 — CRÍTICA (4 queries) — libera a tela imediatamente
    // ============================================================
    const loadCritical = async () => {
      const t0 = performance.now();
      const results = await Promise.allSettled([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_cadastro_publico" as any).select("id, nome_completo, cpf, telefone_principal, email, end1_cidade, end1_estado, servico_interesse, status, pago, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(8),
        supabase.from("qa_geracoes_pecas" as any).select("id, titulo_geracao, tipo_peca, created_at, status_revisao").order("created_at", { ascending: false }).limit(6),
      ]);
      if (cancelled) return;
      const pick = <T,>(idx: number): T | null => {
        const r = results[idx];
        return r.status === "fulfilled" ? (r.value as T) : null;
      };
      const d = pick<any>(0), p = pick<any>(1), cad = pick<any>(2), rPecas = pick<any>(3);
      setStats((s) => ({
        ...s,
        documentos: d?.count ?? 0,
        pecas: p?.count ?? 0,
        novosCadastros: cad?.count ?? 0,
      }));
      setNovosCadastros((cad?.data as any[]) ?? []);
      setRecentPecas(((rPecas?.data as any[]) ?? []).map((r: any) => ({
        id: r.id, titulo: r.titulo_geracao || "Sem título",
        tipo: r.tipo_peca, created_at: r.created_at, status: r.status_revisao,
      })));
      clearTimeout(safety);
      setLoading(false);
      console.info(`[QADashboard] CRÍTICA (4 queries) ready in ${Math.round(performance.now() - t0)}ms`);
    };

    // ONDA 2 — SECUNDÁRIA (KPIs auxiliares)
    const loadSecondary = async () => {
      if (cancelled) return;
      const t0 = performance.now();
      const results = await Promise.allSettled([
        supabase.from("qa_fontes_normativas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_jurisprudencias" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("status_validacao", "nao_validado").eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).in("status_processamento", ["erro", "texto_invalido"]).eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_consultas_ia" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "aprovado"),
        supabase.from("qa_referencias_preferenciais" as any).select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "rascunho"),
        supabase.from("qa_documentos_conhecimento" as any).select("id, titulo, tipo_documento, created_at, status_processamento").eq("ativo", true).eq("papel_documento", "aprendizado").order("created_at", { ascending: false }).limit(6),
      ]);
      if (cancelled) return;
      const pick = <T,>(idx: number): T | null => {
        const r = results[idx];
        return r.status === "fulfilled" ? (r.value as T) : null;
      };
      setStats((s) => ({
        ...s,
        normas: pick<any>(0)?.count ?? 0,
        jurisprudencias: pick<any>(1)?.count ?? 0,
        pendentes: pick<any>(2)?.count ?? 0,
        erros: pick<any>(3)?.count ?? 0,
        consultas: pick<any>(4)?.count ?? 0,
        aprovadas: pick<any>(5)?.count ?? 0,
        referencias: pick<any>(6)?.count ?? 0,
        rascunhos: pick<any>(7)?.count ?? 0,
      }));
      const rDocs = pick<any>(8);
      setRecentDocs(((rDocs?.data as any[]) ?? []).map((r: any) => ({
        id: r.id, titulo: r.titulo || "Sem título",
        tipo: r.tipo_documento, created_at: r.created_at, status: r.status_processamento,
      })));
      console.info(`[QADashboard] SECUNDÁRIA (9 queries) ready in ${Math.round(performance.now() - t0)}ms`);
    };

    // ONDA 3 — PESADA (gráficos)
    const loadCharts = async () => {
      if (cancelled) return;
      try {
        const { data: allCadastros } = await supabase
          .from("qa_cadastro_publico" as any)
          .select("created_at, servico_interesse")
          .order("created_at", { ascending: true })
          .limit(2000);
        if (cancelled || !allCadastros?.length) return;

        const dayMap: Record<string, number> = {};
        const monthMap: Record<string, number> = {};
        const servicoMap: Record<string, number> = {};
        const now = new Date();
        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

        (allCadastros as any[]).forEach((c: any) => {
          const d = new Date(c.created_at);
          const dayKey = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          const monthKey = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
          if (d >= fourteenDaysAgo) dayMap[dayKey] = (dayMap[dayKey] || 0) + 1;
          monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
          const serv = c.servico_interesse || "Não informado";
          servicoMap[serv] = (servicoMap[serv] || 0) + 1;
        });

        const dayData: DayCount[] = [];
        for (let i = 0; i < 14; i++) {
          const dt = new Date(fourteenDaysAgo);
          dt.setDate(dt.getDate() + i);
          const key = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          dayData.push({ day: key, total: dayMap[key] || 0 });
        }
        setCadastrosPorDia(dayData);
        setCadastrosPorMes(Object.entries(monthMap).map(([month, total]) => ({ month, total })));
        setServicosDistrib(Object.entries(servicoMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
      } catch (err) {
        console.warn("[QADashboard] gráficos falharam (não bloqueante):", err);
      }
    };

    // Estabilidade > esperteza: setTimeout simples e previsível.
    // Onda 2 entra logo após a crítica; Onda 3 (gráficos, fora da primeira dobra) fica mais tarde.
    loadCritical()
      .catch((err) => {
        console.error("[QADashboard] crítica falhou:", err);
        if (!cancelled) { clearTimeout(safety); setLoading(false); }
      })
      .finally(() => {
        setTimeout(() => { if (!cancelled) void loadSecondary(); }, 250);
        setTimeout(() => { if (!cancelled) void loadCharts(); }, 800);
      });

    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, []);

  // Após a parte estática estar pronta (loading=false), liberamos os widgets pesados
  // em um segundo "tick" para que o navegador pinte primeiro o layout/KPIs.
  useEffect(() => {
    if (loading || mountHeavy) return;
    const t = setTimeout(() => setMountHeavy(true), 120);
    return () => clearTimeout(t);
  }, [loading, mountHeavy]);

  // Generate chart data from real stats
  const acervoData = useMemo(() => [
    { name: "Docs", value: stats.documentos, fill: COLORS.blue },
    { name: "Normas", value: stats.normas, fill: COLORS.purple },
    { name: "Jurisp.", value: stats.jurisprudencias, fill: COLORS.cyan },
    { name: "Refs.", value: stats.referencias, fill: COLORS.green },
  ], [stats]);

  const pieData = useMemo(() => [
    { name: "Aprovadas", value: stats.aprovadas },
    { name: "Rascunhos", value: stats.rascunhos },
    { name: "Pendentes", value: stats.pendentes },
    { name: "Erros", value: stats.erros },
  ].filter(d => d.value > 0), [stats]);

  // Simulated weekly trend (sparkline)
  const weekTrend = useMemo(() => {
    const base = stats.pecas;
    return ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d, i) => ({
      day: d,
      pecas: Math.max(0, Math.round(base * (0.08 + Math.random() * 0.18))),
      docs: Math.max(0, Math.round(stats.documentos * (0.06 + Math.random() * 0.14))),
    }));
  }, [stats]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const alerts = [
    stats.erros > 0 && { label: `${stats.erros} documento(s) com erro de processamento`, icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-100", link: "/base-conhecimento" },
    stats.pendentes > 0 && { label: `${stats.pendentes} documento(s) pendente(s) de validação`, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 border-amber-100", link: "/base-conhecimento" },
    stats.rascunhos > 0 && { label: `${stats.rascunhos} peça(s) em rascunho aguardando revisão`, icon: Clock, color: "text-blue-500", bg: "bg-blue-50 border-blue-100", link: "/historico" },
  ].filter(Boolean) as any[];

  const statusBadge = (s: string) => {
    if (s === "concluido" || s === "aprovado" || s === "aprovado_como_referencia")
      return { bg: "bg-emerald-50 text-emerald-700", label: s.replace(/_/g, " ") };
    if (s === "erro" || s === "texto_invalido" || s === "rejeitado")
      return { bg: "bg-red-50 text-red-600", label: s.replace(/_/g, " ") };
    return { bg: "bg-slate-100 text-slate-500", label: (s || "—").replace(/_/g, " ") };
  };

  const totalAcervo = stats.documentos + stats.normas + stats.jurisprudencias;

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            Visão geral do sistema jurídico
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/gerar-peca"
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold rounded-md transition-all hover:opacity-90 shadow-sm no-glow"
            style={{ background: "hsl(230 80% 56%)", color: "#ffffff" }}>
            <PenTool className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nova Peça</span>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Link key={i} to={a.link}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${a.bg} hover:shadow-sm transition-all group`}>
              <a.icon className={`h-4 w-4 ${a.color} shrink-0`} />
              <span className="text-[13px] text-slate-700 flex-1 font-medium">{a.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ))}
        </div>
      )}

      {/* Widgets pesados — só montam DEPOIS que a parte estática foi pintada (mountHeavy) */}
      {mountHeavy && (
        <>
          <Suspense fallback={<div className="qa-card p-6 flex justify-center"><div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>}>
            <DashboardPrazosRecursais />
          </Suspense>

          <Suspense fallback={<div className="qa-card p-6 flex justify-center"><div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>}>
            <DashboardExames />
          </Suspense>

          <Suspense fallback={<div className="qa-card p-6 flex justify-center"><div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>}>
            <DashboardProcessosMonitor />
          </Suspense>
        </>
      )}

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <KPICard icon={Users} label="Novos Cadastros" value={stats.novosCadastros} trend={stats.novosCadastros > 0 ? "novo" : "—"} positive={stats.novosCadastros > 0} />
        <KPICard icon={FileText} label="Acervo Jurídico" value={totalAcervo} trend={totalAcervo > 0 ? `${totalAcervo}` : "—"} positive={totalAcervo > 0} />
        <KPICard icon={PenTool} label="Peças Geradas" value={stats.pecas} trend={stats.pecas > 0 ? `${stats.pecas}` : "—"} positive={stats.pecas > 0} />
        <KPICard icon={CheckCircle} label="Aprovadas" value={stats.aprovadas} trend={stats.aprovadas > 0 ? `${stats.aprovadas}` : "—"} positive={stats.aprovadas > 0} />
        <KPICard icon={Shield} label="Consultas IA" value={stats.consultas} trend={stats.consultas > 0 ? `${stats.consultas}` : "—"} positive={stats.consultas > 0} />
      </div>

      {/* Novos Cadastros Públicos */}
      {novosCadastros.length > 0 && (
        <div className="qa-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Cadastros Recentes</h3>
              <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Clientes que preencheram o formulário público</p>
            </div>
            <Link to="/clientes" className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "hsl(230 80% 56%)" }}>
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {novosCadastros.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm"
                style={{ borderColor: "hsl(220 13% 91%)", background: "hsl(0 0% 100%)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(230 80% 96%)" }}>
                  <Users className="h-3.5 w-3.5" style={{ color: "hsl(230 80% 56%)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
                    <span>{c.end1_cidade}/{c.end1_estado}</span>
                    {c.servico_interesse && <><span>•</span><span>{c.servico_interesse}</span></>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    c.status === "pendente" ? "bg-amber-50 text-amber-600" :
                    c.status === "aprovado" ? "bg-emerald-50 text-emerald-600" :
                    "bg-slate-100 text-slate-500"
                  }`}>{c.status}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                    c.pago
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
                  }`}>{c.pago ? "PAGO" : "NÃO PAGO"}</span>
                  <span className="text-[10px]" style={{ color: "hsl(220 10% 62%)" }}>
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Clientes Novos por Dia ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="qa-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Clientes Novos por Dia</h3>
              <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Últimos 14 dias</p>
            </div>
          </div>
          <div className="h-52">
            {cadastrosPorDia.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cadastrosPorDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(220 10% 62%)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Cadastros" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">Sem dados</div>
            )}
          </div>
        </div>

        <div className="qa-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Clientes Novos por Mês</h3>
              <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Evolução mensal</p>
            </div>
          </div>
          <div className="h-52">
            {cadastrosPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cadastrosPorMes} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCadastrosMes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" name="Cadastros" stroke={COLORS.green} fill="url(#gradCadastrosMes)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">Sem dados</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Ticket Médio (Distribuição por Serviço) ── */}
      <div className="qa-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Comparativo por Serviço de Interesse</h3>
            <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Distribuição dos cadastros por tipo de serviço</p>
          </div>
        </div>
        <div className="h-56">
          {servicosDistrib.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={servicosDistrib} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }} width={140} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Cadastros" radius={[0, 4, 4, 0]}>
                  {servicosDistrib.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-400">Sem dados</div>
          )}
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart - Activity */}
        <div className="lg:col-span-2 qa-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Atividade Semanal</h3>
              <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Peças e documentos processados</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS.blue }} />
                <span className="text-[11px]" style={{ color: "hsl(220 10% 46%)" }}>Peças</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS.purple }} />
                <span className="text-[11px]" style={{ color: "hsl(220 10% 46%)" }}>Docs</span>
              </div>
            </div>
          </div>
          <div className="h-52 md:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="pecas" name="Peças" stroke={COLORS.blue} fill="url(#gradBlue)" strokeWidth={2} />
                <Area type="monotone" dataKey="docs" name="Docs" stroke={COLORS.purple} fill="url(#gradPurple)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart - Distribution */}
        <div className="qa-card p-5">
          <h3 className="text-sm font-semibold mb-1" style={{ color: "hsl(220 20% 18%)" }}>Status das Peças</h3>
          <p className="text-xs mb-4" style={{ color: "hsl(220 10% 62%)" }}>Distribuição por status</p>
          <div className="h-44 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-slate-400">Sem dados</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-[11px]" style={{ color: "hsl(220 10% 46%)" }}>{d.name}</span>
                <span className="text-[11px] font-semibold" style={{ color: "hsl(220 20% 25%)" }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Bar + Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart - Acervo */}
        <div className="qa-card p-5">
          <h3 className="text-sm font-semibold mb-1" style={{ color: "hsl(220 20% 18%)" }}>Acervo Jurídico</h3>
          <p className="text-xs mb-4" style={{ color: "hsl(220 10% 62%)" }}>Distribuição por tipo</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={acervoData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Total" radius={[6, 6, 0, 0]}>
                  {acervoData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mini metric cards */}
        <div className="grid grid-cols-2 gap-3 content-start">
          <MiniMetricCard icon={BookOpen} label="Documentos" value={stats.documentos} color={COLORS.blue} />
          <MiniMetricCard icon={Scale} label="Normas" value={stats.normas} color={COLORS.purple} />
          <MiniMetricCard icon={Gavel} label="Jurisprudências" value={stats.jurisprudencias} color={COLORS.cyan} />
          <MiniMetricCard icon={Activity} label="Referências" value={stats.referencias} color={COLORS.green} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentList
          title="Últimas Peças"
          subtitle="Peças jurídicas recentes"
          items={recentPecas}
          linkTo="/historico"
          icon={PenTool}
          statusBadge={statusBadge}
        />
        <RecentList
          title="Últimos Documentos"
          subtitle="Documentos processados"
          items={recentDocs}
          linkTo="/base-conhecimento"
          icon={FileText}
          statusBadge={statusBadge}
          isDoc
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction icon={PenTool} label="Gerar Peça" desc="Nova petição" to="/gerar-peca" color={COLORS.blue} />
        <QuickAction icon={BookOpen} label="Base Jurídica" desc="Consultar acervo" to="/base-conhecimento" color={COLORS.purple} />
        <QuickAction icon={Shield} label="Assistente IA" desc="Consulta inteligente" to="/ia" color={COLORS.cyan} />
        <QuickAction icon={BarChart3} label="Relatórios" desc="Visão analítica" to="/relatorios" color={COLORS.green} />
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function KPICard({ icon: Icon, label, value, trend, positive }: {
  icon: any; label: string; value: number; trend: string; positive: boolean;
}) {
  return (
    <div className="qa-card qa-hover-lift p-4 md:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "hsl(230 80% 96%)" }}>
          <Icon className="h-4.5 w-4.5" style={{ color: "hsl(230 80% 56%)" }} />
        </div>
        {trend !== "—" ? (
          <div className={`flex items-center gap-0.5 text-[11px] font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend}
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </div>
      <div className="qa-kpi text-2xl md:text-3xl mb-1" style={{ color: "hsl(220 20% 14%)" }}>
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-xs font-medium" style={{ color: "hsl(220 10% 55%)" }}>{label}</div>
    </div>
  );
}

function MiniMetricCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: string;
}) {
  return (
    <div className="qa-card qa-hover-lift p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: color + "14" }}>
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
        <div>
          <div className="qa-kpi text-xl" style={{ color: "hsl(220 20% 14%)" }}>{value.toLocaleString("pt-BR")}</div>
          <div className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function RecentList({ title, subtitle, items, linkTo, icon: Icon, statusBadge, isDoc }: {
  title: string; subtitle: string; items: RecentItem[]; linkTo: string;
  icon: any; statusBadge: (s: string) => { bg: string; label: string }; isDoc?: boolean;
}) {
  return (
    <div className="qa-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>{title}</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>{subtitle}</p>
        </div>
        <Link to={linkTo} className="text-xs font-medium flex items-center gap-1 transition-colors"
          style={{ color: "hsl(230 80% 56%)" }}>
          Ver tudo <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-center py-8" style={{ color: "hsl(220 10% 62%)" }}>Nenhum registro</div>
      ) : (
        <div className="space-y-1">
          {items.map(item => {
            const badge = statusBadge(item.status || "");
            const content = (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer">
                <Icon className="h-4 w-4 shrink-0" style={{ color: "hsl(220 10% 72%)" }} />
                <span className="text-[13px] truncate flex-1 min-w-0 font-medium" style={{ color: "hsl(220 20% 25%)" }}>
                  {item.titulo}
                </span>
                <span className={`qa-badge ${badge.bg} capitalize shrink-0`}>{badge.label}</span>
                <span className="text-[11px] font-mono shrink-0 hidden sm:block" style={{ color: "hsl(220 10% 72%)" }}>
                  {new Date(item.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            );
            return isDoc ? (
              <Link key={item.id} to={`/base-conhecimento/${item.id}`}>{content}</Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, label, desc, to, color }: {
  icon: any; label: string; desc: string; to: string; color: string;
}) {
  return (
    <Link to={to} className="qa-card qa-hover-lift p-4 group">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ background: color + "14" }}>
        <Icon className="h-5 w-5 transition-transform group-hover:scale-110" style={{ color }} />
      </div>
      <div className="text-sm font-semibold mb-0.5" style={{ color: "hsl(220 20% 18%)" }}>{label}</div>
      <div className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>{desc}</div>
    </Link>
  );
}
