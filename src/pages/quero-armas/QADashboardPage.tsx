import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle, Clock, XCircle, PenTool,
  ArrowRight, FileText, Shield, Users,
} from "lucide-react";

import { LoadingState } from "@/components/quero-armas/LoadStates";

/**
 * Dashboard Principal — enxuta.
 * Foco: KPIs essenciais, alertas, prazos críticos, monitor operacional.
 * Gráficos analíticos e listas longas vivem em /operacao/monitoramento.
 */

const DashboardExames                = lazy(() => import("@/components/quero-armas/dashboard/DashboardExames"));
const DashboardProcessosMonitor      = lazy(() => import("@/components/quero-armas/dashboard/DashboardProcessosMonitor"));
const DashboardPrazosRecursais       = lazy(() => import("@/components/quero-armas/dashboard/DashboardPrazosRecursais"));
const DashboardSlaClientesNovos      = lazy(() => import("@/components/quero-armas/dashboard/DashboardSlaClientesNovos"));
const DashboardNovosCadastrosRecebidos = lazy(() => import("@/components/quero-armas/dashboard/DashboardNovosCadastrosRecebidos"));

interface Stats {
  documentos: number;
  pecas: number;
  pendentes: number;
  erros: number;
  consultas: number;
  aprovadas: number;
  rascunhos: number;
  novosCadastros: number;
}

function Spinner() {
  return (
    <div className="qa-card p-6 flex justify-center">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export default function QADashboardPage() {
  const [stats, setStats] = useState<Stats>({
    documentos: 0, pecas: 0, pendentes: 0, erros: 0,
    consultas: 0, aprovadas: 0, rascunhos: 0, novosCadastros: 0,
  });
  const [loading, setLoading] = useState(true);
  const [mountHeavy, setMountHeavy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const safety = setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);

    const loadCritical = async () => {
      const results = await Promise.allSettled([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_cadastro_publico" as any).select("id", { count: "exact", head: true }).neq("status", "recusado"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "aprovado"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "rascunho"),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("status_validacao", "nao_validado").eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).in("status_processamento", ["erro", "texto_invalido"]).eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_consultas_ia" as any).select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      const pick = (i: number): any => results[i].status === "fulfilled" ? (results[i] as any).value : null;
      setStats({
        documentos: pick(0)?.count ?? 0,
        pecas: pick(1)?.count ?? 0,
        novosCadastros: pick(2)?.count ?? 0,
        aprovadas: pick(3)?.count ?? 0,
        rascunhos: pick(4)?.count ?? 0,
        pendentes: pick(5)?.count ?? 0,
        erros: pick(6)?.count ?? 0,
        consultas: pick(7)?.count ?? 0,
      });
      clearTimeout(safety);
      setLoading(false);
    };

    loadCritical().catch(() => {
      if (!cancelled) { clearTimeout(safety); setLoading(false); }
    });

    return () => { cancelled = true; clearTimeout(safety); };
  }, []);

  useEffect(() => {
    if (loading || mountHeavy) return;
    const t = setTimeout(() => setMountHeavy(true), 120);
    return () => clearTimeout(t);
  }, [loading, mountHeavy]);

  if (loading) return <LoadingState label="Carregando dashboard…" />;

  const alerts = [
    stats.erros > 0 && { label: `${stats.erros} documento(s) com erro de processamento`, icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-100", link: "/base-conhecimento" },
    stats.pendentes > 0 && { label: `${stats.pendentes} documento(s) pendente(s) de validação`, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 border-amber-100", link: "/base-conhecimento" },
    stats.rascunhos > 0 && { label: `${stats.rascunhos} peça(s) em rascunho aguardando revisão`, icon: Clock, color: "text-blue-500", bg: "bg-blue-50 border-blue-100", link: "/historico" },
  ].filter(Boolean) as any[];

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

      {/* Novos cadastros recebidos (operacional, topo) */}
      {mountHeavy && (
        <Suspense fallback={<Spinner />}>
          <DashboardNovosCadastrosRecebidos />
        </Suspense>
      )}

      {/* Prazos processuais 10 dias */}
      {mountHeavy && (
        <Suspense fallback={<Spinner />}>
          <DashboardPrazosRecursais />
        </Suspense>
      )}

      {/* SLA novos clientes */}
      {mountHeavy && (
        <Suspense fallback={<Spinner />}>
          <DashboardSlaClientesNovos />
        </Suspense>
      )}

      {/* Monitor de exames */}
      {mountHeavy && (
        <Suspense fallback={<Spinner />}>
          <DashboardExames />
        </Suspense>
      )}

      {/* Monitor operacional de processos */}
      {mountHeavy && (
        <Suspense fallback={<Spinner />}>
          <DashboardProcessosMonitor />
        </Suspense>
      )}

      {/* KPIs essenciais (resumo) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <KPICard to="/clientes"           icon={Users}       label="Cadastros"  value={stats.novosCadastros} />
        <KPICard to="/base-conhecimento"  icon={FileText}    label="Acervo"     value={stats.documentos} />
        <KPICard to="/historico"          icon={PenTool}     label="Peças"      value={stats.pecas} />
        <KPICard to="/historico"          icon={CheckCircle} label="Aprovadas"  value={stats.aprovadas} />
        <KPICard to="/ia"                 icon={Shield}      label="IA"         value={stats.consultas} />
      </div>

      <p className="text-[11px] text-center" style={{ color: "hsl(220 10% 62%)" }}>
        Indicadores analíticos, listas e gráficos detalhados em{" "}
        <Link to="/operacao/monitoramento" className="font-semibold hover:underline" style={{ color: "hsl(230 80% 56%)" }}>
          Operação → Monitoramento
        </Link>
      </p>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, to }: {
  icon: any; label: string; value: number; to?: string;
}) {
  const content = (
    <div className="qa-card qa-hover-lift p-4 md:p-5 cursor-pointer h-full pointer-events-none">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "hsl(230 80% 96%)" }}>
          <Icon className="h-[18px] w-[18px]" style={{ color: "hsl(230 80% 56%)" }} />
        </div>
      </div>
      <div className="qa-kpi text-2xl md:text-3xl mb-1" style={{ color: "hsl(220 20% 14%)" }}>
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-xs font-medium" style={{ color: "hsl(220 10% 55%)" }}>{label}</div>
    </div>
  );
  return to ? <Link to={to} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">{content}</Link> : content;
}
