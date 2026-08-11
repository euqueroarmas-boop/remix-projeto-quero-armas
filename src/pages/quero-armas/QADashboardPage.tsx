import { Suspense } from "react";
import { Link } from "react-router-dom";
import { lazyRetry } from "@/lib/lazyRetry";

/**
 * Dashboard Principal — enxuta.
 * Foco: prazos críticos, progresso por cliente e monitor de acessos.
 */

const DashboardPrazosRecursais   = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardPrazosRecursais"), "DashboardPrazosRecursais");
const DashboardClientesOnline    = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardClientesOnline"), "DashboardClientesOnline");
const DashboardProgressoClientes = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardProgressoClientes"), "DashboardProgressoClientes");
function Spinner() {
  return (
    <div className="qa-card p-6 flex justify-center">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-[#7A1F2B] rounded-full animate-spin" />
    </div>
  );
}

export default function QADashboardPage() {
  return (
    <div className="space-y-5 md:space-y-6 w-full max-w-[1760px] ml-0 mr-auto">
      {/* Progresso por cliente — primeiro bloco do painel */}
      <Suspense fallback={<Spinner />}>
        <DashboardProgressoClientes />
      </Suspense>

      {/* Prazos processuais 10 dias */}
      <Suspense fallback={<Spinner />}>
        <DashboardPrazosRecursais />
      </Suspense>

      {/* Clientes logados agora na área do cliente */}
      <Suspense fallback={<Spinner />}>
        <DashboardClientesOnline />
      </Suspense>

      <p className="text-[11px] text-center" style={{ color: "hsl(220 10% 62%)" }}>
        Os demais motores foram movidos para{" "}
        <Link to="/configuracoes" className="font-semibold hover:underline" style={{ color: "hsl(352 60% 30%)" }}>
          Configurações → Apagar
        </Link>
      </p>
    </div>
  );
}
