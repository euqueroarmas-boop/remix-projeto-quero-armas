/**
 * qaAnexos.ts — Motor dinâmico de Anexo I do contrato principal.
 *
 * A partir de v11 do template CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS, o miolo
 * do Anexo I não vive mais dentro do template — ele é montado em runtime
 * a partir de `qa_servicos_catalogo.anexo_corpo_html`, um bloco por
 * serviço contratado. O template contém apenas o placeholder
 * `{{anexos_i_dinamicos}}`, que é substituído por este módulo antes de
 * renderizar o snapshot do contrato.
 */

export const AVISO_SEM_ANEXO_DINAMICO_HTML =
  '<section data-anexo-slug="__aviso__" class="qa-anexo-aviso" ' +
  'style="border:1px solid #c9a84c;background:#fdf6e3;color:#5a4a1a;' +
  'padding:12px 14px;margin:18px 0;font-size:12.5px;line-height:1.5;">' +
  "<strong>Anexo específico do serviço não disponível neste contrato.</strong> " +
  "Os termos detalhados do serviço contratado serão entregues junto ao " +
  "contrato final assinado." +
  "</section>";

export function normalizeAnexoSlug(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toRoman(value: number): string {
  const map: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let n = Math.max(1, Math.floor(value || 1));
  let out = "";
  for (const [num, roman] of map) {
    while (n >= num) {
      out += roman;
      n -= num;
    }
  }
  return out;
}

export function renumberContractAnexoHeadings(
  html: string,
  startIndex = 1,
): { html: string; nextIndex: number; count: number } {
  if (!html) return { html, nextIndex: startIndex, count: 0 };
  let index = Math.max(1, Math.floor(startIndex || 1));
  let count = 0;
  const out = html.replace(
    /(<h[1-6]\b[^>]*>\s*)(?:ANEXO\s+[IVXLCDM]+\s*(?:&mdash;|&ndash;|---|--|—|-)\s*|I\.\d+\.\s*)([\s\S]*?)(<\/h[1-6]>)/gi,
    (_full, open: string, title: string, close: string) => {
      const roman = toRoman(index++);
      count++;
      return `${open}ANEXO ${roman} — ${title.trim()}${close}`;
    },
  );
  return { html: out, nextIndex: index, count };
}

export function renumberContractAnexoHeading(html: string, index: number): string {
  return renumberContractAnexoHeadings(html, index).html;
}

export function normalizeContractAnexoContainerHeading(html: string): string {
  return html;
}

export function hasContractAnexoContainerHeading(html: string): boolean {
  if (!html) return false;
  return /<h[1-6]\b[^>]*>\s*ANEXO\s+I\s*(?:&mdash;|&ndash;|---|--|—|-)\s*DESCRIÇÃO DOS SERVIÇOS CONTRATADOS\s*<\/h[1-6]>/i.test(html);
}

/**
 * Monta o miolo do Anexo I concatenando o `anexo_corpo_html` de cada
 * serviço contratado, na ordem em que os slugs foram passados. Slugs sem
 * anexo cadastrado no catálogo são silenciosamente ignorados; se nenhum
 * dos slugs tiver anexo, retorna o bloco de aviso padrão.
 */
export async function montarAnexosI(
  sb: any,
  slugs: string[] | null | undefined,
): Promise<string> {
  const normalizados = Array.from(
    new Set(
      (Array.isArray(slugs) ? slugs : [])
        .map((s) => normalizeAnexoSlug(s))
        .filter(Boolean),
    ),
  );
  if (normalizados.length === 0) return AVISO_SEM_ANEXO_DINAMICO_HTML;

  const { data, error } = await sb
    .from("qa_servicos_catalogo")
    .select("slug, anexo_corpo_html")
    .in("slug", normalizados);

  if (error) {
    console.warn("[qaAnexos] falha ao carregar anexos:", error.message);
    return AVISO_SEM_ANEXO_DINAMICO_HTML;
  }

  const byslug = new Map<string, string>();
  for (const row of (data || []) as Array<{ slug: string; anexo_corpo_html: string | null }>) {
    if (row?.slug && row?.anexo_corpo_html) {
      byslug.set(normalizeAnexoSlug(row.slug), String(row.anexo_corpo_html));
    }
  }

  const blocos = normalizados
    .map((s) => byslug.get(s))
    .filter((b): b is string => !!b && b.trim().length > 0);

  if (blocos.length === 0) return AVISO_SEM_ANEXO_DINAMICO_HTML;
  let nextIndex = 1;
  return blocos.map((bloco) => {
    const renumbered = renumberContractAnexoHeadings(bloco, nextIndex);
    nextIndex = renumbered.nextIndex;
    return renumbered.html;
  }).join("\n");
}

/**
 * Substitui o placeholder {{anexos_i_dinamicos}} no template pelo miolo
 * já montado. Deixado como função separada para facilitar futuras
 * substituições (ex.: fallback para v10 sem placeholder).
 */
export function aplicarAnexosDinamicos(html: string, anexosHtml: string): string {
  if (!html) return html;
  const normalized = normalizeContractAnexoContainerHeading(html);
  if (normalized.indexOf("{{anexos_i_dinamicos}}") === -1) return normalized;
  const anexosNumerados = hasContractAnexoContainerHeading(normalized)
    ? renumberContractAnexoHeadings(anexosHtml, 2).html
    : anexosHtml;
  return normalized.replace(/\{\{\s*anexos_i_dinamicos\s*\}\}/g, anexosNumerados);
}
