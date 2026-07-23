export const DEFAULT_QA_FAVICON = "/arsenal-icon-192.png";
export const QA_FAVICON_BRANDING_KEY = "site_favicon";

export function normalizeFaviconUrl(value?: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed || DEFAULT_QA_FAVICON;
}

export function applyFaviconUrl(value?: string | null) {
  if (typeof document === "undefined") return;

  const href = normalizeFaviconUrl(value);
  const selectors = [
    "link[rel='icon']",
    "link[rel='shortcut icon']",
    "link[rel='apple-touch-icon']",
  ];

  selectors.forEach((selector) => {
    let link = document.querySelector<HTMLLinkElement>(selector);
    if (!link) {
      link = document.createElement("link");
      if (selector.includes("apple-touch-icon")) {
        link.rel = "apple-touch-icon";
      } else if (selector.includes("shortcut icon")) {
        link.rel = "shortcut icon";
        link.type = "image/png";
      } else {
        link.rel = "icon";
        link.type = "image/png";
      }
      document.head.appendChild(link);
    }
    link.href = href;
  });
}
