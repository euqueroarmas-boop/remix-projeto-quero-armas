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
  const [progress, setProgress] = useState(4);

  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000; // segundos
      // Curva assintótica: ~92% em ~3s, satura abaixo de 95%
      const next = Math.min(95, 100 * (1 - Math.exp(-elapsed / 1.1)));
      setProgress((p) => (next > p ? next : p));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // Snap visual final ao desmontar
      setProgress(100);
    };
  }, []);

  const pct = Math.floor(progress);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
      <div className="relative w-[78%] max-w-md">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.42em] text-white">
            Carregando
          </span>
          <span className="font-mono text-[11px] font-bold tabular-nums text-white/70">
            {pct.toString().padStart(3, "0")}%
          </span>
        </div>

        {/* Trilho */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-200 ease-out"
            style={{
              width: `${pct}%`,
              boxShadow: "0 0 12px rgba(255,255,255,0.55)",
            }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/40">
            Sistema de Armas · Inicializando Modulos
          </span>
        </div>
      </div>
    </div>
  );
}
