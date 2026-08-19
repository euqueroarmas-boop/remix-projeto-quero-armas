import { Suspense } from "react";
import { Link } from "react-router-dom";
import { lazyRetry } from "@/lib/lazyRetry";

/**
 * Dashboard Principal — enxuta.
 * Foco: prazos críticos, progresso por cliente e monitor de acessos.
 */

const DashboardPrazosRecursais   = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardPrazosRecursais"), "DashboardPrazosRecursais");
const DashboardProgressoClientes = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardProgressoClientes"), "DashboardProgressoClientes");
function Spinner() {
  return (
    <div className="qa-card p-6 flex justify-center">
      <div className="w-5 h-5 border-2 border-[var(--qa-linha)] border-t-[var(--qa-tinta-2)] rounded-full animate-spin" />
    </div>
  );
}

export default function QADashboardPage() {
  return (
    <div
      /* Tela migrada para o tema real: a casca do conteúdo sai do filtro de
         inversão do modo noturno e a tela passa a desenhar nos tokens --qa-*
         (a mesma combinação do menu). Ver "PÁGINAS — tema real" em index.css. */
      data-qa-pagina
      className="space-y-5 md:space-y-6 w-full max-w-[1760px] ml-0 mr-auto"
    >
      {/* Progresso por cliente — primeiro bloco do painel */}
      <Suspense fallback={<Spinner />}>
        <DashboardProgressoClientes />
      </Suspense>

      {/* Prazos processuais 10 dias */}
      <Suspense fallback={<Spinner />}>
        <DashboardPrazosRecursais />
      </Suspense>

      <p className="text-[11px] text-center" style={{ color: "var(--qa-tinta-3)" }}>
        Os demais motores foram movidos para{" "}
        <Link to="/configuracoes" className="font-semibold hover:underline" style={{ color: "var(--qa-tinta)" }}>
          Configurações → Apagar
        </Link>
      </p>
    </div>
  );
}
