import { lazy, Suspense } from "react";
import { Activity } from "lucide-react";
import { LoadingState } from "@/components/quero-armas/LoadStates";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import { Navigate } from "react-router-dom";
import { useMonitoramentoConfig } from "@/components/quero-armas/monitoramento/useMonitoramentoConfig";
import MonitoramentoChartsBundle from "@/components/quero-armas/monitoramento/MonitoramentoChartsBundle";

const DashboardFunilOperacional        = lazy(() => import("@/components/quero-armas/dashboard/DashboardFunilOperacional"));
const TelemetriaCadastroCards          = lazy(() => import("@/components/quero-armas/dashboard/TelemetriaCadastroCards"));
const DashboardNovosCadastrosRecebidos = lazy(() => import("@/components/quero-armas/dashboard/DashboardNovosCadastrosRecebidos"));
const DashboardAtividadesRecentes      = lazy(() => import("@/components/quero-armas/dashboard/DashboardAtividadesRecentes"));

function Spinner() {
  return (
    <div className="qa-card p-6 flex justify-center">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export default function QAMonitoramentoPage() {
  const { profile, loading: authLoading } = useQAAuthContext();
  const { enabled, loading } = useMonitoramentoConfig();

  if (authLoading) return <LoadingState label="Carregando…" />;

  // Permissão: somente staff (qualquer perfil interno). Cliente comum é redirecionado.
  if (!profile || !profile.ativo) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) return <LoadingState label="Carregando monitoramento…" />;

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
            <Activity className="h-5 w-5" style={{ color: "hsl(230 80% 56%)" }} />
            Monitoramento
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            Indicadores operacionais, cadastros, documentos e produção jurídica
          </p>
        </div>
      </div>

      {/* Linha 1 — Visão operacional */}
      {enabled.funil_operacional && (
        <Suspense fallback={<Spinner />}><DashboardFunilOperacional /></Suspense>
      )}
      {enabled.qualidade_cadastro && (
        <Suspense fallback={<Spinner />}><TelemetriaCadastroCards /></Suspense>
      )}

      {/* Linha 2 — Crescimento de clientes (cadastro recente) */}
      {enabled.cadastro_recente && (
        <Suspense fallback={<Spinner />}><DashboardNovosCadastrosRecebidos /></Suspense>
      )}

      {/* Bundle dos demais gráficos analíticos (queries condicionais por toggle) */}
      <MonitoramentoChartsBundle enabled={enabled} />

      {/* Linha 4 — Atividades recentes */}
      {enabled.atividades_recentes && (
        <Suspense fallback={<Spinner />}><DashboardAtividadesRecentes /></Suspense>
      )}
    </div>
  );
}