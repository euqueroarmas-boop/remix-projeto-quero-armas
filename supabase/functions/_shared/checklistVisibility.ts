// ============================================================================
// checklistVisibility (shared)
// ----------------------------------------------------------------------------
// Fonte ÚNICA da regra de visibilidade de itens de checklist do Quero Armas.
// Espelha byte-a-byte a implementação do front em
// src/lib/quero-armas/checklistGuiadoEngine.ts (matchCondicaoGuia /
// itemVisivelGuia) e adiciona o helper itemContaParaConclusao usado pelo
// checker de conclusão (qa-processo-checar-conclusao-checklist).
//
// Regra NÃO muda — apenas centraliza, para o backend deixar de contar como
// "pendente" itens que ficaram invisíveis para o cliente por causa de uma
// resposta de pergunta-pivot (exige_quando) ou de uma dependência (depende_de).
// ============================================================================

export type Respostas = Record<string, any>;

export interface ChecklistItemLike {
  obrigatorio?: boolean | null;
  tipo_documento?: string | null;
  regra_validacao?: any;
}

export function matchCondicaoGuia(
  respostas: Respostas,
  cond: Record<string, any> | undefined | null,
): boolean {
  if (!cond || typeof cond !== "object") return true;
  return Object.entries(cond).every(([k, v]) =>
    Array.isArray(v)
      ? v.map((x) => String(x)).includes(String(respostas[k]))
      : respostas[k] === v,
  );
}

// Espelho de itemVisivel: respeita depende_de e exige_quando.
export function itemVisivelGuia(
  d: ChecklistItemLike,
  respostas: Respostas,
): boolean {
  const r = d?.regra_validacao;
  if (!r || typeof r !== "object") return true;
  if (r.dispensa_quando && typeof r.dispensa_quando === "object") {
    if (matchCondicaoGuia(respostas, r.dispensa_quando)) return false;
  }
  if (r.depende_de && typeof r.depende_de === "object") {
    const alvo = r.depende_de.valor;
    const ok = Array.isArray(alvo)
      ? alvo.map((x: any) => String(x)).includes(String(respostas[r.depende_de.chave]))
      : respostas[r.depende_de.chave] === alvo;
    if (!ok) return false;
  }
  if (r.exige_quando && typeof r.exige_quando === "object") {
    return matchCondicaoGuia(respostas, r.exige_quando);
  }
  return true;
}

// Decide se um item deve entrar na contagem do checker de conclusão.
//  a) Se invisível pelo exige_quando/depende_de → ignora.
//  b) Se não obrigatório → ignora.
//  c) Caso contrário → conta.
export function itemContaParaConclusao(
  d: ChecklistItemLike,
  respostas: Respostas,
): boolean {
  if (!itemVisivelGuia(d, respostas)) return false;
  if (d?.obrigatorio !== true) return false;
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// REGRA: documento de identificação é ÚNICO
// Espelha src/lib/quero-armas/identidadeUnica.ts para uso no backend.
// Quando qualquer identidade estiver cumprida, as demais são dispensadas.
// ────────────────────────────────────────────────────────────────────────────

const TIPOS_IDENTIDADE_SET = new Set([
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
  if (TIPOS_IDENTIDADE_SET.has(t)) return true;
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