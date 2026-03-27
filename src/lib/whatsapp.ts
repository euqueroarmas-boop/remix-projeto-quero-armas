/** Central WhatsApp configuration — single source of truth */
export const WHATSAPP_NUMBER = "5511963166915";
export const WHATSAPP_DISPLAY = "(11) 96316-6915";
export const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export function whatsappLink(message?: string): string {
  if (!message) return WHATSAPP_BASE_URL;
  return `${WHATSAPP_BASE_URL}?text=${encodeURIComponent(message)}`;
}

/**
 * Extract a clean, human-readable page name from an H1, a passed title,
 * or the current pathname – never the raw document.title (which contains
 * SEO separators, slogans, etc.).
 */
function getCleanPageName(pageTitle?: string): string {
  // 1. If the caller already passed a short label, use it
  if (pageTitle) return pageTitle;

  // 2. Try the first <h1> on the page (best commercial name)
  if (typeof document !== "undefined") {
    const h1 = document.querySelector("h1");
    if (h1?.textContent) {
      const text = h1.textContent.trim();
      // Only use if it's reasonably short (not a full paragraph)
      if (text.length <= 120) return text;
    }
  }

  // 3. Derive from pathname: /ti-para-serventias-cartoriais → TI para Serventias Cartoriais
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

/**
 * Build a contextual WhatsApp message based on the current page.
 * Produces a SHORT, clean message — no preview URLs, no SEO titles.
 */
export function buildContextualWhatsAppMessage(options: {
  pageTitle?: string;
  intent?: "specialist" | "diagnosis" | "proposal" | "general";
}): string {
  const { pageTitle, intent = "general" } = options;
  const name = getCleanPageName(pageTitle);

  const intents: Record<string, string> = {
    specialist: `Olá, estou vendo a página de ${name} no site da WMTi e quero falar com um especialista.`,
    diagnosis: `Olá, estou vendo a página de ${name} no site da WMTi e quero solicitar um diagnóstico técnico.`,
    proposal: `Olá, estou vendo a página de ${name} no site da WMTi e quero montar uma proposta para minha empresa.`,
    general: `Olá, estou vendo a página de ${name} no site da WMTi e quero um orçamento.`,
  };

  return intents[intent] || intents.general;
}

/** Open WhatsApp with a contextual message */
export function openContextualWhatsApp(options: {
  pageTitle?: string;
  intent?: "specialist" | "diagnosis" | "proposal" | "general";
}): void {
  const message = buildContextualWhatsAppMessage(options);
  window.open(whatsappLink(message), "_blank", "noopener,noreferrer");
}
