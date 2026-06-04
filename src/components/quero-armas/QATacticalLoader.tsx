import { useEffect, useState } from "react";

/**
 * Loader tático do módulo Quero Armas.
 * - Fundo preto absoluto
 * - Texto "CARREGANDO" em branco com tracking militar
 * - Barra de progresso real (assintótica até o módulo montar)
 *
 * O progresso simula o carregamento dos chunks lazy: avança rápido até ~92%
 * e finaliza ao desmontar (quando o Suspense resolve).
 */
export default function QATacticalLoader() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const stuckTimer = window.setTimeout(() => {
      setStuck(true);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          `[QATacticalLoader] carregamento >8s em ${window.location.pathname}`
        );
      }
    }, 8000);
    return () => {
      window.clearTimeout(stuckTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505]">
      <div
        className="flex flex-col items-center gap-4"
        role="status"
        aria-live="polite"
      >
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#D6A64B]" />
        </div>
        <span className="text-sm text-white/70">
          Preparando sua experiência...
        </span>
        {stuck && (
          <p className="mt-1 max-w-xs text-center text-xs text-white/60">
            Ainda estamos carregando. Se continuar demorando, atualize a página.
          </p>
        )}
      </div>
    </div>
  );
}
