import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QASidebar } from "./QASidebar";
import { Outlet, Navigate } from "react-router-dom";
import { QAAuthProvider, useQAAuthContext } from "./QAAuthContext";
import { PanelLeftOpen } from "lucide-react";
import { QABreadcrumb } from "./QABreadcrumb";
import { QAFooter } from "./QAFooter";

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
    return <Navigate to="/quero-armas/login" replace />;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <QASidebar perfil={profile.perfil} nome={profile.nome} signOut={signOut} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b md:hidden" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
            <SidebarTrigger className="ml-3">
              <PanelLeftOpen className="h-5 w-5" style={{ color: "hsl(220 10% 40%)" }} />
            </SidebarTrigger>
          </header>
          <main className="flex-1 overflow-auto"
            style={{ background: "hsl(220 20% 97%)" }}>
            <QABreadcrumb />
            <div className="p-3 md:p-6 lg:p-8">
              <Outlet />
            </div>
            <QAFooter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function QALayout() {
  return (
    <QAAuthProvider>
      <QALayoutInner />
    </QAAuthProvider>
  );
}
