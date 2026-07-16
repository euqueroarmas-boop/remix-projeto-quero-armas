import { CSSProperties } from "react";

export type ArsenalInteligenteLogoProps = {
  orientation?: "horizontal" | "vertical";
  color?: "burgundy" | "black" | "white";
  showWordmark?: boolean;
  className?: string;
  symbolClassName?: string;
  wordmarkClassName?: string;
};

const COLORS: Record<NonNullable<ArsenalInteligenteLogoProps["color"]>, string> = {
  burgundy: "#7A1F2B",
  black: "#0A0A0A",
  white: "#FFFFFF",
};

/**
 * Monograma "AI" oficial do Arsenal Inteligente.
 * - A: haste esquerda diagonal longa, haste direita vertical robusta,
 *   barra horizontal curta entrando pelo lado esquerdo.
 * - I: barra vertical independente com espessura igual à haste direita do A.
 * Sem cérebro, circuitos, escudo, alvo, arma, cadeado, etc.
 */
function ArsenalSymbol({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 200 180"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Haste esquerda diagonal do A */}
      <polygon points="0,175 40,175 92,15 60,15" fill="currentColor" />
      {/* Haste direita vertical do A */}
      <rect x="92" y="15" width="30" height="160" fill="currentColor" />
      {/* Barra horizontal curta do A (entra pelo lado esquerdo) */}
      <rect x="46" y="102" width="46" height="18" fill="currentColor" />
      {/* Letra I — barra vertical independente */}
      <rect x="155" y="15" width="30" height="160" fill="currentColor" />
    </svg>
  );
}

export function ArsenalInteligenteLogo({
  orientation = "horizontal",
  color = "burgundy",
  showWordmark = true,
  className,
  symbolClassName,
  wordmarkClassName,
}: ArsenalInteligenteLogoProps) {
  const tone = COLORS[color];
  const isHorizontal = orientation === "horizontal";

  const rootStyle: CSSProperties = {
    color: tone,
    display: "inline-flex",
    alignItems: "center",
    flexDirection: isHorizontal ? "row" : "column",
    gap: isHorizontal ? "1.75rem" : "1rem",
    lineHeight: 1,
  };

  const symbolStyle: CSSProperties = {
    height: isHorizontal ? "3.25rem" : "4.5rem",
    width: "auto",
    display: "block",
    color: tone,
    flexShrink: 0,
  };

  const wordmarkStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: isHorizontal ? "flex-start" : "center",
    color: tone,
  };

  const arsenalStyle: CSSProperties = {
    fontFamily: '"Montserrat", sans-serif',
    fontWeight: 500,
    fontSize: isHorizontal ? "1.5rem" : "1.4rem",
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    lineHeight: 1,
    whiteSpace: "nowrap",
    color: tone,
  };

  const inteligenteStyle: CSSProperties = {
    fontFamily: '"Montserrat", sans-serif',
    fontWeight: 400,
    fontSize: isHorizontal ? "0.72rem" : "0.68rem",
    letterSpacing: "0.42em",
    textTransform: "uppercase",
    lineHeight: 1,
    marginTop: "0.55rem",
    whiteSpace: "nowrap",
    color: tone,
    // largura visual aproximada à de ARSENAL
    alignSelf: "stretch",
    textAlign: isHorizontal ? "left" : "center",
  };

  return (
    <div
      className={className}
      style={rootStyle}
      role={showWordmark ? "img" : undefined}
      aria-label={showWordmark ? "Arsenal Inteligente" : undefined}
      aria-hidden={showWordmark ? undefined : true}
    >
      <ArsenalSymbol className={symbolClassName} style={symbolStyle} />
      {showWordmark && (
        <div className={wordmarkClassName} style={wordmarkStyle}>
          <span style={arsenalStyle}>ARSENAL</span>
          <span style={inteligenteStyle}>INTELIGENTE</span>
        </div>
      )}
    </div>
  );
}

export default ArsenalInteligenteLogo;