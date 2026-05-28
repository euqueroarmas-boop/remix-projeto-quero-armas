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
  cond: Record<string, string> | undefined | null,
): boolean {
  if (!cond || typeof cond !== "object") return true;
  return Object.entries(cond).every(([k, v]) => respostas[k] === v);
}

// Espelho de itemVisivel: respeita depende_de e exige_quando.
export function itemVisivelGuia(
  d: ChecklistItemLike,
  respostas: Respostas,
): boolean {
  const r = d?.regra_validacao;
  if (!r || typeof r !== "object") return true;
  if (r.depende_de && typeof r.depende_de === "object") {
    const ok = respostas[r.depende_de.chave] === r.depende_de.valor;
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