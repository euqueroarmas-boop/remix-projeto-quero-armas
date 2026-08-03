/**
 * REGRA: documento de identificação é ÚNICO.
 *
 * O cliente precisa entregar UM documento oficial de identidade com foto
 * (CNH, CIN, RG com CPF, ...). Assim que qualquer um deles estiver cumprido
 * (aprovado / recebido / arquivado / dispensado / reaproveitado), as demais
 * exigências de identidade do mesmo checklist deixam de ser cobradas.
 */

const TIPOS_IDENTIDADE = new Set([
  "cin",
  "rg",
  "rg_com_cpf",
  "cnh",
  "documento_identidade",
  "documento_identidade_nacional",
  "carteira_identidade_nacional",
  "cedula_identidade_rg_com_cpf",
  "identidade_funcional",
]);

export function ehDocumentoIdentidade(tipo?: string | null, nome?: string | null): boolean {
  const t = String(tipo || "").trim().toLowerCase();
  const n = String(nome || "").trim().toLowerCase();
  if (TIPOS_IDENTIDADE.has(t)) return true;
  if (t.includes("identidade") || t.includes("identificacao")) return true;
  if (/\b(cnh|rg|cin)\b/.test(t)) return true;
  if (!n) return false;
  return (
    n.includes("identidade") ||
    n.includes("carteira nacional de habilitacao") ||
    n.includes("carteira nacional de habilitação") ||
    /\b(cnh|rg|cin)\b/.test(n)
  );
}

/**
 * Remove as exigências de identidade redundantes: se já existe uma cumprida,
 * as outras (ainda em aberto) somem do checklist.
 */
export function filtrarIdentidadeUnica<T>(
  docs: T[],
  opts: {
    tipo: (d: T) => string | null | undefined;
    nome?: (d: T) => string | null | undefined;
    cumprido: (d: T) => boolean;
  },
): T[] {
  const identidades = docs.filter((d) => ehDocumentoIdentidade(opts.tipo(d), opts.nome?.(d)));
  if (identidades.length < 2) return docs;
  const temCumprida = identidades.some((d) => opts.cumprido(d));
  if (!temCumprida) return docs;
  return docs.filter((d) => {
    if (!ehDocumentoIdentidade(opts.tipo(d), opts.nome?.(d))) return true;
    return opts.cumprido(d);
  });
}
