import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, PenTool, FolderOpen, Scale, Gavel,
  BookOpen, FileBox, Settings, LogOut, Shield, Users, BarChart3, DollarSign, ShieldCheck,
  PanelLeftOpen, Home, Crosshair, FileStack, Activity,
  ClipboardList, Tags, GraduationCap,
  History, LifeBuoy, FileSignature, AlertTriangle, BrainCircuit, PlusCircle, X,
} from "lucide-react";
import { QALogo } from "./QALogo";
import { supabase } from "@/integrations/supabase/client";

// FASE 22-B: Menu reorganizado em 7 grupos.
// Itens ocultados (rotas mantidas em QARoutes.tsx, acessíveis por URL direta):
//   /contratacoes-pendentes, /historico, /acessos, /clubes
const NAV_GROUPS = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Monitoramento", url: "/operacao/monitoramento", icon: Activity },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Contratações", url: "/operacao/contratacoes", icon: ClipboardList },
      { title: "Nova Venda", url: "/admin/piloto-real", icon: PlusCircle },
      { title: "Central de Adesão", url: "/admin/central-adesao", icon: FileSignature },
      { title: "Processos & Documentos", url: "/processos", icon: FileStack },
      { title: "Alertas de Vencimento", url: "/operacao/alertas-vencimento", icon: Activity },
      { title: "Prazos Expirados", url: "/operacao/prazos-expirados", icon: AlertTriangle },
      { title: "Histórico de Status", url: "/operacao/historico-status", icon: History },
    ],
  },
  {
    label: "Clientes",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
    ],
  },
  {
    label: "Jurídico & IA",
    items: [
      { title: "Assistente IA", url: "/ia", icon: Shield },
      { title: "Gerar Peça", url: "/gerar-peca", icon: PenTool },
      { title: "Casos", url: "/casos", icon: FolderOpen },
      { title: "Base Jurídica", url: "/base-conhecimento", icon: BookOpen },
      { title: "Legislação", url: "/legislacao", icon: Scale },
      { title: "Jurisprudência", url: "/jurisprudencia", icon: Gavel },
      { title: "Modelos DOCX", url: "/modelos-docx", icon: FileBox },
      { title: "Modelos de Declaração", url: "/modelos-declaracao", icon: FileSignature },
      { title: "Wizard de Perguntas", url: "/wizard-perguntas", icon: FileSignature },
      { title: "Correções da IA", url: "/correcoes-ia", icon: GraduationCap },
      { title: "Aprendizado IA", url: "/chat-aprovacao", icon: BrainCircuit },
    ],
  },
  {
    label: "Arsenal",
    items: [
      { title: "Catálogo de Modelos", url: "/armamentos", icon: Crosshair },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Catálogo de Preços", url: "/precos-servicos", icon: Tags },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Base da Equipe", url: "/base-equipe", icon: LifeBuoy },
      { title: "Auditoria", url: "/auditoria", icon: ShieldCheck },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

interface Props {
  perfil: string;
  nome: string;
  signOut: () => Promise<void>;
  /** Celular: a sidebar vira gaveta. Controlada pelo QALayout. */
  mobileAberto?: boolean;
  onFecharMobile?: () => void;
}

export function QASidebar({ perfil, nome, signOut, mobileAberto = false, onFecharMobile }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Na gaveta do celular nunca faz sentido o modo "só ícones": há largura de
  // sobra e o usuário abriu justamente para ler os nomes.
  const collapsed = mobileAberto ? false : !expanded;
  const location = useLocation();
  const toggleSidebar = () => setExpanded(v => !v);

  // Contagem em tempo real de respostas do chat pendentes de aprovação.
  const [pendentesAprendizado, setPendentesAprendizado] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { count } = await supabase
        .from("qa_chat_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("role", "assistant")
        .is("aprovada_kb", null);
      if (!cancelled) setPendentesAprendizado(count ?? 0);
    };
    refresh();
    const channel = supabase
      .channel("qa_sidebar_aprendizado_ia")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_chat_mensagens" },
        () => { refresh(); }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const initials = (nome || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const isActive = (url: string) =>
    location.pathname === url || location.pathname.startsWith(url + "/");

  const canAccess = (url: string) => {
    if (perfil === "leitura_auditoria") return !["/gerar-peca", "/modelos-docx", "/modelos-declaracao", "/correcoes-ia"].includes(url);
    if (perfil === "assistente_juridico") return url !== "/configuracoes";
    return true;
  };

  // Celular: alvo de toque maior e cantos mais suaves. Desktop: o de sempre.
  const itemBase =
    "flex items-center font-medium transition-all rounded-xl text-[14px] md:rounded-lg md:text-[13px]";

  return (
    <aside
      data-qa-sidebar="true"
      /* Escapa do `filter: invert(1)` que o modo noturno aplica em .qa-scope:
         o filtro do pai inverte, o desta regra devolve, e a sidebar volta a
         renderizar nas cores declaradas. Sem isso não existe branco — branco
         invertido é preto. Tokens em index.css ([data-qa-sidebar]). */
      data-nao-inverter
      className={[
        // A casca não rola: rola só a lista de itens. Assim o cabeçalho (logo +
        // fechar) e o rodapé (perfil + sair) ficam sempre à mão.
        "flex flex-col overflow-hidden border-r",
        // CELULAR: gaveta em TELA CHEIA. Fora do fluxo, deslizando pela esquerda.
        "fixed left-0 top-0 z-50 h-dvh w-full transition-transform duration-300 ease-out",
        mobileAberto ? "translate-x-0" : "-translate-x-full",
        // DESKTOP: volta a ser a coluna do grid, exatamente como era.
        "md:sticky md:z-auto md:h-screen md:w-[var(--qa-sb-w)] md:shrink-0",
        "md:translate-x-0 md:self-start md:shadow-none md:transition-[width]",
      ].join(" ")}
      style={{
        ["--qa-sb-w" as string]: collapsed ? "4.25rem" : "16rem",
        /* Altura presa à tela, não ao conteúdo do menu.
           O grid do QALayout usa `items-stretch`: com altura natural, o menu
           (~16 itens) ficava mais alto que a tela e passava a ditar a altura da
           página — a coluna do conteúdo esticava junto e empurrava o rodapé,
           abrindo um vazio entre o fim do conteúdo e o rodapé.
           `align-self: start` sozinho não resolve: a linha continua dimensionada
           pela altura natural da sidebar. O que resolve é limitá-la a 100vh e
           dar rolagem própria. O sticky mantém o menu visível em telas longas. */
        background: "var(--qa-sb-shell, var(--qa-sb-bg))",
        borderColor: "var(--qa-sb-border)",
      }}
    >
      {/* ---------- Cabeçalho do CELULAR ----------
          Logo pequena à esquerda, botão de fechar redondo à direita. Sem a
          linha "Inteligência Jurídica": em 390px ela virava um "I..." solto. */}
      <div
        className="flex items-center justify-between gap-3 border-b px-4 pb-3.5 md:hidden"
        style={{
          borderColor: "var(--qa-sb-divider)",
          paddingTop: "max(0.875rem, env(safe-area-inset-top))",
        }}
      >
        <QALogo linkTo={null} className="h-10 w-auto max-w-[120px] rounded-xl" />
        <button
          onClick={onFecharMobile}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-[var(--qa-sb-hover-bg)] transition-transform active:scale-95"
          style={{ borderColor: "var(--qa-sb-divider)", color: "var(--qa-sb-toggle)" }}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ---------- Cabeçalho do DESKTOP (inalterado) ---------- */}
      <div className="hidden pt-3 md:block">
        {collapsed ? (
          <button
            onClick={toggleSidebar}
            className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--qa-sb-toggle)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--qa-sb-toggle-hover-bg)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title="Expandir menu"
            aria-label="Expandir menu"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        ) : (
          <div className="px-4 pb-3 mb-1 border-b flex items-center justify-between" style={{ borderColor: "var(--qa-sb-divider)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <QALogo className="h-8 w-auto max-w-[96px] rounded-lg" />
              <div className="text-[10px] tracking-widest uppercase truncate" style={{ color: "var(--qa-sb-label)" }}>
                Inteligência Jurídica
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--qa-sb-toggle)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--qa-sb-toggle-hover-bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              title="Recolher menu"
              aria-label="Recolher menu"
            >
              <PanelLeftOpen className="h-4 w-4 rotate-180" />
            </button>
          </div>
        )}
      </div>

      {/* ---------- Itens ---------- */}
      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 md:py-0">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(i => canAccess(i.url));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className={`py-1 ${collapsed ? "" : "px-1"}`}>
                {!collapsed && (
                  <div className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] md:pt-1.5"
                    style={{ color: "var(--qa-sb-label)" }}>
                    {group.label}
                  </div>
                )}
                <ul className="flex flex-col gap-1 md:gap-0.5">
                  {visibleItems.map(item => {
                    const active = isActive(item.url);
                    return (
                      <li key={item.url}>
                        <Link
                          to={item.url}
                          title={collapsed ? item.title : undefined}
                          className={`${itemBase} relative ${collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-4 py-2.5 mx-2 md:gap-2.5 md:px-3 md:py-2 md:mx-1"}`}
                          style={{
                            background: active ? "var(--qa-sb-active-bg)" : "transparent",
                            color: active ? "var(--qa-sb-active-text)" : "var(--qa-sb-text)",
                          }}
                          onMouseEnter={e => {
                            if (!active) {
                              (e.currentTarget as HTMLElement).style.background = "var(--qa-sb-hover-bg)";
                              (e.currentTarget as HTMLElement).style.color = "var(--qa-sb-hover-text)";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!active) {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "var(--qa-sb-text)";
                            }
                          }}
                        >
                          {/* Marcador do item ativo — só no celular, onde não há
                              trilho lateral para dar a referência de posição. */}
                          {active && !collapsed && (
                            <span
                              className="absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-[var(--qa-sb-accent)] md:hidden"
                              aria-hidden
                            />
                          )}
                          <item.icon className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-[18px] w-[18px] md:h-4 md:w-4"}`} style={{
                            color: active ? "var(--qa-sb-active-icon)" : "var(--qa-sb-icon)",
                          }} />
                          {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                          {item.url === "/chat-aprovacao" && pendentesAprendizado > 0 && (
                            <span
                              className={`inline-flex items-center justify-center font-bold rounded-full ${collapsed ? "absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 text-[9px]" : "h-4 min-w-[18px] px-1 text-[10px]"}`}
                              style={{ background: "var(--qa-sb-accent)", color: "#fff" }}
                            >
                              {pendentesAprendizado > 99 ? "99+" : pendentesAprendizado}
                            </span>
                          )}
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
        <div
          className={`shrink-0 border-t pt-2 ${collapsed ? "" : "px-1"}`}
          style={{
            borderColor: "var(--qa-sb-divider)",
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
          }}
        >
          {!collapsed && (
            <div className="mx-1 mb-1 flex items-center gap-3 rounded-xl bg-[var(--qa-sb-hover-bg)] px-3 py-3 md:mx-0 md:gap-2.5 md:rounded-none md:bg-transparent md:py-2.5">
              <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold text-white md:h-8 md:w-8 md:text-[11px]"
                style={{ background: "var(--qa-sb-accent)" }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-[13px] font-semibold md:text-xs md:font-medium" style={{ color: "var(--qa-sb-name)" }}>{nome}</div>
                <div className="text-[11px] capitalize md:text-[10px]" style={{ color: "var(--qa-sb-label)" }}>{perfil.replace(/_/g, " ")}</div>
              </div>
            </div>
          )}

          <ul className="flex flex-col gap-1 pb-1 md:gap-0.5">
            {/* Voltar para Home (site público) */}
            <li>
              <a
                href="/"
                title={collapsed ? "Voltar ao site" : undefined}
                className={`${itemBase} ${collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-4 py-2.5 mx-2 md:gap-2.5 md:px-3 md:py-2 md:mx-1"}`}
                style={{ color: "var(--qa-sb-text)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "var(--qa-sb-hover-bg)";
                  (e.currentTarget as HTMLElement).style.color = "var(--qa-sb-hover-text)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--qa-sb-text)";
                }}
              >
                <Home className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-[18px] w-[18px] md:h-4 md:w-4"}`} style={{ color: "var(--qa-sb-icon)" }} />
                {!collapsed && <span>Voltar ao site</span>}
              </a>
            </li>

            {/* Sair */}
            <li>
              <button
                onClick={signOut}
                title={collapsed ? "Sair" : undefined}
                className={`${itemBase} w-[calc(100%-1rem)] md:w-full ${collapsed ? "justify-center !w-9 h-9 mx-auto" : "gap-3 px-4 py-2.5 mx-2 md:gap-2.5 md:px-3 md:py-2 md:mx-1"}`}
                style={{ color: "var(--qa-sb-icon)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = "var(--qa-sb-danger-text)";
                  (e.currentTarget as HTMLElement).style.background = "var(--qa-sb-danger-bg)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = "var(--qa-sb-icon)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <LogOut className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-[18px] w-[18px] md:h-4 md:w-4"}`} />
                {!collapsed && <span>Sair</span>}
              </button>
            </li>
          </ul>
        </div>
    </aside>
  );
}
