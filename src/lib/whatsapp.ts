/** Central WhatsApp configuration — single source of truth */
export const WHATSAPP_NUMBER = "5511963166915";
export const WHATSAPP_DISPLAY = "(11) 96316-6915";
export const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export function whatsappLink(message?: string): string {
  if (!message) return WHATSAPP_BASE_URL;
  return `${WHATSAPP_BASE_URL}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a contextual WhatsApp message based on the current page.
 * Automatically includes the page title and URL.
 */
export function buildContextualWhatsAppMessage(options: {
  pageTitle?: string;
  intent?: "specialist" | "diagnosis" | "proposal" | "general";
}): string {
  const { pageTitle, intent = "general" } = options;
  const url = typeof window !== "undefined" ? window.location.href : "";
  const name = pageTitle || document.title || "WMTi";

  const intents: Record<string, string> = {
    specialist: `Olá, estou vendo a página "${name}" no site da WMTi e quero falar com um especialista.\nLink: ${url}`,
    diagnosis: `Olá, estou vendo a página "${name}" no site da WMTi e quero solicitar um diagnóstico técnico.\nLink: ${url}`,
    proposal: `Olá, estou vendo a página "${name}" no site da WMTi e quero montar uma proposta para minha empresa.\nLink: ${url}`,
    general: `Olá, estou vendo a página "${name}" no site da WMTi e quero um orçamento.\nLink: ${url}`,
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
