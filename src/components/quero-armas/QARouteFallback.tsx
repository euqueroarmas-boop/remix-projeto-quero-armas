import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Fallback de Suspense para trocas de rota dentro do QARoutes.
 *
 * Diferente do QATacticalLoader (boot inicial full-screen), este fallback:
 *  - aguarda ~300ms antes de aparecer (evita flash em transições rápidas);
 *  - usa visual leve/discreto;
 *  - troca para paleta escura nas rotas do checkout guiado;
 *  - após ~8s, mostra mensagem explicativa pedindo reload manual,
 *    em vez de ficar travado visualmente.
 */

const GUIDED_PREFIXES = [
  "/cadastro",
  "/cadastro-mira",
  "/cadastro-v2",
  "/descobrir-meu-caminho",
  "/checkout/finalizar",
];

function isGuidedRoute(pathname: string): boolean {
  return GUIDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function QARouteFallback() {
  const { pathname } = useLocation();
  const guided = isGuidedRoute(pathname);

  const [visible, setVisible] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const showTimer = window.setTimeout(() => setVisible(true), 300);
    const stuckTimer = window.setTimeout(() => {
      setStuck(true);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          `[QARouteFallback] Carregamento >8s em ${window.location.pathname}`
        );
      }
    }, 8000);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(stuckTimer);
    };
  }, []);

  if (!visible) return null;

  // Visual escuro para checkout guiado (combina com .qa-refinado / dark brass)
  if (guided) {
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#050505]"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[#D6A64B]" />
          </div>
          <span className="text-sm text-white/70">Carregando...</span>
          {stuck && (
            <p className="mt-2 max-w-xs text-center text-[11px] text-white/70">
              Ainda estamos carregando. Se continuar demorando, atualize a página.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Visual leve/discreto para rotas públicas comuns
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6"
      role="status"
      aria-live="polite"
    >
      <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#7A1F2B]" />
      </div>
      <span className="text-sm text-slate-500">Carregando...</span>
      {stuck && (
        <p className="mt-2 max-w-xs text-center text-[11px] text-slate-500">
          Ainda estamos carregando. Se continuar demorando, atualize a página.
        </p>
      )}
    </div>
  );
}