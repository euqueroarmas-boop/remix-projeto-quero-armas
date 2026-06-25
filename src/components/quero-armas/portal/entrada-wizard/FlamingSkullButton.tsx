import { useState, useEffect } from "react";
import skullImg from "@/assets/flaming-skull-ghost-rider.png";

/**
 * FlamingSkullButton — botão flutuante (bottom-right) que abre o Assistente
 * de Novos Serviços. Usa a imagem realista do crânio em chamas estilo
 * Motoqueiro Fantasma, com animações sutis (flicker, glow, shake, pulse).
 */
export default function FlamingSkullButton({ onClick }: { onClick: () => void }) {
  type State = "idle" | "hover" | "active";
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (state !== "active") return;
    const t = setTimeout(() => setState("idle"), 700);
    return () => clearTimeout(t);
  }, [state]);

  const isHover = state === "hover";
  const isActive = state === "active";

  return (
    <>
      <style>{`
        @keyframes qa-skull-flicker {
          0%,100% { filter: drop-shadow(0 0 6px rgba(255,90,31,.55)) drop-shadow(0 0 14px rgba(255,140,31,.35)); }
          40%     { filter: drop-shadow(0 0 10px rgba(255,140,31,.75)) drop-shadow(0 0 22px rgba(255,90,31,.5)); }
          70%     { filter: drop-shadow(0 0 5px rgba(255,60,31,.45)) drop-shadow(0 0 12px rgba(255,90,31,.3)); }
        }
        @keyframes qa-skull-flicker-hover {
          0%,100% { filter: drop-shadow(0 0 12px rgba(255,140,31,.85)) drop-shadow(0 0 26px rgba(255,200,71,.55)) drop-shadow(0 0 40px rgba(255,90,31,.4)); }
          30%     { filter: drop-shadow(0 0 18px rgba(255,200,71,1)) drop-shadow(0 0 36px rgba(255,140,31,.7)) drop-shadow(0 0 54px rgba(255,60,31,.5)); }
          60%     { filter: drop-shadow(0 0 10px rgba(255,90,31,.7)) drop-shadow(0 0 22px rgba(255,140,31,.5)) drop-shadow(0 0 36px rgba(255,200,71,.35)); }
        }
        @keyframes qa-skull-flicker-active {
          0%   { filter: drop-shadow(0 0 26px rgba(255,240,180,1)) drop-shadow(0 0 50px rgba(255,140,31,.9)) drop-shadow(0 0 72px rgba(255,60,31,.6)); transform: scale(1.18); }
          50%  { filter: drop-shadow(0 0 34px rgba(255,255,210,1)) drop-shadow(0 0 60px rgba(255,180,71,.95)) drop-shadow(0 0 90px rgba(255,90,31,.7)); transform: scale(1.22); }
          100% { filter: drop-shadow(0 0 20px rgba(255,200,71,.85)) drop-shadow(0 0 40px rgba(255,140,31,.7)); transform: scale(1.1); }
        }
        @keyframes qa-skull-shake {
          0%,100% { transform: translate(0,0) rotate(0) }
          20%     { transform: translate(-.6px,.4px) rotate(-.6deg) }
          40%     { transform: translate(.5px,-.3px) rotate(.5deg) }
          60%     { transform: translate(-.4px,.3px) rotate(-.4deg) }
          80%     { transform: translate(.3px,-.5px) rotate(.4deg) }
        }
        @keyframes qa-skull-breathe {
          0%,100% { transform: scale(1) }
          50%     { transform: scale(1.025) }
        }
        @keyframes qa-aura-pulse {
          0%,100% { opacity: .55; transform: scale(1) }
          50%     { opacity: .9;  transform: scale(1.1) }
        }
        @keyframes qa-aura-burst {
          0%   { opacity: 1;   transform: scale(.9) }
          60%  { opacity: .85; transform: scale(1.45) }
          100% { opacity: 0;   transform: scale(1.7) }
        }

        .qa-skull-idle   { animation: qa-skull-flicker 2200ms ease-in-out infinite, qa-skull-breathe 3600ms ease-in-out infinite; }
        .qa-skull-hover  { animation: qa-skull-flicker-hover 700ms ease-in-out infinite, qa-skull-shake 380ms ease-in-out infinite; }
        .qa-skull-active { animation: qa-skull-flicker-active 700ms ease-out forwards; }

        .qa-aura-idle  { animation: qa-aura-pulse 2400ms ease-in-out infinite; }
        .qa-aura-hover { animation: qa-aura-pulse 900ms  ease-in-out infinite; }
        .qa-aura-burst { animation: qa-aura-burst 700ms ease-out forwards; }
      `}</style>

      <button
        type="button"
        onClick={() => { setState("active"); onClick(); }}
        onMouseEnter={() => setState("hover")}
        onMouseLeave={() => setState("idle")}
        onFocus={() => setState("hover")}
        onBlur={() => setState("idle")}
        aria-label="Abrir assistente de novos serviços"
        title="Quer adquirir um novo serviço?"
        className="fixed bottom-6 right-6 z-[60] flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 focus:outline-none"
        style={{ background: "transparent", border: "none", padding: 0 }}
      >
        <span
          aria-hidden
          className={
            "absolute inset-[-18%] rounded-full pointer-events-none " +
            (isActive ? "qa-aura-burst" : isHover ? "qa-aura-hover" : "qa-aura-idle")
          }
          style={{
            background:
              "radial-gradient(circle at 50% 55%, rgba(255,200,71,.55) 0%, rgba(255,90,31,.4) 35%, rgba(122,31,43,.25) 60%, rgba(0,0,0,0) 75%)",
            filter: "blur(2px)",
          }}
        />
        <img
          src={skullImg}
          alt=""
          width={88}
          height={88}
          loading="lazy"
          draggable={false}
          className={
            "relative h-[88px] w-[88px] object-contain select-none " +
            (isActive ? "qa-skull-active" : isHover ? "qa-skull-hover" : "qa-skull-idle")
          }
          style={{ transformOrigin: "50% 60%" }}
        />
      </button>
    </>
  );
}