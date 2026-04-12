import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QASidebar } from "./QASidebar";
import { Outlet, Navigate } from "react-router-dom";
import { useQAAuth } from "./hooks/useQAAuth";
import { Loader2 } from "lucide-react";

export default function QALayout() {
  const { user, profile, loading } = useQAAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
          <span className="text-xs text-slate-600 tracking-wider uppercase">Carregando</span>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/quero-armas/login" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0a0a12] text-slate-300">
        <QASidebar perfil={profile.perfil} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-11 flex items-center border-b border-[#1a1a2e] px-3 bg-[#08080f] shrink-0">
            <SidebarTrigger className="mr-3 text-slate-600 hover:text-slate-400 h-7 w-7" />
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-600 hidden sm:block font-mono">{profile.nome}</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-[#14142a] text-slate-500 uppercase tracking-[0.15em] font-medium">
                {profile.perfil.replace('_', ' ')}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 md:p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
