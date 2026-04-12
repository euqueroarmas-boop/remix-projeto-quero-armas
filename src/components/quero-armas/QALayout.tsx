import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QASidebar } from "./QASidebar";
import { Outlet, Navigate } from "react-router-dom";
import { useQAAuth } from "./hooks/useQAAuth";

export default function QALayout() {
  const { user, profile, loading } = useQAAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
          <span className="text-[10px] text-slate-600 tracking-wider uppercase">Carregando</span>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/quero-armas/login" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0a0a0a] text-slate-300">
        <QASidebar perfil={profile.perfil} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-10 md:h-11 flex items-center border-b border-[#1a1a1a] px-2 md:px-3 bg-[#050505] shrink-0">
            <SidebarTrigger className="mr-2 md:mr-3 text-slate-600 hover:text-slate-400 h-6 w-6 md:h-7 md:w-7" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 hidden sm:block font-mono truncate max-w-[120px]">{profile.nome}</span>
              <span className="text-[8px] md:text-[9px] px-1.5 py-0.5 rounded bg-[#161616] text-slate-500 uppercase tracking-[0.12em] font-medium">
                {profile.perfil.replace('_', ' ')}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-2 md:p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
