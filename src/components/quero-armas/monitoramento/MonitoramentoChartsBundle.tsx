import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpRight, FileText, PenTool } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { MonitoramentoBlocoKey } from "./blocosCatalogo";

/**
 * Renderiza, sob demanda, os gráficos analíticos que vivem dentro de
 * /operacao/monitoramento. Recebe `enabled` para evitar carregar queries
 * de gráficos desativados.
 *
 * As queries são idênticas às que existiam em QADashboardPage para
 * manter compatibilidade total dos dados.
 */

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

interface DayCount { day: string; total: number }
interface MonthCount { month: string; total: number }
interface ServicoCount { name: string; value: number }
interface RecentItem { id: string; titulo: string; tipo: string; created_at: string; status?: string }

interface Props {
  enabled: Record<MonitoramentoBlocoKey, boolean>;
}

export default function MonitoramentoChartsBundle({ enabled }: Props) {
  const [cadastrosPorDia, setCadastrosPorDia] = useState<DayCount[]>([]);
  const [cadastrosPorMes, setCadastrosPorMes] = useState<MonthCount[]>([]);
  const [servicosDistrib, setServicosDistrib] = useState<ServicoCount[]>([]);
  const [weekActivity, setWeekActivity] = useState<{ day: string; pecas: number; docs: number }[]>([]);
  const [weekActivityLoaded, setWeekActivityLoaded] = useState(false);
  const [recentPecas, setRecentPecas] = useState<RecentItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<RecentItem[]>([]);
  const [acervo, setAcervo] = useState({ documentos: 0, normas: 0, jurisprudencias: 0, referencias: 0 });
  const [pecasStatus, setPecasStatus] = useState({ aprovadas: 0, rascunhos: 0, pendentes: 0, erros: 0 });

  // Decide quais consultas precisam rodar (otimização: nada de query desnecessária).
  const needCadastrosTimeline = enabled.clientes_novos_dia || enabled.clientes_novos_mes || enabled.comparativo_servicos;
  const needWeekActivity      = enabled.atividade_semanal;
  const needRecentPecas       = enabled.ultimas_pecas;
  const needRecentDocs        = enabled.ultimos_documentos;
  const needAcervo            = enabled.acervo_juridico;
  const needPecasStatus       = enabled.status_pecas;

  useEffect(() => {
    let cancelled = false;

    const loadCadastros = async () => {
      if (!needCadastrosTimeline) return;
      try {
        const { data: rows } = await supabase
          .from("qa_cadastro_publico" as any)
          .select("created_at, servico_interesse")
          .order("created_at", { ascending: true })
          .limit(2000);
        if (cancelled || !rows?.length) return;

        const dayMap: Record<string, number> = {};
        const monthMap: Record<string, number> = {};
        const servicoMap: Record<string, number> = {};
        const now = new Date();
        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

        (rows as any[]).forEach((c: any) => {
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
        if (cancelled) return;
        setCadastrosPorDia(dayData);
        setCadastrosPorMes(Object.entries(monthMap).map(([month, total]) => ({ month, total })));
        setServicosDistrib(
          Object.entries(servicoMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
        );
      } catch (err) {
        console.warn("[Monitoramento] cadastros falharam:", err);
      }
    };

    const loadWeekActivity = async () => {
      if (!needWeekActivity) return;
      try {
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const since = sevenDaysAgo.toISOString();

        const [pecasRes, docsRes] = await Promise.allSettled([
          supabase.from("qa_geracoes_pecas" as any).select("created_at").gte("created_at", since).limit(1000),
          supabase.from("qa_documentos_conhecimento" as any).select("created_at").eq("ativo", true).gte("created_at", since).limit(1000),
        ]);
        if (cancelled) return;

        const pecasRows = pecasRes.status === "fulfilled" ? ((pecasRes.value as any).data as any[] || []) : [];
        const docsRows = docsRes.status === "fulfilled" ? ((docsRes.value as any).data as any[] || []) : [];

        const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const buckets: { date: Date; key: string; day: string; pecas: number; docs: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const dt = new Date(now);
          dt.setHours(0, 0, 0, 0);
          dt.setDate(dt.getDate() - i);
          buckets.push({ date: dt, key: dt.toISOString().slice(0, 10), day: labels[dt.getDay()], pecas: 0, docs: 0 });
        }
        const byKey = new Map(buckets.map(b => [b.key, b]));
        pecasRows.forEach((r: any) => { const b = byKey.get(new Date(r.created_at).toISOString().slice(0, 10)); if (b) b.pecas += 1; });
        docsRows.forEach((r: any) => { const b = byKey.get(new Date(r.created_at).toISOString().slice(0, 10)); if (b) b.docs += 1; });

        setWeekActivity(buckets.map(b => ({ day: b.day, pecas: b.pecas, docs: b.docs })));
        setWeekActivityLoaded(true);
      } catch (err) {
        console.warn("[Monitoramento] atividade semanal falhou:", err);
        setWeekActivityLoaded(true);
      }
    };

    const loadRecents = async () => {
      const promises: Promise<any>[] = [];
      if (needRecentPecas) {
        promises.push(Promise.resolve(
          supabase.from("qa_geracoes_pecas" as any)
            .select("id, titulo_geracao, tipo_peca, created_at, status_revisao")
            .order("created_at", { ascending: false }).limit(6),
        ));
      } else promises.push(Promise.resolve({ data: [] }));
      if (needRecentDocs) {
        promises.push(Promise.resolve(
          supabase.from("qa_documentos_conhecimento" as any)
            .select("id, titulo, tipo_documento, created_at, status_processamento")
            .eq("ativo", true).eq("papel_documento", "aprendizado")
            .order("created_at", { ascending: false }).limit(6),
        ));
      } else promises.push(Promise.resolve({ data: [] }));

      const [pRes, dRes] = await Promise.allSettled(promises);
      if (cancelled) return;
      if (pRes.status === "fulfilled") {
        setRecentPecas((((pRes.value as any).data as any[]) ?? []).map((r: any) => ({
          id: r.id, titulo: r.titulo_geracao || "Sem título", tipo: r.tipo_peca, created_at: r.created_at, status: r.status_revisao,
        })));
      }
      if (dRes.status === "fulfilled") {
        setRecentDocs((((dRes.value as any).data as any[]) ?? []).map((r: any) => ({
          id: r.id, titulo: r.titulo || "Sem título", tipo: r.tipo_documento, created_at: r.created_at, status: r.status_processamento,
        })));
      }
    };

    const loadAcervo = async () => {
      if (!needAcervo) return;
      const r = await Promise.allSettled([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_fontes_normativas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_jurisprudencias" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_referencias_preferenciais" as any).select("id", { count: "exact", head: true }).eq("ativo", true),
      ]);
      if (cancelled) return;
      const pick = (i: number) => r[i].status === "fulfilled" ? ((r[i] as any).value?.count ?? 0) : 0;
      setAcervo({ documentos: pick(0), normas: pick(1), jurisprudencias: pick(2), referencias: pick(3) });
    };

    const loadPecasStatus = async () => {
      if (!needPecasStatus) return;
      const r = await Promise.allSettled([
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "aprovado"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "rascunho"),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("status_validacao", "nao_validado").eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).in("status_processamento", ["erro", "texto_invalido"]).eq("ativo", true).eq("papel_documento", "aprendizado"),
      ]);
      if (cancelled) return;
      const pick = (i: number) => r[i].status === "fulfilled" ? ((r[i] as any).value?.count ?? 0) : 0;
      setPecasStatus({ aprovadas: pick(0), rascunhos: pick(1), pendentes: pick(2), erros: pick(3) });
    };

    void loadCadastros();
    void loadWeekActivity();
    void loadRecents();
    void loadAcervo();
    void loadPecasStatus();

    return () => { cancelled = true; };
  }, [needCadastrosTimeline, needWeekActivity, needRecentPecas, needRecentDocs, needAcervo, needPecasStatus]);

  const acervoData = useMemo(() => [
    { name: "Docs", value: acervo.documentos, fill: COLORS.blue },
    { name: "Normas", value: acervo.normas, fill: COLORS.purple },
    { name: "Jurisp.", value: acervo.jurisprudencias, fill: COLORS.cyan },
    { name: "Refs.", value: acervo.referencias, fill: COLORS.green },
  ], [acervo]);

  const pieData = useMemo(() => [
    { name: "Aprovadas", value: pecasStatus.aprovadas },
    { name: "Rascunhos", value: pecasStatus.rascunhos },
    { name: "Pendentes", value: pecasStatus.pendentes },
    { name: "Erros",     value: pecasStatus.erros },
  ].filter(d => d.value > 0), [pecasStatus]);

  const hasWeekActivity = weekActivity.some(d => d.pecas > 0 || d.docs > 0);

  const statusBadge = (s: string) => {
    if (s === "concluido" || s === "aprovado" || s === "aprovado_como_referencia")
      return { bg: "bg-emerald-50 text-emerald-700", label: s.replace(/_/g, " ") };
    if (s === "erro" || s === "texto_invalido" || s === "rejeitado")
      return { bg: "bg-red-50 text-red-600", label: s.replace(/_/g, " ") };
    return { bg: "bg-slate-100 text-slate-500", label: (s || "—").replace(/_/g, " ") };
  };

  return (
    <>
      {/* ── Linha 2 — Crescimento (gráficos por dia/mês) ── */}
      {(enabled.clientes_novos_dia || enabled.clientes_novos_mes) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {enabled.clientes_novos_dia && (
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
          )}

          {enabled.clientes_novos_mes && (
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
                        <linearGradient id="gradMonitMes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="total" name="Cadastros" stroke={COLORS.green} fill="url(#gradMonitMes)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400">Sem dados</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Linha 4 (1) — Comparativo por Serviço ── */}
      {enabled.comparativo_servicos && (
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
      )}

      {/* ── Linha 1 (parte) — Atividade semanal + Status das peças ── */}
      {(enabled.atividade_semanal || enabled.status_pecas) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {enabled.atividade_semanal && (
            <div className={enabled.status_pecas ? "lg:col-span-2 qa-card p-5" : "lg:col-span-3 qa-card p-5"}>
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
                {hasWeekActivity ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weekActivity} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradMonitBlue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradMonitPurple" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.12} />
                          <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 62%)" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="pecas" name="Peças" stroke={COLORS.blue} fill="url(#gradMonitBlue)" strokeWidth={2} />
                      <Area type="monotone" dataKey="docs" name="Docs" stroke={COLORS.purple} fill="url(#gradMonitPurple)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400">
                    {weekActivityLoaded ? "Sem dados suficientes nos últimos 7 dias" : "Carregando..."}
                  </div>
                )}
              </div>
            </div>
          )}

          {enabled.status_pecas && (
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
          )}
        </div>
      )}

      {/* ── Linha 3 — Acervo jurídico (gráfico de barras) ── */}
      {enabled.acervo_juridico && (
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
      )}

      {/* ── Linha 3/4 — Listas Últimas Peças / Últimos Documentos ── */}
      {(enabled.ultimas_pecas || enabled.ultimos_documentos) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {enabled.ultimas_pecas && (
            <RecentList
              title="Últimas Peças" subtitle="Peças jurídicas recentes"
              items={recentPecas} linkTo="/historico" icon={PenTool} statusBadge={statusBadge}
            />
          )}
          {enabled.ultimos_documentos && (
            <RecentList
              title="Últimos Documentos" subtitle="Documentos processados"
              items={recentDocs} linkTo="/base-conhecimento" icon={FileText} statusBadge={statusBadge} isDoc
            />
          )}
        </div>
      )}
    </>
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
        <Link to={linkTo} className="text-xs font-medium flex items-center gap-1 transition-colors" style={{ color: "hsl(230 80% 56%)" }}>
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
                <span className="text-[13px] truncate flex-1 min-w-0 font-medium" style={{ color: "hsl(220 20% 25%)" }}>{item.titulo}</span>
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