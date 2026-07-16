import arsenalHorizontalAsset from "@/assets/branding/arsenal-inteligente-horizontal.png.asset.json";
import arsenalVerticalAsset from "@/assets/branding/arsenal-inteligente-vertical.png.asset.json";
import arsenalSymbolAsset from "@/assets/branding/arsenal-inteligente-symbol.png.asset.json";

export type ArsenalInteligenteLogoProps = {
  orientation?: "horizontal" | "vertical";
  color?: "burgundy" | "black" | "white";
  showWordmark?: boolean;
  className?: string;
  symbolClassName?: string;
  wordmarkClassName?: string;
};

// Arte oficial MODELO 08 (bordô #7A1F2B) — fonte de verdade canônica.
// Filtros CSS produzem as variantes preto/branco a partir do mesmo asset.
const ART = {
  horizontal: arsenalHorizontalAsset.url,
  vertical: arsenalVerticalAsset.url,
  symbol: arsenalSymbolAsset.url,
} as const;

function colorFilter(color: NonNullable<ArsenalInteligenteLogoProps["color"]>) {
  if (color === "black") return "grayscale(1) brightness(0)";
  if (color === "white") return "grayscale(1) brightness(0) invert(1)";
  return undefined; // burgundy (arte original)
}

export function ArsenalInteligenteLogo({
  orientation = "horizontal",
  color = "burgundy",
  showWordmark = true,
  className,
  symbolClassName,
  wordmarkClassName: _wordmarkClassName,
}: ArsenalInteligenteLogoProps) {
  const src = !showWordmark ? ART.symbol : orientation === "vertical" ? ART.vertical : ART.horizontal;
  return (
    <div
      className={className}
      role="img"
      aria-label="Arsenal Inteligente"
      style={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}
    >
      <img
        src={src}
        alt="Arsenal Inteligente"
        className={symbolClassName}
        style={{
          width: "auto",
          height: "auto",
          maxWidth: "100%",
          display: "block",
          filter: colorFilter(color),
        }}
        draggable={false}
      />
    </div>
  );
}

export default ArsenalInteligenteLogo;