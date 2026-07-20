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
  return blocos.join("\n");
}

/**
 * Substitui o placeholder {{anexos_i_dinamicos}} no template pelo miolo
 * já montado. Deixado como função separada para facilitar futuras
 * substituições (ex.: fallback para v10 sem placeholder).
 */
export function aplicarAnexosDinamicos(html: string, anexosHtml: string): string {
  if (!html) return html;
  if (html.indexOf("{{anexos_i_dinamicos}}") === -1) return html;
  return html.replace(/\{\{\s*anexos_i_dinamicos\s*\}\}/g, anexosHtml);
}