import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QASidebar } from "./QASidebar";
import { Outlet, Navigate } from "react-router-dom";
import { useQAAuth } from "./hooks/useQAAuth";
import { Search, Bell, Plus } from "lucide-react";
import { useState } from "react";

export default function QALayout() {
  const { user, profile, loading } = useQAAuth();
  const [searchOpen, setSearchOpen] = useState(false);

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

  const initials = (profile.nome || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full qa-premium">
        <QASidebar perfil={profile.perfil} />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Premium Header */}
          <header className="h-14 md:h-[60px] flex items-center border-b px-3 md:px-6 shrink-0"
            style={{
              background: "hsl(0 0% 100%)",
              borderColor: "hsl(220 13% 91%)",
            }}>
            <SidebarTrigger className="mr-3 h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" />

            {/* Search */}
            <div className="flex-1 max-w-md hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
              style={{
                background: "hsl(220 20% 97%)",
                borderColor: searchOpen ? "hsl(230 80% 56%)" : "hsl(220 13% 91%)",
                boxShadow: searchOpen ? "0 0 0 3px hsla(230,80%,56%,0.1)" : "none",
              }}>
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar documentos, peças, clientes..."
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setSearchOpen(false)}
              />
              <kbd className="hidden lg:inline-flex text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">⌘K</kbd>
            </div>

            <div className="flex-1 md:hidden" />

            {/* Right actions */}
            <div className="flex items-center gap-2 ml-3">
              <button className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 transition-colors">
                <Search className="h-4 w-4" />
              </button>
              <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
              </button>
              <button className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-white text-xs font-semibold transition-all qa-btn-primary hidden sm:flex">
                <Plus className="h-3.5 w-3.5" />
                <span>Nova Peça</span>
              </button>
              <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: "hsl(230 80% 56%)" }}>
                  {initials}
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{profile.nome}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{profile.perfil.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main */}
          <main className="flex-1 overflow-auto p-3 md:p-6 lg:p-8"
            style={{ background: "hsl(220 20% 97%)" }}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
