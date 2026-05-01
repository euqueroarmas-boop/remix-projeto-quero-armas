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

/**
 * Status visual agregado das GTEs do cliente para o KPI do Arsenal.
 *
 * Precedência: vencida > próxima > válida > neutro.
 * Janela: vencida (<0d), próxima (0..30d), em dia (>30d).
 * GTEs sem `data_validade` ou ainda em processamento entram em "neutro".
 */
export interface GteKpiInput {
  data_validade?: string | null;
  status_processamento?: string | null;
}

export interface GteKpiStatus {
  total: number;
  validas: number;
  proximas: number;
  vencidas: number;
  semData: number;
  statusVisual: "ok" | "warn" | "danger" | "muted";
  labelSecundaria: string;
}

export function getGteKpiStatus(gtes: GteKpiInput[] | null | undefined): GteKpiStatus {
  const list = Array.isArray(gtes) ? gtes : [];
  const total = list.length;

  if (total === 0) {
    return {
      total: 0,
      validas: 0,
      proximas: 0,
      vencidas: 0,
      semData: 0,
      statusVisual: "muted",
      labelSecundaria: "Sem GTE cadastrada",
    };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let validas = 0;
  let proximas = 0;
  let vencidas = 0;
  let semData = 0;

  for (const g of list) {
    const status = (g?.status_processamento || "").toLowerCase();
    if (!g?.data_validade || (status && status !== "concluido")) {
      semData++;
      continue;
    }
    const v = new Date(`${g.data_validade}T00:00:00`);
    if (Number.isNaN(v.getTime())) {
      semData++;
      continue;
    }
    const dias = Math.floor((v.getTime() - hoje.getTime()) / 86400000);
    if (dias < 0) vencidas++;
    else if (dias <= 30) proximas++;
    else validas++;
  }

  // Precedência: vencida > próxima > válida > neutro
  if (vencidas > 0) {
    return {
      total, validas, proximas, vencidas, semData,
      statusVisual: "danger",
      labelSecundaria: vencidas === 1 ? "Vencida" : `${vencidas} vencidas`,
    };
  }
  if (proximas > 0) {
    return {
      total, validas, proximas, vencidas, semData,
      statusVisual: "warn",
      labelSecundaria: proximas === 1 ? "Próxima do vencimento" : `${proximas} p/ vencer`,
    };
  }
  if (validas > 0) {
    return {
      total, validas, proximas, vencidas, semData,
      statusVisual: "ok",
      labelSecundaria: "Tudo em dia",
    };
  }
  // Só tem semData
  return {
    total, validas, proximas, vencidas, semData,
    statusVisual: "muted",
    labelSecundaria: "Aguardando leitura",
  };
}


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
  { kind: "pistola", tokens: ["PISTOLA", "GLOCK", "TAURUS PT", "TH9", "TH 9", "TH40", "TH380", "TS9", "TS 9", "G2C", "G3C", "M&P", "BERETTA", "1911", "P226", "P320", "P226", "PT840", "TX22", "TX 22", "G17", "G19", "G22", "G25", "G26"] },
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
  /(9\s?[x×]\s?19\s?MM|9\s?[x×]\s?19|9\s?MM\s?PARABELLUM|\.?\s?9\s?MM|\.380|\.40|\.357|\.38|\.45|\.22\s?LONG\s?RIFLE|22\s?LONG\s?RIFLE|\.22\s?LR|\.22|\.223|\.308|\.44|7\.62|5\.56|CAL\.?\s?12|CALIBRE\s?12|12\s?GA)/i;

export function extractCalibre(...inputs: (string | null | undefined)[]): string | null {
  const blob = inputs.filter(Boolean).join(" ");
  const m = blob.match(CALIBRE_REGEX);
  if (!m) return null;
  const raw = m[0].toUpperCase().replace(/\s+/g, "");
  if (raw.includes("CALIBRE12") || raw.includes("CAL.12") || raw.includes("CAL12") || raw.includes("12GA")) return "CAL .12";
  if (raw.includes("9X19") || raw.includes("9MM")) return "9MM";
  if (raw.includes("22LONGRIFLE")) return ".22 LR";
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

/**
 * Valida o campo `modelo` de uma arma. Modelo nunca pode ser:
 *  - vazio / nulo
 *  - apenas números, pontos, traços ou barras (= número de doc/registro/CRAF/SINARM)
 *  - palavra-rótulo isolada (CRAF, SINARM, SIGMA, REGISTRO, DOCUMENTO, PROTOCOLO)
 */
export function isInvalidWeaponModel(value: string | null | undefined): boolean {
  if (!value) return true;
  const v = value.toString().trim();
  if (v.length < 2) return true;
  if (/^[0-9.\-\/\s]+$/.test(v)) return true;
  if (/^(CRAF|SINARM|SIGMA|REGISTRO|DOCUMENTO|PROTOCOLO|ARMA)$/i.test(v)) return true;
  return false;
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