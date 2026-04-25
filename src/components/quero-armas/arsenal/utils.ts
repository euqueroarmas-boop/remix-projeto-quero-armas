/**
 * Utilitários do Arsenal Inteligente.
 * Inferência de tipo de arma a partir do nome/modelo, classificação de calibre
 * e paleta tática reutilizável.
 */

export type WeaponKind =
  | "pistola"
  | "revolver"
  | "espingarda"
  | "carabina"
  | "fuzil"
  | "submetralhadora"
  | "outra";

export interface WeaponInfo {
  kind: WeaponKind;
  label: string;
  calibre: string | null;
  marca: string | null;
  modelo: string | null;
}

const NORM = (s: string) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const KIND_HINTS: { kind: WeaponKind; tokens: string[] }[] = [
  { kind: "pistola", tokens: ["PISTOLA", "GLOCK", "TAURUS PT", "TH9", "TH40", "TH380", "G2C", "G3C", "M&P", "BERETTA", "1911", "P226", "P320", "P226", "PT840", "TX22", "G17", "G19", "G22", "G25", "G26"] },
  { kind: "revolver", tokens: ["REVOLVER", "RT", "RT85", "RT605", "RT82", "ROSSI"] },
  { kind: "espingarda", tokens: ["ESPINGARDA", "PUMP", "CALIBRE 12", "CAL 12", "MOSSBERG", "ST12"] },
  { kind: "carabina", tokens: ["CARABINA", "CT", "CTT", "T4", "PCC", "CTM-R", ".22 LR", "22LR"] },
  { kind: "fuzil", tokens: ["FUZIL", "AR15", "AR-15", "AR10", "AR-10", "T4", "M4", ".223", ".308", "7.62"] },
  { kind: "submetralhadora", tokens: ["SUB", "SMG", "MP5", "UZI"] },
];

export function inferWeaponKind(...inputs: (string | null | undefined)[]): WeaponKind {
  const blob = NORM(inputs.filter(Boolean).join(" "));
  for (const h of KIND_HINTS) {
    if (h.tokens.some((t) => blob.includes(NORM(t)))) return h.kind;
  }
  if (/PT\s?\d/.test(blob) || /\bG\d{2}\b/.test(blob)) return "pistola";
  if (/\b22\b|\b22LR\b|\b\.22\b/.test(blob)) return "carabina";
  return "outra";
}

const CALIBRE_REGEX =
  /(\.?\s?9\s?MM|\.380|\.40|\.357|\.38|\.45|\.22\s?LR|\.22|\.223|\.308|\.44|7\.62|5\.56|CAL\.?\s?12|CALIBRE\s?12|12\s?GA)/i;

export function extractCalibre(...inputs: (string | null | undefined)[]): string | null {
  const blob = inputs.filter(Boolean).join(" ");
  const m = blob.match(CALIBRE_REGEX);
  if (!m) return null;
  const raw = m[0].toUpperCase().replace(/\s+/g, "");
  if (raw.includes("CALIBRE12") || raw.includes("CAL.12") || raw.includes("CAL12") || raw.includes("12GA")) return "CAL .12";
  if (raw.includes("9MM") || raw === ".9MM") return "9MM";
  return raw.startsWith(".") ? raw : raw;
}

export function extractMarcaModelo(nome: string | null | undefined): { marca: string | null; modelo: string | null } {
  if (!nome) return { marca: null, modelo: null };
  const cleaned = nome.replace(CALIBRE_REGEX, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { marca: null, modelo: null };
  if (parts.length === 1) return { marca: parts[0], modelo: null };
  return { marca: parts[0], modelo: parts.slice(1).join(" ") };
}

export function buildWeaponInfo(nomeArma: string | null | undefined, hint?: string | null): WeaponInfo {
  const calibre = extractCalibre(nomeArma, hint);
  const { marca, modelo } = extractMarcaModelo(nomeArma);
  const kind = inferWeaponKind(nomeArma, hint);
  return {
    kind,
    label: nomeArma?.trim() || "Arma sem identificação",
    calibre,
    marca,
    modelo,
  };
}

/** Mascara o número de série exibindo apenas os 3 últimos caracteres. */
export function maskSerial(serial: string | null | undefined): string {
  if (!serial) return "—";
  const s = serial.toString().trim();
  if (s.length <= 3) return s;
  return `${"•".repeat(Math.max(3, s.length - 3))} ${s.slice(-3)}`;
}

/** Cores táticas reutilizadas em todo o Arsenal. */
export const TACTICAL = {
  ok: "hsl(152 60% 42%)",
  warn: "hsl(38 92% 50%)",
  danger: "hsl(0 72% 55%)",
  cyan: "hsl(190 80% 45%)",
  steel: "hsl(220 20% 28%)",
  carbon: "hsl(220 18% 14%)",
  neon: "hsl(150 80% 50%)",
};

export function urgencyTone(days: number | null): "ok" | "warn" | "danger" | "muted" {
  if (days === null) return "muted";
  if (days < 0) return "danger";
  if (days <= 30) return "danger";
  if (days <= 90) return "warn";
  return "ok";
}

export const WEAPON_KIND_LABEL: Record<WeaponKind, string> = {
  pistola: "PISTOLA",
  revolver: "REVÓLVER",
  espingarda: "ESPINGARDA",
  carabina: "CARABINA",
  fuzil: "FUZIL",
  submetralhadora: "SUBMETRALHADORA",
  outra: "ARMAMENTO",
};