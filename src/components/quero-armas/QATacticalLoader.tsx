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
      // Curva assintótica suave até 99% — finaliza ao desmontar
      const next = Math.min(99, 100 * (1 - Math.exp(-elapsed / 0.9)));
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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50">
      <div className="relative w-[78%] max-w-md">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.42em] text-slate-900">
            Carregando
          </span>
          <span className="font-mono text-[11px] font-bold tabular-nums text-slate-500">
            {pct.toString().padStart(3, "0")}%
          </span>
        </div>

        {/* Trilho */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#7A1F2B] transition-[width] duration-200 ease-out"
            style={{
              width: `${pct}%`,
              boxShadow: "0 0 12px rgba(15,23,42,0.18)",
            }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#7A1F2B]" />
          <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-slate-400">
            Sistema de Armas · Inicializando Modulos
          </span>
        </div>
      </div>
    </div>
  );
}
