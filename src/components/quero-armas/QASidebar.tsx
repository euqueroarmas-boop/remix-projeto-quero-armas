import { useLocation, Link } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, PenTool, FolderOpen, FileText, Scale, Gavel,
  BookOpen, FileBox, History, Settings, LogOut, Shield, Users, Building2, BarChart3, DollarSign,
  PanelLeftOpen,
} from "lucide-react";
import { useQAAuth } from "./hooks/useQAAuth";

const NAV_GROUPS = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/quero-armas/dashboard", icon: LayoutDashboard },
      { title: "Gerar Peça", url: "/quero-armas/gerar-peca", icon: PenTool },
      { title: "Casos", url: "/quero-armas/casos", icon: FolderOpen },
      { title: "Clientes", url: "/quero-armas/clientes", icon: Users },
      { title: "Clubes de Tiro", url: "/quero-armas/clubes", icon: Building2 },
      { title: "Financeiro", url: "/quero-armas/financeiro", icon: DollarSign },
      { title: "Relatórios", url: "/quero-armas/relatorios", icon: BarChart3 },
      { title: "Assistente IA", url: "/quero-armas/ia", icon: Shield },
    ],
  },
  {
    label: "Acervo",
    items: [
      { title: "Base Jurídica", url: "/quero-armas/base-conhecimento", icon: BookOpen },
      { title: "Legislação", url: "/quero-armas/legislacao", icon: Scale },
      { title: "Jurisprudência", url: "/quero-armas/jurisprudencia", icon: Gavel },
      { title: "Modelos DOCX", url: "/quero-armas/modelos-docx", icon: FileBox },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Histórico", url: "/quero-armas/historico", icon: History },
      { title: "Configurações", url: "/quero-armas/configuracoes", icon: Settings },
    ],
  },
];

interface Props { perfil: string; nome: string }

export function QASidebar({ perfil, nome }: Props) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useQAAuth();

  const initials = (nome || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const isActive = (url: string) =>
    location.pathname === url || location.pathname.startsWith(url + "/");

  const canAccess = (url: string) => {
    if (perfil === "leitura_auditoria") {
      return !["/quero-armas/gerar-peca", "/quero-armas/modelos-docx"].includes(url);
    }
    if (perfil === "assistente_juridico") {
      return url !== "/quero-armas/configuracoes";
    }
    return true;
  };

  return (
    <Sidebar collapsible="icon" className="border-r"
      style={{
        background: "hsl(0 0% 100%)",
        borderColor: "hsl(220 13% 91%)",
      } as React.CSSProperties}>
      <SidebarContent className="py-3 flex flex-col" style={{ background: "hsl(0 0% 100%)" }}>

        {/* Collapsed: clickable bar area to expand */}
        {collapsed && (
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center mx-auto mb-3 w-9 h-9 rounded-lg transition-colors"
            style={{ color: "hsl(220 10% 52%)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "hsl(220 14% 94%)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title="Expandir menu"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        )}

        {/* Logo - expanded only */}
        {!collapsed && (
          <div className="px-5 pb-3 mb-1 border-b flex items-center justify-between" style={{ borderColor: "hsl(220 13% 93%)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(230 80% 96%)" }}>
                <Shield className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
                  Quero Armas
                </div>
                <div className="text-[10px] tracking-widest uppercase" style={{ color: "hsl(220 10% 62%)" }}>
                  Inteligência Jurídica
                </div>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="h-7 w-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: "hsl(220 10% 58%)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "hsl(220 14% 94%)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              title="Recolher menu"
            >
              <PanelLeftOpen className="h-4 w-4 rotate-180" />
            </button>
          </div>
        )}

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(i => canAccess(i.url));
            if (visibleItems.length === 0) return null;
            return (
              <SidebarGroup key={group.label}>
                {!collapsed && (
                  <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] font-semibold px-5 py-1.5"
                    style={{ color: "hsl(220 10% 62%)" }}>
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map(item => {
                      const active = isActive(item.url);
                      return (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                            <Link
                              to={item.url}
                              className={`flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all ${
                                collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-4 py-2 mx-2"
                              }`}
                              style={{
                                background: active ? "hsl(230 80% 96%)" : "transparent",
                                color: active ? "hsl(230 80% 46%)" : "hsl(220 10% 46%)",
                              }}
                              onMouseEnter={e => {
                                if (!active) {
                                  (e.currentTarget as HTMLElement).style.background = "hsl(220 14% 96%)";
                                  (e.currentTarget as HTMLElement).style.color = "hsl(220 20% 25%)";
                                }
                              }}
                              onMouseLeave={e => {
                                if (!active) {
                                  (e.currentTarget as HTMLElement).style.background = "transparent";
                                  (e.currentTarget as HTMLElement).style.color = "hsl(220 10% 46%)";
                                }
                              }}
                            >
                              <item.icon className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-4 w-4"}`} style={{
                                color: active ? "hsl(230 80% 56%)" : "hsl(220 10% 62%)",
                              }} />
                              {!collapsed && <span>{item.title}</span>}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </div>

        {/* Admin profile + Logout */}
        <div className="pt-3 border-t mx-3" style={{ borderColor: "hsl(220 13% 93%)" }}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 mb-2">
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: "hsl(230 80% 56%)" }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>{nome}</div>
                <div className="text-[10px] capitalize" style={{ color: "hsl(220 10% 62%)" }}>{perfil.replace(/_/g, " ")}</div>
              </div>
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={collapsed ? "Sair" : undefined}>
                <button
                  onClick={signOut}
                  className={`flex items-center gap-2.5 rounded-lg text-[13px] font-medium w-full transition-all ${
                    collapsed ? "justify-center px-0 py-2.5" : "px-4 py-2"
                  }`}
                  style={{ color: "hsl(220 10% 62%)" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = "hsl(0 72% 51%)";
                    (e.currentTarget as HTMLElement).style.background = "hsl(0 72% 96%)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = "hsl(220 10% 62%)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <LogOut className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-4 w-4"}`} />
                  {!collapsed && <span>Sair</span>}
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
