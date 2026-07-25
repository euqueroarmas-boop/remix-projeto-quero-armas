// ============================================================================
// nameMatch — helpers compartilhados de comparação de nomes de pessoa
// ----------------------------------------------------------------------------
// Usado para cruzar automaticamente o nome extraído por IA em documentos
// (ex.: `titular_comprovante_nome` no comprovante de residência) contra o
// nome canônico do cliente (`qa_clientes.nome_completo`), evitando pedir
// confirmação manual quando já dá para inferir com segurança.
//
// A regra é conservadora: só devolve `"match" | "mismatch"` quando a
// confiança é alta; caso contrário `"unknown"` e o UI segue perguntando.
// ============================================================================

export function normalizePersonName(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "di", "du", "del", "della",
]);

function tokens(name: string): string[] {
  return normalizePersonName(name)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Compara dois nomes de pessoa e devolve um veredito conservador.
 *
 * - "match": primeiro nome idêntico E todos os tokens do nome mais curto
 *   aparecem no mais longo (permite abreviação/omissão de sobrenomes
 *   intermediários).
 * - "mismatch": primeiro nome diferente OU menos de 2 sobrenomes em comum.
 * - "unknown": não dá para decidir com segurança — deixe o humano responder.
 */
export function comparePersonNames(
  a: string | null | undefined,
  b: string | null | undefined,
): "match" | "mismatch" | "unknown" {
  const ta = tokens(a || "");
  const tb = tokens(b || "");
  if (ta.length < 2 || tb.length < 2) return "unknown";

  if (ta[0] !== tb[0]) return "mismatch";

  const setA = new Set(ta);
  const setB = new Set(tb);
  const compartilhados = ta.filter((t) => setB.has(t)).length;
  if (compartilhados < 2) return "mismatch";

  const menor = ta.length <= tb.length ? ta : tb;
  const maior = ta.length <= tb.length ? setB : setA;
  const todosCobertos = menor.every((t) => maior.has(t));
  if (todosCobertos) return "match";

  return "unknown";
}
