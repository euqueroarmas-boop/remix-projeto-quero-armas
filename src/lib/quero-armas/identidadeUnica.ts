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
]);

export function ehDocumentoIdentidade(tipo?: string | null, nome?: string | null): boolean {
  const t = String(tipo || "").trim().toLowerCase();
  // identidade_funcional prova vínculo institucional (etapa 2 — ocupação lícita),
  // não substitui documento civil (RG/CIN/CNH). Exclusão explícita antes do includes.
  if (t === "identidade_funcional") return false;
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
/**
 * CIN, CNH e RG (com CPF) são VIAS da MESMA exigência de identidade civil.
 * Se o slot do checklist pede CIN e o cliente anexa a CNH, isso NÃO é
 * "documento incorreto" — é a mesma exigência cumprida por outra via.
 *
 * `identidade_funcional` continua de fora (prova vínculo, não identidade civil).
 */
export function mesmaExigenciaIdentidade(
  a?: string | null,
  b?: string | null,
): boolean {
  if (!a || !b) return false;
  return ehDocumentoIdentidade(a) && ehDocumentoIdentidade(b);
}
/**
 * HOLERITE: privado e de servidor são a MESMA exigência (renda do mês).
 *
 * Caso real (22/08/2026): o leitor tem dois tipos — `renda_holerite_mes_atual`
 * (empresa privada) e `renda_holerite_funcionario_publico`. O slot pede um; se
 * a leitura devolver o outro, o cliente levava "documento incorreto" por um
 * contracheque perfeitamente válido. Quem separa privado de servidor é a
 * CONDIÇÃO PROFISSIONAL do processo, que já decide qual slot existe — não o
 * palpite do leitor sobre o empregador.
 *
 * Autorizado pelo titular: "deixe compartilhado os holerites".
 */
const TIPOS_HOLERITE = new Set([
  "renda_holerite_mes_atual",
  "renda_holerite_funcionario_publico",
  "renda_contra_cheque_mes_atual",
]);

export function ehHolerite(tipo?: string | null): boolean {
  return TIPOS_HOLERITE.has(String(tipo ?? "").trim().toLowerCase());
}

export function mesmaExigenciaHolerite(
  a?: string | null,
  b?: string | null,
): boolean {
  if (!a || !b) return false;
  return ehHolerite(a) && ehHolerite(b);
}

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
