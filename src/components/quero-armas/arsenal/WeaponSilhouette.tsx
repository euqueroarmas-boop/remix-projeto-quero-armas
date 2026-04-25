import { WeaponKind } from "./utils";

/**
 * Silhuetas SVG estilizadas (blueprint tático) por categoria de arma.
 * Sem fotos reais — composição vetorial elegante para uso na bancada.
 * As silhuetas são aproximadas, focadas em sugerir formato/proporção.
 */

interface Props {
  kind: WeaponKind;
  className?: string;
  accent?: string;
}

const STROKE = "currentColor";

function Pistola({ accent = "currentColor" }: { accent?: string }) {
  return (
    <svg viewBox="0 0 320 140" className="w-full h-full">
      <defs>
        <linearGradient id="pgrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.18" />
          <stop offset="1" stopColor={accent} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Slide */}
      <rect x="40" y="40" width="220" height="34" rx="6" fill="url(#pgrad)" stroke={STROKE} strokeWidth="1.2" />
      <line x1="60" y1="48" x2="240" y2="48" stroke={STROKE} strokeOpacity="0.4" strokeWidth="0.8" />
      {/* Mira */}
      <rect x="246" y="34" width="10" height="8" fill={STROKE} />
      <rect x="58" y="34" width="6" height="8" fill={STROKE} />
      {/* Cano */}
      <rect x="252" y="58" width="20" height="10" fill={STROKE} fillOpacity="0.6" />
      {/* Empunhadura */}
      <path d="M 90 74 L 70 130 L 150 130 L 165 74 Z" fill="url(#pgrad)" stroke={STROKE} strokeWidth="1.2" />
      {/* Trigger */}
      <circle cx="155" cy="82" r="10" fill="none" stroke={STROKE} strokeWidth="1.2" />
      <line x1="148" y1="82" x2="160" y2="86" stroke={STROKE} strokeWidth="1.2" />
      {/* Magazine */}
      <rect x="98" y="100" width="44" height="32" rx="2" fill={STROKE} fillOpacity="0.15" stroke={STROKE} strokeWidth="0.8" />
    </svg>
  );
}

function Revolver({ accent = "currentColor" }: { accent?: string }) {
  return (
    <svg viewBox="0 0 320 140" className="w-full h-full">
      <defs>
        <linearGradient id="rgrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.2" />
          <stop offset="1" stopColor={accent} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Cano */}
      <rect x="160" y="56" width="120" height="14" fill="url(#rgrad)" stroke={STROKE} strokeWidth="1.2" />
      {/* Tambor */}
      <circle cx="140" cy="68" r="28" fill="url(#rgrad)" stroke={STROKE} strokeWidth="1.2" />
      <circle cx="140" cy="68" r="6" fill="none" stroke={STROKE} strokeWidth="0.8" />
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const r = 18;
        const x = 140 + r * Math.cos((deg * Math.PI) / 180);
        const y = 68 + r * Math.sin((deg * Math.PI) / 180);
        return <circle key={deg} cx={x} cy={y} r={3} fill={STROKE} fillOpacity="0.7" />;
      })}
      {/* Empunhadura */}
      <path d="M 110 86 L 90 132 L 145 132 L 152 90 Z" fill="url(#rgrad)" stroke={STROKE} strokeWidth="1.2" />
      <circle cx="148" cy="84" r="9" fill="none" stroke={STROKE} strokeWidth="1.1" />
      {/* Mira */}
      <rect x="266" y="50" width="6" height="8" fill={STROKE} />
    </svg>
  );
}

function ArmaLonga({ accent = "currentColor", short = false }: { accent?: string; short?: boolean }) {
  // Genérico para carabina / fuzil / espingarda
  const len = short ? 220 : 290;
  return (
    <svg viewBox="0 0 320 100" className="w-full h-full">
      <defs>
        <linearGradient id="lgrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.18" />
          <stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {/* Coronha */}
      <path d="M 8 36 L 60 32 L 60 64 L 8 60 Z" fill="url(#lgrad)" stroke={STROKE} strokeWidth="1.2" />
      {/* Receiver */}
      <rect x="60" y="36" width="80" height="28" rx="2" fill="url(#lgrad)" stroke={STROKE} strokeWidth="1.2" />
      {/* Trilho picatinny */}
      <rect x="62" y="30" width="76" height="6" fill={STROKE} fillOpacity="0.35" />
      {Array.from({ length: 14 }).map((_, i) => (
        <line key={i} x1={64 + i * 5} y1="30" x2={64 + i * 5} y2="36" stroke={STROKE} strokeWidth="0.4" />
      ))}
      {/* Cano + handguard */}
      <rect x="140" y="42" width={len - 140} height="16" fill="url(#lgrad)" stroke={STROKE} strokeWidth="1.2" />
      <rect x={len - 18} y="46" width="18" height="8" fill={STROKE} fillOpacity="0.6" />
      {/* Trigger guard */}
      <rect x="78" y="66" width="22" height="10" rx="3" fill="none" stroke={STROKE} strokeWidth="1.1" />
      <line x1="86" y1="66" x2="90" y2="74" stroke={STROKE} strokeWidth="1.1" />
      {/* Magazine */}
      <rect x="100" y="64" width="22" height="22" rx="2" fill={STROKE} fillOpacity="0.18" stroke={STROKE} strokeWidth="0.8" />
      {/* Mira */}
      <rect x="156" y="22" width="20" height="10" fill="none" stroke={STROKE} strokeWidth="1" />
      <line x1="166" y1="22" x2="166" y2="32" stroke={STROKE} strokeWidth="0.8" />
    </svg>
  );
}

function Espingarda({ accent = "currentColor" }: { accent?: string }) {
  return (
    <svg viewBox="0 0 320 100" className="w-full h-full">
      <defs>
        <linearGradient id="egrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.16" />
          <stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d="M 6 44 L 70 38 L 70 62 L 6 56 Z" fill="url(#egrad)" stroke={STROKE} strokeWidth="1.2" />
      <rect x="70" y="42" width="60" height="16" fill="url(#egrad)" stroke={STROKE} strokeWidth="1.2" />
      <rect x="130" y="44" width="170" height="12" fill="url(#egrad)" stroke={STROKE} strokeWidth="1.2" />
      <rect x="298" y="46" width="14" height="8" fill={STROKE} fillOpacity="0.6" />
      {/* Pump */}
      <rect x="160" y="58" width="50" height="14" rx="3" fill={STROKE} fillOpacity="0.18" stroke={STROKE} strokeWidth="0.8" />
      <rect x="98" y="62" width="22" height="10" rx="3" fill="none" stroke={STROKE} strokeWidth="1.1" />
    </svg>
  );
}

export function WeaponSilhouette({ kind, className, accent = "hsl(190 80% 45%)" }: Props) {
  return (
    <div className={className} style={{ color: accent }}>
      {kind === "pistola" && <Pistola accent={accent} />}
      {kind === "revolver" && <Revolver accent={accent} />}
      {kind === "espingarda" && <Espingarda accent={accent} />}
      {kind === "carabina" && <ArmaLonga accent={accent} short />}
      {kind === "fuzil" && <ArmaLonga accent={accent} />}
      {kind === "submetralhadora" && <ArmaLonga accent={accent} short />}
      {kind === "outra" && <ArmaLonga accent={accent} />}
    </div>
  );
}