import { useEffect } from "react";

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
  ogImage = "https://www.wmti.com.br/wmti-preview.jpg",
  ogType = "website",
}: SeoHeadProps) => {
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
      link.setAttribute("href", window.location.origin + window.location.pathname);
    }

    // Open Graph
    setMeta('meta[property="og:title"]', "content", ogTitle || title);
    setMeta('meta[property="og:description"]', "content", ogDescription || description);
    setMeta('meta[property="og:image"]', "content", ogImage);
    setMeta('meta[property="og:type"]', "content", ogType);
    setMeta('meta[property="og:url"]', "content", canonical || window.location.origin + window.location.pathname);

    // Twitter
    setMeta('meta[name="twitter:title"]', "content", ogTitle || title);
    setMeta('meta[name="twitter:description"]', "content", ogDescription || description);
    setMeta('meta[name="twitter:image"]', "content", ogImage);
  }, [title, description, canonical, noindex, ogTitle, ogDescription, ogImage, ogType]);

  return null;
};

export default SeoHead;
