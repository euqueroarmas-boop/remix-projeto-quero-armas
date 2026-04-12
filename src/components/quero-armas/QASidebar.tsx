import { useLocation, Link } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Bot, BookOpen, Scale, Gavel,
  FileText, PenTool, History, Settings, LogOut,
} from "lucide-react";
import { useQAAuth } from "./hooks/useQAAuth";

const items = [
  { title: "Dashboard", url: "/quero-armas/dashboard", icon: LayoutDashboard },
  { title: "IA Jurídica", url: "/quero-armas/ia", icon: Bot },
  { title: "Base de Conhecimento", url: "/quero-armas/base-conhecimento", icon: BookOpen },
  { title: "Legislação", url: "/quero-armas/legislacao", icon: Scale },
  { title: "Jurisprudência", url: "/quero-armas/jurisprudencia", icon: Gavel },
  { title: "Modelos DOCX", url: "/quero-armas/modelos-docx", icon: FileText },
  { title: "Gerar Peça", url: "/quero-armas/gerar-peca", icon: PenTool },
  { title: "Histórico", url: "/quero-armas/historico", icon: History },
  { title: "Configurações", url: "/quero-armas/configuracoes", icon: Settings },
];

interface Props { perfil: string }

export function QASidebar({ perfil }: Props) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useQAAuth();

  const visible = items.filter(i => {
    if (perfil === "leitura_auditoria") {
      return !["/quero-armas/gerar-peca", "/quero-armas/modelos-docx"].includes(i.url);
    }
    if (perfil === "assistente_juridico") {
      return i.url !== "/quero-armas/configuracoes";
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-800/60 bg-[#0a0a12]">
      <SidebarContent className="py-4">
        {!collapsed && (
          <div className="px-4 pb-4 mb-2 border-b border-slate-800/40">
            <div className="text-amber-500 font-bold text-xl tracking-tight">QA</div>
            <div className="text-[10px] text-slate-500 tracking-widest uppercase">Inteligência Jurídica</div>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const active = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.url}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                          active
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 w-full transition-all"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Sair</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
