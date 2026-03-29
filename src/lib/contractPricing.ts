/**
 * Central contract pricing logic.
 * Single source of truth for frontend, contract, and payment.
 */

export type ContractTerm = 12 | 24 | 36;

export interface PlanConfig {
  termMonths: ContractTerm;
  support24h: boolean;
}

export interface PricingBreakdown {
  valorBase: number;
  termMonths: ContractTerm;
  descontoPercentual: number;
  valorComDesconto: number;
  support24h: boolean;
  valorAdicional24h: number;
  valorFinalMensal: number;
}

const TERM_DISCOUNTS: Record<ContractTerm, number> = {
  12: 0,
  24: 0.03,
  36: 0.05,
};

const SUPPORT_24H_SURCHARGE = 0.35;

/**
 * Calculates the final monthly value based on term and 24h support selection.
 * Order: base → term discount → 24h surcharge.
 */
export function calculatePricing(valorBase: number, config: PlanConfig): PricingBreakdown {
  const desconto = TERM_DISCOUNTS[config.termMonths] ?? 0;
  const valorComDesconto = Math.round(valorBase * (1 - desconto) * 100) / 100;
  const valorAdicional24h = config.support24h
    ? Math.round(valorComDesconto * SUPPORT_24H_SURCHARGE * 100) / 100
    : 0;
  const valorFinalMensal = Math.round((valorComDesconto + valorAdicional24h) * 100) / 100;

  return {
    valorBase,
    termMonths: config.termMonths,
    descontoPercentual: desconto,
    valorComDesconto,
    support24h: config.support24h,
    valorAdicional24h,
    valorFinalMensal,
  };
}

export function getTermLabel(term: ContractTerm): string {
  return `${term} meses`;
}

export function getTermDiscount(term: ContractTerm): number {
  return TERM_DISCOUNTS[term] ?? 0;
}
