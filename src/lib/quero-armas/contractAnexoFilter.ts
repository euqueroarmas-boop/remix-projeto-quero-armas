/**
 * Filtra o corpo_html do CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS para manter apenas
 * o <section data-anexo-slug="..."> correspondente ao serviço contratado.
 * Funciona em browser (DOMParser) e em fallback puro string (regex) para uso
 * em edge functions Deno.
 *
 * Se o slug não casar com nenhuma seção, retorna o HTML original (fail-open
 * para não esconder o contrato em casos inesperados).
 */
export function filterAnexoBySlug(html: string, slug: string | null | undefined): string {
  if (!html || !slug) return html;

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
        if (s.getAttribute("data-anexo-slug") === slug) {
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
    if (s === slug) {
      kept++;
      return full;
    }
    return "";
  });
  if (!foundAny || kept === 0) return html; // fail-open
  return filtered;
}