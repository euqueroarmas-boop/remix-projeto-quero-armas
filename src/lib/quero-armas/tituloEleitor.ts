/* =============================================================================
 * Título de eleitor — formato único do sistema
 *
 * O título tem 12 dígitos e é lido em três blocos de quatro: `1111 2222 3333`.
 * O cliente digitava o número colado (e às vezes com letras), e o valor salvo
 * ficava impossível de conferir contra a Certidão de Crimes Eleitorais do TSE.
 *
 * Regra: entrada só aceita dígito, é agrupada 4-4-4 enquanto se digita, e o
 * banco guarda o número limpo (12 dígitos) — a exibição sempre remonta os
 * blocos, então nunca existem dois formatos convivendo.
 * ============================================================================= */

export const TITULO_ELEITOR_PLACEHOLDER = "1111 2222 3333";
export const TITULO_ELEITOR_DIGITOS = 12;

/** Só os dígitos, limitado ao tamanho legal — é o que vai para o banco. */
export function tituloEleitorDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "").slice(0, TITULO_ELEITOR_DIGITOS);
}

/** Máscara progressiva: `1111`, `1111 2222`, `1111 2222 3333`. */
export function mascaraTituloEleitor(v: unknown): string {
  const d = tituloEleitorDigitos(v);
  return [d.slice(0, 4), d.slice(4, 8), d.slice(8, 12)].filter(Boolean).join(" ");
}

/** Válido só com os 12 dígitos completos. */
export function tituloEleitorValido(v: unknown): boolean {
  return tituloEleitorDigitos(v).length === TITULO_ELEITOR_DIGITOS;
}

export const TITULO_ELEITOR_ERRO =
  "O título de eleitor tem 12 números, no formato 1111 2222 3333 — sem letras.";
