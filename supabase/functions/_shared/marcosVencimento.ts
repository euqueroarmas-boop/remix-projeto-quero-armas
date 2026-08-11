/**
 * Marcos de aviso por tipo de documento (espelho de
 * src/lib/quero-armas/avisosVencimento.ts para o runtime Deno).
 *
 * CERTIDÕES: 15 e 10 dias e, a partir daí, contagem regressiva DIÁRIA até o
 * último dia de validade.
 *
 * LAUDOS (psicológico e capacidade técnica): 120/90/60/45/30/20/10 e, a partir
 * de 10, contagem regressiva DIÁRIA. O laudo vale ATÉ o último dia — o
 * processo só trava se o protocolo for feito depois de vencido.
 */

export const MARCOS_CERTIDAO = [15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
export const MARCOS_LAUDO = [120, 90, 60, 45, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
export const MARCOS_PADRAO = [180, 90, 60, 45, 30, 15, 7, 0, -1];

export function ehCertidao(tipo: string | null | undefined): boolean {
  const t = String(tipo || "").toLowerCase();
  return t.startsWith("antecedentes_") || t.includes("certidao") || t.includes("certidão");
}

export function ehLaudo(tipo: string | null | undefined): boolean {
  const t = String(tipo || "").toLowerCase();
  return t.includes("laudo") || t.includes("psicolog") || t === "tiro" || t.includes("capacidade_tecnica");
}

export function marcosParaTipo(tipo: string | null | undefined): number[] {
  if (ehLaudo(tipo)) return MARCOS_LAUDO;
  if (ehCertidao(tipo)) return MARCOS_CERTIDAO;
  return MARCOS_PADRAO;
}

/**
 * Escolhe o MENOR marco ainda >= dias restantes. Assim cada faixa dispara uma
 * única vez e nenhuma faixa é "pulada" quando o cron deixa de rodar um dia.
 * Retorna null quando o documento ainda está fora de qualquer janela.
 */
export function escolherMarco(dias: number, marcos: number[]): number | null {
  const asc = [...marcos].sort((a, b) => a - b);
  for (const m of asc) {
    if (dias <= m) return m;
  }
  return null;
}
