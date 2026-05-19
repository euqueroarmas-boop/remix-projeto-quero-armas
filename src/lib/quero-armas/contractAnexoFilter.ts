/**
 * Filtra o corpo_html do CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS para manter apenas
 * os <section data-anexo-slug="..."> correspondentes aos serviços contratados.
 * Aceita um slug único ou array de slugs (bundle de serviços).
 * Funciona em browser (DOMParser) e em fallback puro string (regex) para uso
 * em edge functions Deno.
 *
 * Comportamento:
 *   - Sem slugs ou HTML sem <section data-anexo-slug>: retorna HTML original
 *     (fail-open — não esconde o contrato em casos legados).
 *   - Com slugs informados e seções existentes: mantém APENAS as seções dos
 *     slugs contratados. Se nenhum slug bater, retorna HTML original como
 *     fallback controlado (nunca remove tudo).
 */
export function filterAnexoBySlug(
  html: string,
  slug: string | string[] | null | undefined,
): string {
  if (!html) return html;
  const slugs = (Array.isArray(slug) ? slug : [slug])
    .filter((s): s is string => !!s && typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  if (slugs.length === 0) return html;
  const slugSet = new Set(slugs);

  // Caminho browser
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(`<div id="qa-root">${html}</div>`, "text/html");
      const root = doc.getElementById("qa-root");
      if (!root) return html;
      const sections = Array.from(root.querySelectorAll("section[data-anexo-slug]"));
      if (sections.length === 0) return html;
      let kept = 0;
      for (const s of sections) {
        if (slugSet.has(s.getAttribute("data-anexo-slug") || "")) {
          kept++;
        } else {
          s.remove();
        }
      }
      if (kept === 0) return html; // fail-open
      return root.innerHTML;
    } catch {
      /* cai no fallback regex */
    }
  }

  // Fallback regex (Deno / SSR)
  const sectionRegex = /<section\s+data-anexo-slug="([^"]+)">[\s\S]*?<\/section>\s*/g;
  let foundAny = false;
  let kept = 0;
  const filtered = html.replace(sectionRegex, (full, s) => {
    foundAny = true;
    if (slugSet.has(s)) {
      kept++;
      return full;
    }
    return "";
  });
  if (!foundAny || kept === 0) return html; // fail-open
  return filtered;
}