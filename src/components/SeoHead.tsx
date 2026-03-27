import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface SeoHeadProps {
  title: string;
  description: string;
  canonical?: string;
  noindex?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
}

const OG_FALLBACK = "https://www.wmti.com.br/og-image.jpg";
const BASE_URL = "https://www.wmti.com.br";

/**
 * Sets document head meta tags for SEO.
 * Manages title, description, canonical, OG, Twitter, and robots.
 */
const SeoHead = ({
  title,
  description,
  canonical,
  noindex = false,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
}: SeoHeadProps) => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const [key, val] = selector.match(/\[(.+?)="(.+?)"\]/)?.slice(1) ?? [];
        if (key && val) el.setAttribute(key, val);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    const setLink = (rel: string, extra: Record<string, string>) => {
      const selectorParts = Object.entries(extra).map(([k, v]) => `[${k}="${v}"]`).join("");
      const selector = `link[rel="${rel}"]${selectorParts}`;
      let el = document.querySelector(selector) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
        document.head.appendChild(el);
      }
      return el;
    };

    // Resolve OG image: use provided, absolutize relative paths, fallback
    const resolvedImage = (() => {
      if (!ogImage) return OG_FALLBACK;
      if (ogImage.startsWith("http")) return ogImage;
      // Vite-bundled assets start with /assets/ or data:
      if (ogImage.startsWith("/assets/") || ogImage.startsWith("data:")) {
        return `${BASE_URL}${ogImage}`;
      }
      // Public folder paths
      if (ogImage.startsWith("/")) return `${BASE_URL}${ogImage}`;
      return OG_FALLBACK;
    })();

    const resolvedUrl = canonical || `${BASE_URL}${window.location.pathname}`;

    // Basic meta
    setMeta('meta[name="description"]', "content", description);

    // Robots
    setMeta('meta[name="robots"]', "content", noindex ? "noindex, nofollow" : "index, follow");

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
    } else if (link) {
      link.setAttribute("href", resolvedUrl);
    }

    // Hreflang tags for international SEO
    const path = window.location.pathname;
    const ptUrl = `${BASE_URL}${path}`;
    const enUrl = `${BASE_URL}${path}`; // same URL, content switches client-side

    const hrefPt = setLink("alternate", { hreflang: "pt-BR" });
    hrefPt.setAttribute("href", ptUrl);

    const hrefEn = setLink("alternate", { hreflang: "en-US" });
    hrefEn.setAttribute("href", enUrl);

    const hrefDefault = setLink("alternate", { hreflang: "x-default" });
    hrefDefault.setAttribute("href", ptUrl);

    // Open Graph
    setMeta('meta[property="og:title"]', "content", ogTitle || title);
    setMeta('meta[property="og:description"]', "content", ogDescription || description);
    setMeta('meta[property="og:image"]', "content", resolvedImage);
    setMeta('meta[property="og:image:width"]', "content", "1200");
    setMeta('meta[property="og:image:height"]', "content", "630");
    setMeta('meta[property="og:type"]', "content", ogType);
    setMeta('meta[property="og:url"]', "content", resolvedUrl);
    setMeta('meta[property="og:site_name"]', "content", "WMTi Tecnologia da Informação");
    setMeta('meta[property="og:locale"]', "content", currentLang === "en-US" ? "en_US" : "pt_BR");
    setMeta('meta[property="og:locale:alternate"]', "content", currentLang === "en-US" ? "pt_BR" : "en_US");

    // Twitter Card
    setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "content", ogTitle || title);
    setMeta('meta[name="twitter:description"]', "content", ogDescription || description);
    setMeta('meta[name="twitter:image"]', "content", resolvedImage);

    // Content-Language
    setMeta('meta[http-equiv="content-language"]', "content", currentLang === "en-US" ? "en" : "pt-BR");
  }, [title, description, canonical, noindex, ogTitle, ogDescription, ogImage, ogType, currentLang]);

  return null;
};

export default SeoHead;
