import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { QASidebar } from "./QASidebar";
import { Outlet, Navigate } from "react-router-dom";
import { useQAAuth } from "./hooks/useQAAuth";
import { PanelLeft } from "lucide-react";

function DesktopToggle() {
  const { toggleSidebar, state } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
      style={{
        color: "hsl(220 10% 55%)",
        background: "transparent",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "hsl(220 14% 93%)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      title={state === "collapsed" ? "Expandir menu" : "Recolher menu"}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}

export default function QALayout() {
  const { user, profile, loading } = useQAAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center qa-premium" style={{ background: "hsl(220 20% 97%)" }}>
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
      <div className="min-h-screen flex w-full qa-premium">
        <QASidebar perfil={profile.perfil} nome={profile.nome} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-10 flex items-center gap-1 px-3 shrink-0"
            style={{ background: "hsl(220 20% 97%)" }}>
            <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" />
            <DesktopToggle />
          </header>

          <main className="flex-1 overflow-auto p-3 md:p-6 lg:p-8"
            style={{ background: "hsl(220 20% 97%)" }}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
