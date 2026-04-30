import { QASidebar } from "./QASidebar";
import { Outlet, Navigate } from "react-router-dom";
import { QAAuthProvider, useQAAuthContext } from "./QAAuthContext";
import { QABreadcrumb } from "./QABreadcrumb";
import { QAFooter } from "./QAFooter";
import { lazy, Suspense } from "react";

const PendenciasEssenciaisModal = lazy(() => import("./PendenciasEssenciaisModal"));

function QALayoutInner() {
  const { user, profile, loading, signOut } = useQAAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220 20% 97%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 tracking-wider">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen w-full grid grid-cols-[auto_minmax(0,1fr)] items-stretch overflow-x-hidden" style={{ background: "hsl(220 20% 97%)" }}>
      <QASidebar perfil={profile.perfil} nome={profile.nome} signOut={signOut} />
      <main className="min-w-0 min-h-screen flex flex-col" style={{ background: "hsl(220 20% 97%)" }}>
        <QABreadcrumb />
        <div className="flex-1 p-3 md:p-6 lg:p-8">
          <Outlet />
        </div>
        <QAFooter />
      </main>
      {/* Painel automático de pendências essenciais (somente perfis internos). */}
      {profile.perfil !== "cliente" && (
        <Suspense fallback={null}>
          <PendenciasEssenciaisModal />
        </Suspense>
      )}
    </div>
  );
}

export default function QALayout() {
  return (
    <QAAuthProvider>
      <QALayoutInner />
    </QAAuthProvider>
  );
}
