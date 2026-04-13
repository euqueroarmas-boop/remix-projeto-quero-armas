import { useLocation, Link } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, PenTool, FolderOpen, FileText, Scale, Gavel,
  BookOpen, FileBox, History, ClipboardList, Settings, LogOut, Shield,
} from "lucide-react";
import { useQAAuth } from "./hooks/useQAAuth";

const NAV_GROUPS = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/quero-armas/dashboard", icon: LayoutDashboard },
      { title: "Gerar Peça", url: "/quero-armas/gerar-peca", icon: PenTool },
      { title: "Casos", url: "/quero-armas/casos", icon: FolderOpen },
      { title: "Assistente Jurídico", url: "/quero-armas/ia", icon: Shield },
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
    label: "Registro",
    items: [
      { title: "Histórico", url: "/quero-armas/historico", icon: History },
      { title: "Configurações", url: "/quero-armas/configuracoes", icon: Settings },
    ],
  },
];

interface Props { perfil: string }

export function QASidebar({ perfil }: Props) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useQAAuth();

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
    <Sidebar collapsible="icon" className="border-r border-[#1c1c1c] bg-[#0a0a0a]">
      <SidebarContent className="py-3">
        {!collapsed && (
          <div className="px-4 pb-3 mb-1 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#7a1528]/20 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-[#c43b52]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-neutral-200 tracking-tight leading-none">Quero Armas</div>
                <div className="text-[9px] text-neutral-600 tracking-[0.15em] uppercase mt-0.5">Inteligência Jurídica</div>
              </div>
            </div>
          </div>
        )}

        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(i => canAccess(i.url));
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && (
                <SidebarGroupLabel className="text-[9px] text-neutral-600 uppercase tracking-[0.2em] font-medium px-4 py-1">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map(item => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <Link
                            to={item.url}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-[13px] transition-all ${
                              active
                                ? "bg-[#7a1528]/15 text-[#e8a0ad] border-l-2 border-[#a52338]"
                                : "text-neutral-500 hover:text-neutral-300 hover:bg-[#141414]"
                            }`}
                          >
                            <item.icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#c43b52]" : ""}`} />
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

        <div className="mt-auto pt-2 border-t border-[#1c1c1c] mx-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded text-[13px] text-neutral-600 hover:text-red-400 hover:bg-red-500/5 w-full transition-all"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
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
