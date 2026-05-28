// Tipos de documento que pertencem a UMA arma específica do acervo.
// Quando o assistente encontra uma exigência destes tipos, pede ao cliente
// "a qual arma este documento se refere?" antes de aceitar o upload.
export const TIPOS_DOC_DE_ARMA = new Set<string>([
  "craf",
  "craf_renovacao",
  "nota_fiscal_arma",
  "autorizacao_compra_arma",
  "gte",
  "gte_transporte",
  "registro_arma",
]);

export function isDocDeArma(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  const t = String(tipo).toLowerCase();
  // cobre também sufixos por arma futuros (ex.: craf_2) via prefixo
  return (
    TIPOS_DOC_DE_ARMA.has(t) ||
    /^(craf|gte|nota_fiscal_arma|registro_arma|autorizacao_compra_arma)(_|$)/.test(t)
  );
}