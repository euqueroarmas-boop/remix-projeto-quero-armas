/** Central WhatsApp configuration — single source of truth */
export const WHATSAPP_NUMBER = "5511963166915";
export const WHATSAPP_DISPLAY = "(11) 96316-6915";
export const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

const OPEN_GUARD_WINDOW_MS = 1200;

let lastOpenedUrl = "";
let lastOpenedAt = 0;

export function whatsappLink(message?: string): string {
  if (!message) return WHATSAPP_BASE_URL;
  return `${WHATSAPP_BASE_URL}?text=${encodeURIComponent(message)}`;
}

function dedupeRepeatedText(message: string): string {
  const normalized = message
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = normalized
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const uniqueParagraphs: string[] = [];
  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    const key = paragraph.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueParagraphs.push(paragraph);
  }

  const firstLinkIndex = uniqueParagraphs.findIndex((part) => part.startsWith("Link da página:"));

  return uniqueParagraphs
    .filter((part, index) => !part.startsWith("Link da página:") || index === firstLinkIndex)
    .join("\n\n")
    .trim();
}

function shouldBlockDuplicateOpen(url: string): boolean {
  const now = Date.now();
  const isDuplicate = lastOpenedUrl === url && now - lastOpenedAt < OPEN_GUARD_WINDOW_MS;

  lastOpenedUrl = url;
  lastOpenedAt = now;

  return isDuplicate;
}

/* ------------------------------------------------------------------ */
/*  Helpers to extract clean page context                              */
/* ------------------------------------------------------------------ */

/** Get the live site origin (never the preview/iframe origin) */
function getSiteUrl(): string {
  if (typeof window === "undefined") return "";
  // In production this is the real domain; in preview it still gives
  // the user a meaningful URL to paste.
  return window.location.href;
}

/**
 * Extract a clean, human-readable page name from an H1, a passed title,
 * or the current pathname – never the raw document.title (which contains
 * SEO separators, slogans, etc.).
 */
function getCleanPageName(pageTitle?: string): string {
  if (pageTitle) return pageTitle;

  if (typeof document !== "undefined") {
    const h1 = document.querySelector("h1");
    if (h1?.textContent) {
      const text = h1.textContent.trim();
      if (text.length <= 120) return text;
    }
  }

  if (typeof window !== "undefined") {
    const slug = window.location.pathname.replace(/^\//, "").split("?")[0];
    if (slug) {
      return slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
    }
  }

  return "WMTi";
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export type WhatsAppIntent = "specialist" | "diagnosis" | "proposal" | "general" | "blog" | "segment" | "emergencial" | "avulso";

export interface WhatsAppMessageOptions {
  /** Short label for the page / service (optional – auto-detected) */
  pageTitle?: string;
  /** Commercial intent */
  intent?: WhatsAppIntent;
  /** City name (for dynamic SEO pages) */
  city?: string;
  /** Extra detail to append (e.g. calculator result, plan name) */
  detail?: string;
}

/**
 * Build a contextual WhatsApp message based on the current page.
 * Produces a SHORT, clean message — includes page name + current URL.
 */
export function buildContextualWhatsAppMessage(options: WhatsAppMessageOptions = {}): string {
  const { pageTitle, intent = "general", city, detail } = options;
  const name = getCleanPageName(pageTitle);
  const url = getSiteUrl();

  let intro: string;

  switch (intent) {
    case "specialist":
      intro = `Olá, estou vendo a página "${name}" no site da WMTi e quero falar com um especialista para contratar este serviço.`;
      break;
    case "diagnosis":
      intro = `Olá, estou vendo a página "${name}" no site da WMTi e quero solicitar um diagnóstico técnico.`;
      break;
    case "proposal":
      intro = `Olá, estou vendo a página "${name}" no site da WMTi e quero montar uma proposta para minha empresa.`;
      break;
    case "blog":
      intro = `Olá, estou lendo a página "${name}" no site da WMTi e quero entender como a WMTi pode me ajudar com essa demanda.`;
      break;
    case "segment":
      intro = `Olá, estou vendo a página "${name}" no site da WMTi e desejo contratar os serviços da empresa para este segmento. Poderiam falar comigo?`;
      break;
    case "emergencial":
      intro = `Olá! Preciso de suporte técnico emergencial para minha empresa.`;
      break;
    case "avulso":
      intro = `Olá! Gostaria de contratar um serviço técnico avulso para minha empresa.`;
      break;
    default:
      intro = `Olá, estou vendo a página "${name}" no site da WMTi e desejo contratar os serviços da empresa. Poderiam falar comigo sobre esta solução?`;
  }

  if (city) {
    intro = intro.replace("no site da WMTi", `em ${city} no site da WMTi`);
  }

  const parts = [intro, detail?.trim(), url ? `Link da página: ${url}` : undefined].filter(Boolean) as string[];

  return dedupeRepeatedText(parts.join("\n\n"));
}

/**
 * Open WhatsApp in a new external window/tab.
 * Handles iframe/preview contexts by forcing top-level navigation as fallback.
 */
export function openWhatsApp(options: WhatsAppMessageOptions = {}): void {
  const message = dedupeRepeatedText(buildContextualWhatsAppMessage(options));
  const url = whatsappLink(message);

  if (shouldBlockDuplicateOpen(url)) return;

  // Try window.open first (works in most contexts)
  const win = window.open(url, "_blank", "noopener,noreferrer");

  // If window.open was blocked (iframe sandbox, popup blocker), fallback
  if (!win) {
    // Try top-level navigation if inside an iframe
    if (window.top && window.top !== window) {
      try {
        window.top.location.assign(url);
        return;
      } catch {
        // cross-origin — fall through
      }
    }
    // Last resort: navigate current tab
    window.location.assign(url);
  }
}

/** Open WhatsApp with a raw pre-built message (for special cases like payment) */
export function openWhatsAppRaw(message: string): void {
  const url = whatsappLink(dedupeRepeatedText(message));
  if (shouldBlockDuplicateOpen(url)) return;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    if (window.top && window.top !== window) {
      try { window.top.location.assign(url); return; } catch { /* cross-origin */ }
    }
    window.location.assign(url);
  }
}

/**
 * @deprecated Use openWhatsApp() instead. Kept for backward compatibility.
 */
export function openContextualWhatsApp(options: {
  pageTitle?: string;
  intent?: "specialist" | "diagnosis" | "proposal" | "general";
}): void {
  openWhatsApp(options);
}
