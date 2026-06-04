/**
 * Catálogo único e compartilhado de tipos de peça/serviço da Quero Armas.
 * FONTE DE VERDADE compartilhada entre:
 *  - NovoCasoModal (criação de caso)
 *  - QAGerarPecaPage (geração de peça)
 *  - supabase/functions/qa-gerar-peca (validação backend — TIPOS_PECA_PERMITIDOS)
 *
 * IMPORTANTE: ao adicionar/remover um tipo aqui, atualize também o array
 * `TIPOS_PECA_PERMITIDOS` na edge function `qa-gerar-peca/index.ts` para
 * manter o backend e o front em sincronia.
 */
export const TIPOS_PECA = [
  { value: "defesa_posse_arma", label: "Defesa para Posse de Arma" },
  { value: "defesa_porte_arma", label: "Defesa para Porte de Arma" },
  { value: "recurso_administrativo", label: "Recurso Administrativo" },
  { value: "resposta_a_notificacao", label: "Resposta à Notificação" },
] as const;

export type TipoPecaValue = typeof TIPOS_PECA[number]["value"];

export const TIPOS_PECA_VALUES: TipoPecaValue[] = TIPOS_PECA.map(t => t.value);

export function getTipoPecaLabel(value: string): string {
  return TIPOS_PECA.find(t => t.value === value)?.label || value;
}