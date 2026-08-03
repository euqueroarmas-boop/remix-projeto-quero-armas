import { useEffect, useState, Suspense } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lazyRetry } from "@/lib/lazyRetry";
import {
  AlertTriangle, CheckCircle, Clock, XCircle, PenTool,
  ArrowRight, FileText, Shield, Users,
} from "lucide-react";

/**
 * Motores apagados da Dashboard.
 * A Dashboard principal exibe apenas Prazos Processuais e Pronto para Protocolar.
 * Todos os demais motores foram movidos para cá (Configurações → Apagar).
 */

const DashboardExames                  = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardExames"), "DashboardExames");
const DashboardProcessosMonitor        = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardProcessosMonitor"), "DashboardProcessosMonitor");
const DashboardSlaClientesNovos        = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardSlaClientesNovos"), "DashboardSlaClientesNovos");
const DashboardNovosCadastrosRecebidos = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardNovosCadastrosRecebidos"), "DashboardNovosCadastrosRecebidos");

interface Stats {
  documentos: number; pecas: number; pendentes: number; erros: number;
  consultas: number; aprovadas: number; rascunhos: number; novosCadastros: number;
}

function Spinner() {
  return (
    <div className="qa-card p-6 flex justify-center">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-[#7A1F2B] rounded-full animate-spin" />
    </div>
  );
}

function KPICard({ icon: Icon, label, value, to }: { icon: any; label: string; value: number; to?: string }) {
  const content = (
    <div className="qa-card qa-hover-lift p-4 md:p-5 cursor-pointer h-full pointer-events-none">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "hsl(352 33% 97%)" }}>
          <Icon className="h-[18px] w-[18px]" style={{ color: "hsl(352 60% 30%)" }} />
        </div>
      </div>
      <div className="qa-kpi text-2xl md:text-3xl mb-1" style={{ color: "hsl(220 20% 14%)" }}>
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-xs font-medium" style={{ color: "hsl(220 10% 55%)" }}>{label}</div>
    </div>
  );
  return to ? <Link to={to} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1F2B] rounded-xl">{content}</Link> : content;
}

export default function MotoresApagadosAdmin() {
  const [stats, setStats] = useState<Stats>({
    documentos: 0, pecas: 0, pendentes: 0, erros: 0,
    consultas: 0, aprovadas: 0, rascunhos: 0, novosCadastros: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_cadastro_publico" as any).select("id", { count: "exact", head: true }).neq("status", "recusado").or("arquivado.is.null,arquivado.eq.false"),
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
    })();
    return () => { cancelled = true; };
  }, []);

  const alerts = [
    stats.erros > 0 && { label: `${stats.erros} documento(s) com erro de processamento`, icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-100", link: "/base-conhecimento" },
    stats.pendentes > 0 && { label: `${stats.pendentes} documento(s) pendente(s) de validação`, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 border-amber-100", link: "/base-conhecimento" },
    stats.rascunhos > 0 && { label: `${stats.rascunhos} peça(s) em rascunho aguardando revisão`, icon: Clock, color: "text-[#7A1F2B]", bg: "bg-[#FBF3F4] border-[#E5C2C6]", link: "/historico" },
  ].filter(Boolean) as any[];

  return (
    <div className="space-y-5">
      <div className="qa-card p-5">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 14% 32%)" }}>
          Motores apagados da Dashboard
        </span>
        <p className="text-[11.5px] mt-1" style={{ color: "hsl(220 12% 38%)" }}>
          A Dashboard exibe somente Prazos Processuais e Processos Prontos para Protocolar.
          Todos os demais motores continuam operando aqui.
        </p>
      </div>

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

      <Suspense fallback={<Spinner />}><DashboardNovosCadastrosRecebidos /></Suspense>
      <Suspense fallback={<Spinner />}><DashboardSlaClientesNovos /></Suspense>
      <Suspense fallback={<Spinner />}><DashboardExames /></Suspense>
      <Suspense fallback={<Spinner />}><DashboardProcessosMonitor /></Suspense>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <KPICard to="/clientes"          icon={Users}       label="Cadastros" value={stats.novosCadastros} />
        <KPICard to="/base-conhecimento" icon={FileText}    label="Acervo"    value={stats.documentos} />
        <KPICard to="/historico"         icon={PenTool}     label="Peças"     value={stats.pecas} />
        <KPICard to="/historico"         icon={CheckCircle} label="Aprovadas" value={stats.aprovadas} />
        <KPICard to="/ia"                icon={Shield}      label="IA"        value={stats.consultas} />
      </div>
    </div>
  );
}
