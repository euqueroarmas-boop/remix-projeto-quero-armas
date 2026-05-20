/**
 * Filtra o corpo_html do CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS para manter apenas
 * os <section data-anexo-slug="..."> correspondentes aos serviços contratados.
 *
 * REGRA OBRIGATÓRIA (PR 7):
 *   - Aceita SOMENTE array de slugs (nunca string com vírgula).
 *   - Se o template tem seções data-anexo-slug e há slugs contratados:
 *       mantém APENAS as seções cujo slug está em `slugsContratados`.
 *   - Se NENHUMA seção bater (slug sem correspondência ou lista vazia),
 *     NÃO devolve o template com todos os anexos: substitui o bloco por
 *     um aviso controlado. Cliente nunca vê anexo de serviço que não
 *     contratou.
 *   - Se o template não possui nenhuma seção data-anexo-slug, devolve o
 *     HTML original (template sem anexos, nada a filtrar).
 *
 * Funciona em browser (DOMParser) e em Deno/edge (fallback regex puro).
 */

const AVISO_SEM_ANEXO_HTML =
  '<section data-anexo-slug="__aviso__" class="qa-anexo-aviso" ' +
  'style="border:1px solid #c9a84c;background:#fdf6e3;color:#5a4a1a;' +
  'padding:12px 14px;margin:18px 0;font-size:12.5px;line-height:1.5;">' +
  '<strong>Anexo específico do serviço não disponível neste contrato.</strong> ' +
  "Os termos detalhados do serviço contratado serão entregues junto ao " +
  "contrato final assinado." +
  "</section>";

function normalizeSlugs(slugs: string[] | null | undefined): string[] {
  if (!Array.isArray(slugs)) return [];
  return slugs
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Função única reutilizável de filtragem. Use SEMPRE esta em todos os
 * caminhos (preview, aceite, PDF, portal, snapshot).
 */
export function filterContractAnexosBySlugs(
  html: string,
  slugsContratados: string[] | null | undefined,
): string {
  if (!html) return html;
  const slugs = normalizeSlugs(slugsContratados);
  const slugSet = new Set(slugs);

  // Caminho browser
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(
        `<div id="qa-root">${html}</div>`,
        "text/html",
      );
      const root = doc.getElementById("qa-root");
      if (!root) return html;
      const sections = Array.from(
        root.querySelectorAll("section[data-anexo-slug]"),
      );
      if (sections.length === 0) return html; // template sem anexos
      let kept = 0;
      let firstAnexo: Element | null = null;
      for (const s of sections) {
        if (!firstAnexo) firstAnexo = s;
        if (slugSet.has(s.getAttribute("data-anexo-slug") || "")) {
          kept++;
        } else {
          s.remove();
        }
      }
      if (kept === 0) {
        // Strict: substitui por aviso controlado em vez de devolver todos.
        if (firstAnexo && firstAnexo.parentNode) {
          const tmp = doc.createElement("div");
          tmp.innerHTML = AVISO_SEM_ANEXO_HTML;
          const aviso = tmp.firstElementChild;
          if (aviso) firstAnexo.parentNode.insertBefore(aviso, firstAnexo);
          firstAnexo.remove();
        }
      }
      return root.innerHTML;
    } catch {
      /* cai no fallback regex */
    }
  }

  // Fallback regex (Deno / SSR)
  const sectionRegex =
    /<section\s+[^>]*data-anexo-slug="([^"]+)"[^>]*>[\s\S]*?<\/section>\s*/g;
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
  if (!foundAny) return html; // template sem anexos
  if (kept === 0) {
    // Strict: anexa um único aviso no lugar dos anexos removidos.
    // Garante que o cliente NUNCA vê todos os anexos.
    return filtered + AVISO_SEM_ANEXO_HTML;
  }
  return filtered;
}

/**
 * Alias de compatibilidade. Aceita string única OU array, mas SEMPRE
 * normaliza para array antes de chamar `filterContractAnexosBySlugs`.
 * NÃO aceita "slug1,slug2" — quem precisar disso deve passar array.
 */
export function filterAnexoBySlug(
  html: string,
  slug: string | string[] | null | undefined,
): string {
  const arr = Array.isArray(slug) ? slug : slug ? [slug] : [];
  return filterContractAnexosBySlugs(html, arr);
}