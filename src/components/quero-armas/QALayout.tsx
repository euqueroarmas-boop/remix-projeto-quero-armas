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

      {/* Fundo escurecido da gaveta. Toque fora fecha. */}
      {menuMobile && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuMobile(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <main className="flex min-h-screen min-w-0 flex-col" style={{ background: "var(--qa-app)" }}>
        {/* Barra superior do celular: o único lugar de onde a gaveta abre. */}
        <div
          className="sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-2 md:hidden"
          style={{ background: "var(--qa-app)", borderColor: "var(--qa-sb-border)" }}
        >
          <button
            type="button"
            onClick={() => setMenuMobile(true)}
            aria-label="Abrir menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border"
            style={{ borderColor: "var(--qa-sb-border)", color: "var(--qa-sb-text)" }}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-[13px] font-semibold tracking-wide" style={{ color: "var(--qa-sb-name)" }}>
            {profile.nome}
          </span>
        </div>
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
