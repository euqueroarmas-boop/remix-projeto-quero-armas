/**
 * Logo oficial do Arsenal Inteligente — Modelo 08.
 *
 * Cor institucional bordô #6B1229. Nunca recolorizar fora desse tom nem
 * distorcer proporções. Duas variantes:
 *
 *  - <ArsenalLogo />        → horizontal (símbolo "AI" + wordmark em linha)
 *                             Uso: cabeçalhos, navbar, sidebar do portal.
 *  - <ArsenalLogoMark />    → vertical/ícone (símbolo acima + wordmark abaixo)
 *                             Uso: splash screen, ícone de app,
 *                             card de assinatura Premium.
 */

export const ARSENAL_BRAND_COLOR = "#6B1229";

interface LogoProps {
  className?: string;
  color?: string;
  title?: string;
  /** Altura em px. Largura é derivada mantendo a proporção. */
  height?: number;
}

/** Símbolo "AI": A geométrica com corte diagonal + barra vertical separadora. */
function AISymbol({ color }: { color: string }) {
  return (
    <g fill={color}>
      {/* A geométrica com corte diagonal interno */}
      <path d="M4 92 L44 8 L84 92 L66 92 L58 74 L30 74 L22 92 Z M36 60 L52 60 L44 42 Z" />
      {/* Barra vertical separadora ("I") */}
      <rect x="100" y="8" width="14" height="84" />
    </g>
  );
}

/** Wordmark "ARSENAL / INTELIGENTE" — sans-serif, all-caps, espacejado. */
function Wordmark({
  color,
  align = "start",
}: {
  color: string;
  align?: "start" | "middle";
}) {
  const family =
    '"Inter", "Helvetica Neue", "Arial", system-ui, -apple-system, sans-serif';
  return (
    <g fill={color} textAnchor={align} fontFamily={family}>
      <text
        x={align === "middle" ? "50%" : 0}
        y="44"
        fontSize="46"
        fontWeight={700}
        letterSpacing="4"
      >
        ARSENAL
      </text>
      <text
        x={align === "middle" ? "50%" : 0}
        y="82"
        fontSize="22"
        fontWeight={400}
        letterSpacing="7"
      >
        INTELIGENTE
      </text>
    </g>
  );
}

/** Horizontal — símbolo à esquerda, wordmark à direita. */
export function ArsenalLogo({
  className,
  color = ARSENAL_BRAND_COLOR,
  title = "Arsenal Inteligente",
  height,
}: LogoProps) {
  // viewBox 460 × 100 → proporção ~4.6:1
  const style = height ? { height, width: "auto" } : undefined;
  return (
    <svg
      viewBox="0 0 460 100"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <AISymbol color={color} />
      <g transform="translate(150 0)">
        <Wordmark color={color} align="start" />
      </g>
    </svg>
  );
}

/** Vertical — símbolo centralizado acima, wordmark centralizado abaixo. */
export function ArsenalLogoMark({
  className,
  color = ARSENAL_BRAND_COLOR,
  title = "Arsenal Inteligente",
  height,
}: LogoProps) {
  // viewBox 240 × 220 → proporção ~1.1:1
  const style = height ? { height, width: "auto" } : undefined;
  return (
    <svg
      viewBox="0 0 240 220"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <g transform="translate(63 0)">
        <AISymbol color={color} />
      </g>
      <g transform="translate(0 110)">
        <Wordmark color={color} align="middle" />
      </g>
    </svg>
  );
}

export default ArsenalLogo;