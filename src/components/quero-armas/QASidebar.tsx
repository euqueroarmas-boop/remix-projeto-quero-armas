import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, PenTool, FolderOpen, Scale, Gavel,
  BookOpen, FileBox, History, Settings, LogOut, Shield, Users, Building2, BarChart3, DollarSign, ShieldCheck,
  PanelLeftOpen, Home,
} from "lucide-react";
import { QALogo } from "./QALogo";

const NAV_GROUPS = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Gerar Peça", url: "/gerar-peca", icon: PenTool },
      { title: "Casos", url: "/casos", icon: FolderOpen },
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "Clubes de Tiro", url: "/clubes", icon: Building2 },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "Assistente IA", url: "/ia", icon: Shield },
    ],
  },
  {
    label: "Acervo",
    items: [
      { title: "Base Jurídica", url: "/base-conhecimento", icon: BookOpen },
      { title: "Legislação", url: "/legislacao", icon: Scale },
      { title: "Jurisprudência", url: "/jurisprudencia", icon: Gavel },
      { title: "Modelos DOCX", url: "/modelos-docx", icon: FileBox },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Auditoria", url: "/auditoria", icon: ShieldCheck },
      { title: "Acessos de Clientes", url: "/acessos", icon: ShieldCheck },
      { title: "Histórico", url: "/historico", icon: History },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

interface Props { perfil: string; nome: string; signOut: () => Promise<void> }

export function QASidebar({ perfil, nome, signOut }: Props) {
  const [expanded, setExpanded] = useState(false);
  const collapsed = !expanded;
  const location = useLocation();
  const toggleSidebar = () => setExpanded(v => !v);

  const initials = (nome || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const isActive = (url: string) =>
    location.pathname === url || location.pathname.startsWith(url + "/");

  const canAccess = (url: string) => {
    if (perfil === "leitura_auditoria") return !["/gerar-peca", "/modelos-docx"].includes(url);
    if (perfil === "assistente_juridico") return url !== "/configuracoes";
    return true;
  };

  const itemBase = "flex items-center rounded-lg text-[13px] font-medium transition-all";

  return (
    <aside
      className="shrink-0 border-r flex flex-col z-30 transition-[width] duration-200 self-start min-h-screen"
      style={{
        width: collapsed ? "3.25rem" : "16rem",
        background: "hsl(0 0% 100%)",
        borderColor: "hsl(220 13% 91%)",
      }}
    >
      <div className="py-3 flex flex-col h-full overflow-hidden">
        {/* Header / toggle */}
        {collapsed ? (
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center mx-auto mb-3 w-9 h-9 rounded-lg transition-colors"
            style={{ color: "hsl(220 10% 52%)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "hsl(220 14% 94%)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title="Expandir menu"
            aria-label="Expandir menu"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        ) : (
          <div className="px-4 pb-3 mb-1 border-b flex items-center justify-between" style={{ borderColor: "hsl(220 13% 93%)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <QALogo className="h-9 w-auto max-w-[110px] rounded-lg" />
              <div className="text-[10px] tracking-widest uppercase truncate" style={{ color: "hsl(220 10% 62%)" }}>
                Inteligência Jurídica
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="h-7 w-7 rounded-md flex items-center justify-center transition-colors shrink-0"
              style={{ color: "hsl(220 10% 58%)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "hsl(220 14% 94%)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              title="Recolher menu"
              aria-label="Recolher menu"
            >
              <PanelLeftOpen className="h-4 w-4 rotate-180" />
            </button>
          </div>
        )}

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(i => canAccess(i.url));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className={`py-1 ${collapsed ? "" : "px-1"}`}>
                {!collapsed && (
                  <div className="text-[10px] uppercase tracking-[0.15em] font-semibold px-4 py-1.5"
                    style={{ color: "hsl(220 10% 62%)" }}>
                    {group.label}
                  </div>
                )}
                <ul className="flex flex-col gap-0.5">
                  {visibleItems.map(item => {
                    const active = isActive(item.url);
                    return (
                      <li key={item.url}>
                        <Link
                          to={item.url}
                          title={collapsed ? item.title : undefined}
                          className={`${itemBase} ${collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-2.5 px-3 py-2 mx-1"}`}
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
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer: profile + back to site + logout */}
        <div className={`pt-2 border-t ${collapsed ? "" : "px-1"}`} style={{ borderColor: "hsl(220 13% 93%)" }}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1">
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

          <ul className="flex flex-col gap-0.5 pb-1">
            {/* Voltar para Home (site público) */}
            <li>
              <a
                href="/"
                title={collapsed ? "Voltar ao site" : undefined}
                className={`${itemBase} ${collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-2.5 px-3 py-2 mx-1"}`}
                style={{ color: "hsl(220 10% 46%)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "hsl(220 14% 96%)";
                  (e.currentTarget as HTMLElement).style.color = "hsl(220 20% 25%)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "hsl(220 10% 46%)";
                }}
              >
                <Home className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-4 w-4"}`} style={{ color: "hsl(220 10% 62%)" }} />
                {!collapsed && <span>Voltar ao site</span>}
              </a>
            </li>

            {/* Sair */}
            <li>
              <button
                onClick={signOut}
                title={collapsed ? "Sair" : undefined}
                className={`${itemBase} w-full ${collapsed ? "justify-center !w-9 h-9 mx-auto" : "gap-2.5 px-3 py-2 mx-1"}`}
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
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}