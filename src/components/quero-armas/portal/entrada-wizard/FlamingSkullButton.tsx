import { useState, useEffect } from "react";

/**
 * FlamingSkullButton — botão flutuante (bottom-right) que abre o Assistente
 * de Novos Serviços.
 *
 * Estados:
 *   • idle  : crânio em chama sutil nos olhos (sempre aceso)
 *   • hover : expressão brava — sobrancelhas franzidas, olhos flamejantes,
 *             mandíbula levemente aberta, aura avermelhada
 *   • active: EXPLOSÃO — fogo na cabeça irrompe, partículas sobem, olhos
 *             brilham ao máximo (gatilho: onClick)
 *
 * Zero IA, zero <img>. Só SVG + keyframes inline.
 */
export default function FlamingSkullButton({ onClick }: { onClick: () => void }) {
  type State = "idle" | "hover" | "active";
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (state !== "active") return;
    const t = setTimeout(() => setState("idle"), 900);
    return () => clearTimeout(t);
  }, [state]);

  const isIdle = state === "idle";
  const isHover = state === "hover";
  const isActive = state === "active";

  return (
    <>
      <style>{`
        /* ===== chama sutil (idle & hover) ===== */
        @keyframes qa-flame-rise {
          0%   { transform: scaleY(1) translateY(0); opacity: .75 }
          50%  { transform: scaleY(1.18) translateY(-3px); opacity: .95 }
          100% { transform: scaleY(1) translateY(0); opacity: .75 }
        }
        @keyframes qa-flame-rise-alt {
          0%   { transform: scaleY(.92) translateY(1px); opacity: .65 }
          50%  { transform: scaleY(1.25) translateY(-4px); opacity: .9 }
          100% { transform: scaleY(.92) translateY(1px); opacity: .65 }
        }
        @keyframes qa-flame-rise-fast {
          0%   { transform: scaleY(1.05) translateY(0); opacity: .8 }
          33%  { transform: scaleY(1.12) translateY(-2px); opacity: 1 }
          66%  { transform: scaleY(.95) translateY(1px); opacity: .7 }
          100% { transform: scaleY(1.05) translateY(0); opacity: .8 }
        }

        /* ===== explosão (active) ===== */
        @keyframes qa-flame-surge {
          0%   { transform: scaleY(1) translateY(0); opacity: .9 }
          40%  { transform: scaleY(1.35) translateY(-5px); opacity: 1 }
          100% { transform: scaleY(1) translateY(0); opacity: .9 }
        }
        @keyframes qa-flame-surge-alt {
          0%   { transform: scaleY(.9) translateY(2px); opacity: .8 }
          50%  { transform: scaleY(1.45) translateY(-7px); opacity: 1 }
          100% { transform: scaleY(.9) translateY(2px); opacity: .8 }
        }
        @keyframes qa-flame-burst {
          0%   { transform: scaleY(1) translateY(0); opacity: .95 }
          30%  { transform: scaleY(1.6) translateY(-8px); opacity: 1 }
          100% { transform: scaleY(1) translateY(0); opacity: .95 }
        }

        /* ===== olhos ===== */
        @keyframes qa-eye-glow {
          0%,100% { opacity: .85; filter: drop-shadow(0 0 5px #ff5a1f) drop-shadow(0 0 10px #7A1F2B) }
          50%     { opacity: 1;  filter: drop-shadow(0 0 9px #ffb347) drop-shadow(0 0 18px #ff5a1f) }
        }
        @keyframes qa-eye-glow-idle {
          0%,100% { opacity: .6; filter: drop-shadow(0 0 3px #ff5a1f) drop-shadow(0 0 6px #7A1F2B) }
          50%     { opacity: .9; filter: drop-shadow(0 0 7px #ffb347) drop-shadow(0 0 12px #ff5a1f) }
        }
        @keyframes qa-eye-angry {
          0%,100% { opacity: .95; filter: drop-shadow(0 0 7px #ff3d1f) drop-shadow(0 0 14px #7A1F2B) }
          50%     { opacity: 1;  filter: drop-shadow(0 0 12px #ffb347) drop-shadow(0 0 22px #ff5a1f) }
        }

        /* ===== mandíbula ===== */
        @keyframes qa-jaw-drop {
          0%   { transform: translateY(0) }
          100% { transform: translateY(7px) }
        }
        @keyframes qa-jaw-open-angry {
          0%   { transform: translateY(0) }
          100% { transform: translateY(3px) }
        }

        /* ===== shake ===== */
        @keyframes qa-skull-shake {
          0%,100% { transform: translateX(0) }
          20%     { transform: translateX(-.5px) }
          40%     { transform: translateX(.5px) }
          60%     { transform: translateX(-.3px) }
          80%     { transform: translateX(.3px) }
        }

        /* ===== partículas ===== */
        @keyframes qa-particle-up {
          0%   { transform: translateY(0) scale(1); opacity: .9 }
          60%  { opacity: .5 }
          100% { transform: translateY(-22px) scale(.3); opacity: 0 }
        }
        @keyframes qa-particle-up-slow {
          0%   { transform: translateY(0) scale(1); opacity: .7 }
          50%  { opacity: .35 }
          100% { transform: translateY(-30px) scale(.2); opacity: 0 }
        }
        @keyframes qa-ember-drift {
          0%   { transform: translate(0,0) scale(1); opacity: .85 }
          50%  { transform: translate(3px,-12px) scale(.7); opacity: .5 }
          100% { transform: translate(-2px,-24px) scale(.2); opacity: 0 }
        }
        @keyframes qa-ember-drift-left {
          0%   { transform: translate(0,0) scale(1); opacity: .8 }
          50%  { transform: translate(-4px,-10px) scale(.65); opacity: .45 }
          100% { transform: translate(2px,-20px) scale(.15); opacity: 0 }
        }

        /* ===== active flash ===== */
        @keyframes qa-active-flash {
          0%   { opacity: 0 }
          20%  { opacity: .9 }
          100% { opacity: 0 }
        }

        /* classes */
        .qa-flame-idle-1 { transform-origin: 50% 100%; animation: qa-flame-rise 480ms ease-in-out infinite }
        .qa-flame-idle-2 { transform-origin: 50% 100%; animation: qa-flame-rise-alt 520ms ease-in-out infinite }
        .qa-flame-idle-3 { transform-origin: 50% 100%; animation: qa-flame-rise-fast 400ms ease-in-out infinite }

        .qa-flame-active-1 { transform-origin: 50% 100%; animation: qa-flame-burst 280ms ease-in-out infinite }
        .qa-flame-active-2 { transform-origin: 50% 100%; animation: qa-flame-surge-alt 260ms ease-in-out infinite }
        .qa-flame-active-3 { transform-origin: 50% 100%; animation: qa-flame-surge 320ms ease-in-out infinite }
        .qa-flame-active-4 { transform-origin: 50% 100%; animation: qa-flame-burst 240ms ease-in-out infinite }

        .qa-eye-flame { animation: qa-eye-glow 380ms ease-in-out infinite }
        .qa-eye-idle  { animation: qa-eye-glow-idle 700ms ease-in-out infinite }
        .qa-eye-angry { animation: qa-eye-angry 340ms ease-in-out infinite }

        .qa-jaw-hover  { animation: qa-jaw-drop 200ms ease-out forwards }
        .qa-jaw-angry  { animation: qa-jaw-open-angry 200ms ease-out forwards }
        .qa-skull-hover { animation: qa-skull-shake 600ms ease-in-out infinite }

        .qa-part-1 { animation: qa-particle-up 700ms ease-out infinite }
        .qa-part-2 { animation: qa-particle-up 850ms ease-out infinite 150ms }
        .qa-part-3 { animation: qa-particle-up-slow 1000ms ease-out infinite 300ms }
        .qa-ember-1 { animation: qa-ember-drift 900ms ease-out infinite }
        .qa-ember-2 { animation: qa-ember-drift-left 800ms ease-out infinite 200ms }
        .qa-ember-3 { animation: qa-ember-drift 750ms ease-out infinite 400ms }
      `}</style>

      <button
        type="button"
        onClick={() => { setState("active"); onClick(); }}
        onMouseEnter={() => setState("hover")}
        onMouseLeave={() => setState("idle")}
        onFocus={() => setState("hover")}
        onBlur={() => setState("idle")}
        aria-label="Abrir assistente de novos serviços"
        className="fixed bottom-6 right-6 z-[60] flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{
          background: "radial-gradient(circle at 30% 30%, #1a1a1a 0%, #050505 70%)",
          border: "2px solid #7A1F2B",
          boxShadow: isActive
            ? "0 0 36px rgba(255,60,31,.9), 0 0 72px rgba(255,140,31,.6), 0 0 100px rgba(255,180,71,.35), 0 8px 16px rgba(0,0,0,.5)"
            : isHover
            ? "0 0 28px rgba(255,90,31,.6), 0 0 56px rgba(255,140,31,.45), 0 0 80px rgba(255,180,71,.25), 0 8px 16px rgba(0,0,0,.4)"
            : "0 6px 18px rgba(0,0,0,.4)",
        }}
        title="Quer adquirir um novo serviço?"
      >
        <svg viewBox="0 0 64 80" width="48" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">

          {/* ═══════════════════════════════════════════════════════════════
             FOGOS
          ═══════════════════════════════════════════════════════════════ */}

          {/* ── Fogo na cabeça: IDLE (sempre visível, sutil) ── */}
          {(isIdle || isHover) && (
            <g>
              <path className="qa-flame-idle-1" d="M32 6 C28 14,24 18,26 24 C22 20,20 14,22 8 C24 14,28 12,32 6Z" fill="url(#qa-flame-grad)" opacity=".7" />
              <path className="qa-flame-idle-2" d="M38 8 C34 14,36 20,40 24 C44 18,44 12,42 6 C42 12,38 12,38 8Z" fill="url(#qa-flame-grad-2)" opacity=".6" />
              <path className="qa-flame-idle-3" d="M30 4 C28 10,32 16,30 22 C34 16,36 10,34 4 C34 8,30 8,30 4Z" fill="url(#qa-flame-grad-3)" opacity=".55" />
            </g>
          )}

          {/* ── Fogo na cabeça: ACTIVE (explosão completa) ── */}
          {isActive && (
            <g>
              <path className="qa-flame-active-1" d="M32 -2 C24 10,18 16,22 26 C14 22,10 12,16 2 C20 12,28 10,32 -2Z" fill="url(#qa-flame-grad)" />
              <path className="qa-flame-active-2" d="M44 0 C38 10,40 20,48 26 C54 18,54 10,48 -2 C48 10,42 10,44 0Z" fill="url(#qa-flame-grad-2)" />
              <path className="qa-flame-active-3" d="M28 -4 C24 6,30 14,26 24 C34 18,38 8,34 -4 C34 4,28 4,28 -4Z" fill="url(#qa-flame-grad-3)" />
              <path className="qa-flame-active-4" d="M36 -6 C32 4,38 12,34 22 C42 14,44 4,40 -6 C40 2,34 2,36 -6Z" fill="url(#qa-flame-grad-4)" />
              <path className="qa-flame-active-1" d="M32 -8 C28 0,30 10,32 20 C36 12,36 2,34 -8 C34 0,30 0,32 -8Z" fill="url(#qa-flame-grad-2)" />
              <path className="qa-flame-active-2" d="M18 8 C14 16,16 24,22 28 C12 24,8 16,14 6 C16 14,18 12,18 8Z" fill="url(#qa-flame-grad)" />
              <path className="qa-flame-active-3" d="M46 6 C50 14,48 22,42 28 C52 22,56 12,50 4 C48 12,46 10,46 6Z" fill="url(#qa-flame-grad-4)" />

              {/* Partículas subindo */}
              <circle className="qa-part-1" cx="28" cy="14" r="1.2" fill="#FFB347" />
              <circle className="qa-part-2" cx="36" cy="10" r="1" fill="#FF8C1F" />
              <circle className="qa-part-3" cx="32" cy="8" r=".8" fill="#FFF4C2" />
              <ellipse className="qa-ember-1" cx="24" cy="18" rx="1.5" ry=".8" fill="#FF5A1F" />
              <ellipse className="qa-ember-2" cx="40" cy="16" rx="1.2" ry=".6" fill="#FFB347" />
              <ellipse className="qa-ember-3" cx="32" cy="20" rx="1" ry=".5" fill="#FFF4C2" />
            </g>
          )}

          {/* ═══════════════════════════════════════════════════════════════
             CRÂNIO
          ═══════════════════════════════════════════════════════════════ */}
          <g className={isHover || isActive ? "qa-skull-hover" : ""}>
            {/* Cúpula */}
            <path
              d="M12 36 C12 22,22 14,32 14 C42 14,52 22,52 36 L52 46 C52 50,50 52,46 52 L18 52 C14 52,12 50,12 46Z"
              fill="#EDEDED"
              stroke="#0A0A0A"
              strokeWidth="1.2"
            />
            {/* Sombra lateral */}
            <path d="M14 38 C14 28,20 22,26 20 C18 24,16 32,16 40Z" fill="#C8C8C8" opacity=".5" />

            {/* Cavidades dos olhos */}
            <ellipse cx="23" cy="34" rx="6" ry="7" fill="#0A0A0A" />
            <ellipse cx="41" cy="34" rx="6" ry="7" fill="#0A0A0A" />

            {/* Glow de fundo nos olhos */}
            <ellipse cx="23" cy="34" rx="7" ry="8" fill="url(#qa-eye-glow-grad)" opacity={isActive ? ".7" : isHover ? ".55" : ".25"} />
            <ellipse cx="41" cy="34" rx="7" ry="8" fill="url(#qa-eye-glow-grad)" opacity={isActive ? ".7" : isHover ? ".55" : ".25"} />

            {/* ══ Olhos em chama (idle, hover, active) ══ */}
            {/* IDLE — chama sutil nos olhos */}
            {isIdle && (
              <g>
                <path className="qa-eye-idle" d="M19 36 C21 30,25 30,27 36 C26 38,24 39,23 36 C22 39,20 38,19 36Z" fill="url(#qa-eye-grad)" />
                <path className="qa-eye-idle" d="M37 36 C39 30,43 30,45 36 C44 38,42 39,41 36 C40 39,38 38,37 36Z" fill="url(#qa-eye-grad)" />
              </g>
            )}

            {/* HOVER — expressão BRAVA: sobrancelhas franzidas + olhos flamejantes + mandíbula leve */}
            {isHover && (
              <g>
                {/* Sobrancelhas franzidas (diagonais para baixo no centro) */}
                <path d="M16 28 L23 31 L29 28" stroke="#0A0A0A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                <path d="M48 28 L41 31 L35 28" stroke="#0A0A0A" strokeWidth="1.2" fill="none" strokeLinecap="round" />

                {/* Olhos flamejantes intensos */}
                <path className="qa-eye-angry" d="M19 36 C21 30,25 30,27 36 C26 38,24 39,23 36 C22 39,20 38,19 36Z" fill="url(#qa-eye-grad)" />
                <path className="qa-eye-angry" d="M37 36 C39 30,43 30,45 36 C44 38,42 39,41 36 C40 39,38 38,37 36Z" fill="url(#qa-eye-grad)" />

                {/* Chamas saindo dos olhos (hover = bravo) */}
                <path className="qa-flame-idle-2" d="M21 30 C20 24,22 20,24 18 C26 22,24 26,23 30Z" fill="url(#qa-eye-grad)" opacity=".85" />
                <path className="qa-flame-idle-3" d="M43 30 C44 24,42 20,40 18 C38 22,40 26,41 30Z" fill="url(#qa-eye-grad)" opacity=".85" />
              </g>
            )}

            {/* ACTIVE — olhos flamejantes máximos + chamas explodindo */}
            {isActive && (
              <g>
                <path className="qa-eye-flame" d="M19 36 C21 30,25 30,27 36 C26 38,24 39,23 36 C22 39,20 38,19 36Z" fill="url(#qa-eye-grad)" />
                <path className="qa-eye-flame" d="M37 36 C39 30,43 30,45 36 C44 38,42 39,41 36 C40 39,38 38,37 36Z" fill="url(#qa-eye-grad)" />
                <path className="qa-flame-active-2" d="M21 30 C20 22,22 18,24 14 C26 20,24 26,23 30Z" fill="url(#qa-eye-grad)" opacity=".9" />
                <path className="qa-flame-active-3" d="M43 30 C44 22,42 18,40 14 C38 20,40 26,41 30Z" fill="url(#qa-eye-grad)" opacity=".9" />
              </g>
            )}

            {/* Nariz */}
            <path d="M32 38 L29 46 L32 48 L35 46Z" fill="#0A0A0A" />

            {/* Linha das bochechas */}
            <path d="M16 46 Q32 50 48 46" stroke="#0A0A0A" strokeWidth=".8" fill="none" opacity=".4" />
          </g>

          {/* ═══════════════════════════════════════════════════════════════
             MANDÍBULA
          ═══════════════════════════════════════════════════════════════ */}
          <g className={isActive ? "qa-jaw-hover" : isHover ? "qa-jaw-angry" : ""}>
            <path
              d="M18 52 L18 58 C18 64,22 68,28 68 L36 68 C42 68,46 64,46 58 L46 52Z"
              fill="#EDEDED"
              stroke="#0A0A0A"
              strokeWidth="1.2"
            />
            {/* Dentes superiores */}
            <g stroke="#0A0A0A" strokeWidth=".6">
              <line x1="22" y1="52" x2="22" y2="56" />
              <line x1="26" y1="52" x2="26" y2="56" />
              <line x1="30" y1="52" x2="30" y2="56" />
              <line x1="34" y1="52" x2="34" y2="56" />
              <line x1="38" y1="52" x2="38" y2="56" />
              <line x1="42" y1="52" x2="42" y2="56" />
            </g>
            {/* Boca interna escura quando aberta */}
            {(isHover || isActive) && (
              <rect x="22" y={isActive ? "56" : "54"} width="20" height={isActive ? "6" : "4"} fill="#0A0A0A" rx="1" />
            )}
          </g>

          {/* ═══════════════════════════════════════════════════════════════
             GRADIENTES
          ═══════════════════════════════════════════════════════════════ */}
          <defs>
            <linearGradient id="qa-flame-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#7A1F2B" />
              <stop offset="30%" stopColor="#FF3D1F" />
              <stop offset="70%" stopColor="#FFB347" />
              <stop offset="100%" stopColor="#FFF4C2" />
            </linearGradient>
            <linearGradient id="qa-flame-grad-2" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#FF5A1F" />
              <stop offset="50%" stopColor="#FFB347" />
              <stop offset="100%" stopColor="#FFF8DC" />
            </linearGradient>
            <linearGradient id="qa-flame-grad-3" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#B8301F" />
              <stop offset="60%" stopColor="#FF8C1F" />
              <stop offset="100%" stopColor="#FFE4B5" />
            </linearGradient>
            <linearGradient id="qa-flame-grad-4" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#FF5A1F" />
              <stop offset="40%" stopColor="#FFD700" />
              <stop offset="100%" stopColor="#FFFACD" />
            </linearGradient>
            <radialGradient id="qa-eye-grad" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stopColor="#FFF4C2" />
              <stop offset="40%" stopColor="#FF8C1F" />
              <stop offset="100%" stopColor="#7A1F2B" />
            </radialGradient>
            <radialGradient id="qa-eye-glow-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF5A1F" stopOpacity=".8" />
              <stop offset="60%" stopColor="#7A1F2B" stopOpacity=".3" />
              <stop offset="100%" stopColor="#7A1F2B" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </button>
    </>
  );
}
