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
    .map((s) => s.trim().toLowerCase().replace(/_/g, "-"))
    .filter(Boolean);
}

/**
 * Filtra subseções do ANEXO I do template legado, que usam o padrão:
 *   <h3>I.N. TÍTULO</h3>
 *   <p><strong>Identificador (slug): SLUG</strong></p>
 *   <p>... blocos ...</p>
 *
 * O template oficial NÃO usa <section data-anexo-slug> para o Anexo I, então o
 * filtro de sections é fail-open e deixa todos os serviços visíveis. Esta
 * função remove TODAS as subseções I.N cujo slug não está em `slugSet`. Se
 * nenhum bloco bater, deixa um aviso controlado no lugar.
 *
 * Retorna { html, debug } para permitir logs em DEV. Não imprime nada.
 */
function filterAnexoIByHeadings(
  html: string,
  slugSet: Set<string>,
): {
  html: string;
  found: { slug: string | null; titulo: string }[];
  removed: { slug: string | null; titulo: string }[];
  kept: { slug: string | null; titulo: string }[];
} {
  const headingRegex = /<h3[^>]*>\s*I\.\d+\.[^<]*<\/h3>/g;
  const heads: { start: number; titulo: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(html)) !== null) {
    heads.push({ start: m.index, titulo: m[0].replace(/<[^>]+>/g, "").trim() });
  }
  if (heads.length === 0) {
    return { html, found: [], removed: [], kept: [] };
  }

  // End of last block: até o próximo <h2 ... ou final do html
  const tailH2 = html.slice(heads[heads.length - 1].start).search(/<h2[^>]*>/);
  const lastEnd =
    tailH2 >= 0 ? heads[heads.length - 1].start + tailH2 : html.length;

  // Constrói blocos [start, end)
  type Block = {
    start: number;
    end: number;
    titulo: string;
    slug: string | null;
  };
  const blocks: Block[] = heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].start : lastEnd;
    const segment = html.slice(h.start, end);
    const slugMatch = segment.match(
      /Identificador\s*\(\s*slug\s*\)\s*:\s*([a-z0-9][a-z0-9-]+)/i,
    );
    return {
      start: h.start,
      end,
      titulo: h.titulo,
      slug: slugMatch ? slugMatch[1].toLowerCase().replace(/_/g, "-") : null,
    };
  });

  const found = blocks.map((b) => ({ slug: b.slug, titulo: b.titulo }));
  const kept: Block[] = [];
  const removed: Block[] = [];
  for (const b of blocks) {
    if (b.slug && slugSet.has(b.slug)) kept.push(b);
    else removed.push(b);
  }

  // Reconstrói removendo blocos não contratados.
  // Mantém: tudo antes do primeiro bloco + blocos kept (na ordem original) +
  // o "tail" após o último bloco. Se kept estiver vazio, insere aviso no lugar.
  const head = html.slice(0, blocks[0].start);
  const tail = html.slice(lastEnd);
  let middle = "";
  if (kept.length === 0) {
    middle = AVISO_SEM_ANEXO_HTML;
  } else {
    middle = kept.map((b) => html.slice(b.start, b.end)).join("");
  }
  return {
    html: head + middle + tail,
    found,
    removed: removed.map((b) => ({ slug: b.slug, titulo: b.titulo })),
    kept: kept.map((b) => ({ slug: b.slug, titulo: b.titulo })),
  };
}

/** Diagnóstico opcional preenchido quando `debug` está habilitado. */
export type ContractAnexoFilterDebug = {
  slugsContratados: string[];
  sectionsAnexoSlugFound: string[];
  sectionsAnexoSlugKept: string[];
  anexoIBlocksFound: { slug: string | null; titulo: string }[];
  anexoIBlocksKept: { slug: string | null; titulo: string }[];
  anexoIBlocksRemoved: { slug: string | null; titulo: string }[];
};

/**
 * Função única reutilizável de filtragem. Use SEMPRE esta em todos os
 * caminhos (preview, aceite, PDF, portal, snapshot).
 */
export function filterContractAnexosBySlugs(
  html: string,
  slugsContratados: string[] | null | undefined,
  options?: { debug?: ContractAnexoFilterDebug },
): string {
  if (!html) return html;
  const slugs = normalizeSlugs(slugsContratados);
  const slugSet = new Set(slugs);
  if (options?.debug) {
    options.debug.slugsContratados = slugs;
    options.debug.sectionsAnexoSlugFound = [];
    options.debug.sectionsAnexoSlugKept = [];
    options.debug.anexoIBlocksFound = [];
    options.debug.anexoIBlocksKept = [];
    options.debug.anexoIBlocksRemoved = [];
  }

  let result = html;

  // Caminho browser
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(
        `<div id="qa-root">${result}</div>`,
        "text/html",
      );
      const root = doc.getElementById("qa-root");
      if (!root) {
        // segue para o caminho heading-based abaixo
      } else {
      const sections = Array.from(
        root.querySelectorAll("section[data-anexo-slug]"),
      );
      if (sections.length === 0) {
        // sem sections — não altera, mas continua para o filtro heading-based
      } else {
      let kept = 0;
      let firstAnexo: Element | null = null;
      for (const s of sections) {
        if (!firstAnexo) firstAnexo = s;
        const sslug = (s.getAttribute("data-anexo-slug") || "")
          .trim()
          .toLowerCase()
          .replace(/_/g, "-");
        if (options?.debug) options.debug.sectionsAnexoSlugFound.push(sslug);
        if (slugSet.has(sslug)) {
          kept++;
          if (options?.debug) options.debug.sectionsAnexoSlugKept.push(sslug);
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
      result = root.innerHTML;
      }
      }
    } catch {
      /* cai no fallback regex */
    }
  } else {
    // Fallback regex (Deno / SSR) — caminho de sections data-anexo-slug
    const sectionRegex =
      /<section\s+[^>]*data-anexo-slug="([^"]+)"[^>]*>[\s\S]*?<\/section>\s*/g;
    let foundAny = false;
    let kept = 0;
    const filtered = result.replace(sectionRegex, (full, s: string) => {
      foundAny = true;
      const sslug = s.trim().toLowerCase().replace(/_/g, "-");
      if (options?.debug) options.debug.sectionsAnexoSlugFound.push(sslug);
      if (slugSet.has(sslug)) {
        kept++;
        if (options?.debug) options.debug.sectionsAnexoSlugKept.push(sslug);
        return full;
      }
      return "";
    });
    if (foundAny) {
      result = kept === 0 ? filtered + AVISO_SEM_ANEXO_HTML : filtered;
    }
  }

  // Segundo passe: filtro heading-based do ANEXO I (template legado sem
  // data-anexo-slug). Roda SEMPRE — em browser ou Deno — para garantir que
  // o cliente não veja descrição de serviço não contratado.
  const anexoI = filterAnexoIByHeadings(result, slugSet);
  if (options?.debug) {
    options.debug.anexoIBlocksFound = anexoI.found;
    options.debug.anexoIBlocksKept = anexoI.kept;
    options.debug.anexoIBlocksRemoved = anexoI.removed;
  }
  return anexoI.html;
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