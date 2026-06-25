import { useState } from "react";

/**
 * FlamingSkullButton — botão flutuante (bottom-right) que abre o Assistente
 * de Novos Serviços. Crânio em SVG puro; no hover: mandíbula abre, olhos
 * acendem chamas e o crânio ganha fogo na cabeça (estilo Motoqueiro Fantasma).
 * Zero IA, zero <img>. Só SVG + keyframes inline.
 */
export default function FlamingSkullButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);

  return (
    <>
      <style>{`
        @keyframes qa-flame-flicker {
          0%,100% { transform: scaleY(1) translateY(0); opacity: .95 }
          50%     { transform: scaleY(1.15) translateY(-2px); opacity: 1 }
        }
        @keyframes qa-flame-flicker-alt {
          0%,100% { transform: scaleY(.95) translateY(1px); opacity: .85 }
          50%     { transform: scaleY(1.2) translateY(-3px); opacity: 1 }
        }
        @keyframes qa-eye-pulse {
          0%,100% { opacity: .9; filter: drop-shadow(0 0 4px #ff5a1f) }
          50%     { opacity: 1;  filter: drop-shadow(0 0 10px #ffb347) }
        }
        @keyframes qa-jaw-drop {
          0%   { transform: translateY(0) }
          100% { transform: translateY(6px) }
        }
        .qa-flame-1 { transform-origin: 50% 100%; animation: qa-flame-flicker 380ms ease-in-out infinite }
        .qa-flame-2 { transform-origin: 50% 100%; animation: qa-flame-flicker-alt 320ms ease-in-out infinite }
        .qa-eye-flame { animation: qa-eye-pulse 420ms ease-in-out infinite }
        .qa-jaw-hover { animation: qa-jaw-drop 220ms ease-out forwards }
      `}</style>

      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label="Abrir assistente de novos serviços"
        className="fixed bottom-6 right-6 z-[60] flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{
          background: "radial-gradient(circle at 30% 30%, #1a1a1a 0%, #050505 70%)",
          border: "2px solid #7A1F2B",
          boxShadow: hover
            ? "0 0 24px rgba(255,90,31,.55), 0 0 48px rgba(255,180,71,.35), 0 8px 16px rgba(0,0,0,.4)"
            : "0 6px 18px rgba(0,0,0,.4)",
        }}
        title="Quer adquirir um novo serviço?"
      >
        <svg viewBox="0 0 64 80" width="48" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* ── Fogo na cabeça (só visível no hover) ─────────────────────── */}
          {hover && (
            <g>
              <path
                className="qa-flame-1"
                d="M32 4 C 26 14, 22 18, 24 26 C 18 22, 16 14, 20 6 C 22 14, 28 12, 32 4 Z"
                fill="url(#qa-flame-grad)"
              />
              <path
                className="qa-flame-2"
                d="M40 6 C 36 14, 38 20, 44 24 C 48 18, 48 12, 44 4 C 44 12, 40 12, 40 6 Z"
                fill="url(#qa-flame-grad)"
              />
              <path
                className="qa-flame-1"
                d="M32 0 C 30 8, 34 14, 32 22 C 36 18, 38 10, 36 2 C 36 8, 32 6, 32 0 Z"
                fill="url(#qa-flame-grad-2)"
              />
            </g>
          )}

          {/* ── Crânio ───────────────────────────────────────────────────── */}
          <g>
            {/* Cúpula craniana */}
            <path
              d="M12 36 C 12 22, 22 14, 32 14 C 42 14, 52 22, 52 36 L 52 46 C 52 50, 50 52, 46 52 L 18 52 C 14 52, 12 50, 12 46 Z"
              fill="#EDEDED"
              stroke="#0A0A0A"
              strokeWidth="1.2"
            />
            {/* Sombra lateral */}
            <path d="M14 38 C 14 28, 20 22, 26 20 C 18 24, 16 32, 16 40 Z" fill="#C8C8C8" opacity=".5" />

            {/* Cavidades dos olhos */}
            <ellipse cx="23" cy="34" rx="6" ry="7" fill="#0A0A0A" />
            <ellipse cx="41" cy="34" rx="6" ry="7" fill="#0A0A0A" />

            {/* Olhos em chamas (hover) ou pontos brancos (estado normal) */}
            {hover ? (
              <>
                <path
                  className="qa-eye-flame"
                  d="M19 36 C 21 30, 25 30, 27 36 C 26 38, 24 39, 23 36 C 22 39, 20 38, 19 36 Z"
                  fill="url(#qa-eye-grad)"
                />
                <path
                  className="qa-eye-flame"
                  d="M37 36 C 39 30, 43 30, 45 36 C 44 38, 42 39, 41 36 C 40 39, 38 38, 37 36 Z"
                  fill="url(#qa-eye-grad)"
                />
              </>
            ) : (
              <>
                <circle cx="23" cy="34" r="1.5" fill="#7A1F2B" />
                <circle cx="41" cy="34" r="1.5" fill="#7A1F2B" />
              </>
            )}

            {/* Nariz */}
            <path d="M32 38 L 29 46 L 32 48 L 35 46 Z" fill="#0A0A0A" />

            {/* Linha das bochechas */}
            <path d="M16 46 Q 32 50 48 46" stroke="#0A0A0A" strokeWidth=".8" fill="none" opacity=".4" />
          </g>

          {/* ── Mandíbula (desce no hover) ───────────────────────────────── */}
          <g className={hover ? "qa-jaw-hover" : ""}>
            <path
              d="M18 52 L 18 58 C 18 64, 22 68, 28 68 L 36 68 C 42 68, 46 64, 46 58 L 46 52 Z"
              fill="#EDEDED"
              stroke="#0A0A0A"
              strokeWidth="1.2"
            />
            {/* Dentes superiores (fixos no crânio, aparecem quando mandíbula desce) */}
            <g stroke="#0A0A0A" strokeWidth=".6">
              <line x1="22" y1="52" x2="22" y2="56" />
              <line x1="26" y1="52" x2="26" y2="56" />
              <line x1="30" y1="52" x2="30" y2="56" />
              <line x1="34" y1="52" x2="34" y2="56" />
              <line x1="38" y1="52" x2="38" y2="56" />
              <line x1="42" y1="52" x2="42" y2="56" />
            </g>
            {/* Boca interna escura quando aberta */}
            {hover && (
              <rect x="22" y="56" width="20" height="6" fill="#0A0A0A" rx="1" />
            )}
          </g>

          {/* ── Gradientes ───────────────────────────────────────────────── */}
          <defs>
            <linearGradient id="qa-flame-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#7A1F2B" />
              <stop offset="40%" stopColor="#FF5A1F" />
              <stop offset="80%" stopColor="#FFB347" />
              <stop offset="100%" stopColor="#FFF4C2" />
            </linearGradient>
            <linearGradient id="qa-flame-grad-2" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#FF5A1F" />
              <stop offset="60%" stopColor="#FFB347" />
              <stop offset="100%" stopColor="#FFF8DC" />
            </linearGradient>
            <radialGradient id="qa-eye-grad" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stopColor="#FFF4C2" />
              <stop offset="50%" stopColor="#FF8C1F" />
              <stop offset="100%" stopColor="#7A1F2B" />
            </radialGradient>
          </defs>
        </svg>
      </button>
    </>
  );
}