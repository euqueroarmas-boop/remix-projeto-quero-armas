import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QASidebar } from "./QASidebar";
import { Outlet, Navigate } from "react-router-dom";
import { useQAAuth } from "./hooks/useQAAuth";
import { Loader2 } from "lucide-react";

export default function QALayout() {
  const { user, profile, loading } = useQAAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0c14]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/quero-armas/login" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0c0c14] text-slate-100">
        <QASidebar perfil={profile.perfil} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-slate-800/60 px-4 bg-[#0e0e18]/80 backdrop-blur-sm shrink-0">
            <SidebarTrigger className="mr-3 text-slate-400 hover:text-amber-400" />
            <div className="flex items-center gap-2">
              <span className="text-amber-500 font-bold text-lg tracking-tight">Quero Armas</span>
              <span className="text-slate-500 text-sm font-light">| IA Jurídica</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-slate-500 hidden sm:block">{profile.nome}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider font-medium">
                {profile.perfil.replace('_', ' ')}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
