import { QASidebar } from "./QASidebar";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { QAAuthProvider, useQAAuthContext } from "./QAAuthContext";
import { QATemaProvider } from "./QATemaContext";
import { QABreadcrumb } from "./QABreadcrumb";
import { QAFooter } from "./QAFooter";
import { lazy, Suspense, useEffect, useState } from "react";
import { Menu } from "lucide-react";

const PendenciasEssenciaisModal = lazy(() => import("./PendenciasEssenciaisModal"));
const AdminNotificacoesOverlay = lazy(() => import("./notificacoes/AdminNotificacoesOverlay"));

/**
 * Guarda de rota por perfil — espelha as regras do QASidebar.canAccess
 * para impedir acesso direto via URL (não confiar só no menu lateral).
 * Mantém compatibilidade com perfil legado "administrador" (acesso total).
 */
function canAccessRoute(perfil: string, pathname: string): boolean {
  const blockedForLeitura = ["/gerar-peca", "/modelos-docx", "/modelos-declaracao", "/correcoes-ia", "/correcoes-ia/"];
  const blockedForAssistente = ["/configuracoes"];
  // Nova Venda (venda assistida) e Central de Adesão — restritas a administrador.
  const adminOnly = ["/admin/nova-venda", "/admin/piloto-real", "/admin/pre-piloto", "/admin/central-adesao"];
  if (adminOnly.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (perfil !== "administrador") return false;
  }
  if (perfil === "leitura_auditoria") {
    return !blockedForLeitura.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }
  if (perfil === "assistente_juridico") {
    return !blockedForAssistente.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }
  return true;
}

function QALayoutInner() {
  const { user, profile, loading, signOut } = useQAAuthContext();
  const location = useLocation();
  const [menuMobile, setMenuMobile] = useState(false);

  // Navegou? A gaveta fecha sozinha — senão ela fica por cima da tela nova.
  useEffect(() => { setMenuMobile(false); }, [location.pathname]);

  // Gaveta em tela cheia: o fundo não pode rolar por baixo dela.
  useEffect(() => {
    if (!menuMobile) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, [menuMobile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220 20% 97%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-[#2F3337] rounded-full animate-spin" />
          <span className="text-xs text-slate-400 tracking-wider">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Per-route permission check by perfil. Rejeita acesso direto via URL.
  if (!canAccessRoute(profile.perfil, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      /* Celular: uma coluna só. A sidebar sai do fluxo (vira gaveta), então o
         conteúdo ocupa a largura inteira — antes o trilho de ícones tomava 68px
         de uma tela de 390 e espremia tudo. Desktop segue com as duas colunas. */
      className="qa-scope grid min-h-screen w-full grid-cols-1 items-stretch overflow-x-hidden md:grid-cols-[auto_minmax(0,1fr)]"
      style={{ background: "var(--qa-app)" }}
    >
      <QASidebar
        perfil={profile.perfil}
        nome={profile.nome}
        signOut={signOut}
        mobileAberto={menuMobile}
        onFecharMobile={() => setMenuMobile(false)}
      />

      {/* Botão do menu no celular. Canto inferior direito, ao alcance do polegar.
          O envelope com `h-[100dvh]` existe por causa do Safari do iPhone: ali
          `position: fixed` se ancora na viewport de layout, que fica POR BAIXO
          da barra do navegador — o botão sumia atrás dela. A altura dinâmica
          (dvh) acompanha a barra e mantém o botão sempre visível. */}
      {!menuMobile && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[100dvh] md:hidden">
          <button
            type="button"
            data-qa-sidebar="true"
            data-nao-inverter
            onClick={() => setMenuMobile(true)}
            aria-label="Abrir menu"
            className="pointer-events-auto absolute right-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl ring-1 ring-black/10 transition-transform active:scale-95"
            style={{
              bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
              background: "var(--qa-sb-accent)",
              color: "var(--qa-sb-accent-text)",
            }}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      )}

      <main className="flex min-h-screen min-w-0 flex-col pb-16 md:pb-0" style={{ background: "var(--qa-app)" }}>
        <QABreadcrumb />
        <div className="flex-1 p-3 md:py-6 md:px-4 lg:py-8 lg:px-5">
          <Outlet />
        </div>
        <QAFooter />
      </main>
      {/* Painel automático de pendências essenciais (perfis internos). */}
      <Suspense fallback={null}>
        <PendenciasEssenciaisModal />
      </Suspense>
      {/* Central de Notificação: pop-ups discretos em tempo real. */}
      <Suspense fallback={null}>
        <AdminNotificacoesOverlay />
      </Suspense>
    </div>
  );
}

export default function QALayout() {
  return (
    <QAAuthProvider>
      <QATemaProvider>
        <QALayoutInner />
      </QATemaProvider>
    </QAAuthProvider>
  );
}
