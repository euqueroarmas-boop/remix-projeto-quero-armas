/**
 * Lógica central de pricing do checkout Quero Armas — gross-up Asaas.
 *
 * Fonte da verdade para frontend (Etapa04Pagamento) e backend
 * (qa-checkout-iniciar-pagamento). NÃO calcule preço/juros em
 * nenhum outro lugar — sempre importe daqui.
 *
 * POLÍTICA (Willian, 2026-05):
 *   O preço do catálogo é o valor LÍQUIDO que cai na conta.
 *   O cliente paga o valor inflado o suficiente para que, após
 *   todos os descontos do Asaas (MDR + R$ 0,49 + antecipação),
 *   o lojista receba exatamente preco_base.
 *
 *   - PIX: preco_base (Asaas não cobra recebimento PIX).
 *   - Boleto: preco_base + R$ 1,99 (taxa do boleto pago).
 *   - Cartão: gross-up pelas faixas reais de MDR + antecipação.
 *
 * TAXAS ASAAS (do print da conta Willian, 18/05/2026, já com
 * promocionais vencidas em 08/05/2026):
 *
 *   Cartão crédito:
 *     - à vista:    2,99% + R$ 0,49 por cobrança
 *     - 2 a 6x:     3,49% + R$ 0,49 por cobrança
 *     - 7 a 12x:    3,99% + R$ 0,49 por cobrança
 *
 *   Antecipação automática:
 *     - à vista:    1,15% ao mês
 *     - parcelado:  1,6% ao mês
 *
 *   Boleto: R$ 1,99 por boleto pago.
 *
 * Para recalibrar (Asaas mudou as taxas), edite apenas
 * DEFAULT_PRICING_CONFIG abaixo.
 */

export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

/** Modo de antecipação configurado na conta Asaas. */
export type ModoAntecipacao = "automatica" | "manual" | "nenhuma";

export interface AsaasFees {
  /** MDR cartão à vista (1x). 0.0299 = 2,99%. */
  mdrCartao1x: number;
  /** MDR cartão 2 a 6 parcelas. */
  mdrCartao2a6: number;
  /** MDR cartão 7 a 12 parcelas. */
  mdrCartao7a12: number;
  /** Taxa fixa por cobrança no cartão (R$). */
  taxaFixaCartao: number;
  /** Antecipação à vista (% ao mês, fração: 0.0115 = 1,15%). */
  antecipacaoAVista: number;
  /** Antecipação parcelado (% ao mês). */
  antecipacaoParcelado: number;
  /** Modo de antecipação ativado na conta. */
  modoAntecipacao: ModoAntecipacao;
  /** Taxa por boleto pago (R$). */
  taxaBoleto: number;
}

export interface CheckoutPricingConfig {
  asaas: AsaasFees;
  /** Número máximo de parcelas permitido na UI. */
  maxParcelas: number;
  /** Desconto PIX em fração (0 = sem desconto). */
  descontoPix: number;
}

export const DEFAULT_PRICING_CONFIG: CheckoutPricingConfig = {
  asaas: {
    mdrCartao1x: 0.0299,
    mdrCartao2a6: 0.0349,
    mdrCartao7a12: 0.0399,
    taxaFixaCartao: 0.49,
    antecipacaoAVista: 0.0115,
    antecipacaoParcelado: 0.016,
    /**
     * Trocar para 'nenhuma' se NÃO usa antecipação automática
     * (recebe parcelas em D+32 padrão). O cliente paga menos nesse
     * caso, mas o lojista financia o capital de giro.
     */
    modoAntecipacao: "automatica",
    taxaBoleto: 1.99,
  },
  maxParcelas: 12,
  descontoPix: 0,
};

export interface PricingResult {
  billingType: BillingType;
  /** Preço base de tabela (= valor líquido recebido pelo lojista). */
  precoBase: number;
  /** Número de parcelas (1 para PIX/boleto). */
  parcelas: number;
  /** Valor total que o cliente paga, R$ 2 casas. */
  valorTotal: number;
  /** Valor por parcela (= valorTotal / parcelas). */
  valorParcela: number;
  /** Encargo em reais (valorTotal − precoBase). */
  encargosReais: number;
  /** Encargo em fração (0.10 = 10% acima do base). */
  encargosFracao: number;
  /** Rótulo descritivo para UI. */
  rotulo: string;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function mdrParaParcelas(n: number, fees: AsaasFees): number {
  if (n === 1) return fees.mdrCartao1x;
  if (n <= 6) return fees.mdrCartao2a6;
  return fees.mdrCartao7a12;
}

function taxaAntecipacaoEfetiva(n: number, fees: AsaasFees): number {
  if (fees.modoAntecipacao === "nenhuma") return 0;
  return n === 1 ? fees.antecipacaoAVista : fees.antecipacaoParcelado;
}

/**
 * Gross-up cartão: dado preco_base (líquido desejado), n parcelas e taxas,
 * resolve qual PMT × n o cliente paga.
 *
 * Modelo (composto, alinhado com extrato Asaas):
 *   Líquido por parcela K:
 *     L_K = PMT × (1 − MDR) × (1 − i)^K
 *   onde:
 *     i = taxa antecipação mensal
 *     K = mês que a parcela seria recebida (K=1 → D+32; K=2 → D+62; ...)
 *
 *   Soma:
 *     ∑[K=1..n] L_K = PMT × (1 − MDR) × S(n, i)
 *     S(n, i) = (1−i) × (1 − (1−i)^n) / i   se i > 0
 *             = n                            se i = 0
 *
 *   Equação:
 *     PMT × (1 − MDR) × S − R$ 0,49 = preco_base
 *
 *   Resolvida para PMT:
 *     PMT = (preco_base + R$ 0,49) / ((1 − MDR) × S)
 */
function grossUpCartao(
  precoBase: number,
  parcelas: number,
  fees: AsaasFees,
): { valorTotal: number; valorParcela: number } {
  const n = parcelas;
  const mdr = mdrParaParcelas(n, fees);
  const i = taxaAntecipacaoEfetiva(n, fees);
  const taxaFixa = fees.taxaFixaCartao;

  let s: number;
  if (i === 0) {
    s = n;
  } else {
    s = ((1 - i) * (1 - Math.pow(1 - i, n))) / i;
  }

  const pmt = (precoBase + taxaFixa) / ((1 - mdr) * s);
  const valorParcela = round2(pmt);
  const valorTotal = round2(valorParcela * n);
  return { valorTotal, valorParcela };
}

/**
 * Calcula valor cobrado do cliente para que lojista receba preco_base.
 * Função pura — mesmo input sempre devolve mesmo output.
 */
export function calcularPrecoFinal(
  precoBase: number,
  billingType: BillingType,
  parcelas = 1,
  config: CheckoutPricingConfig = DEFAULT_PRICING_CONFIG,
): PricingResult {
  if (!Number.isFinite(precoBase) || precoBase <= 0) {
    throw new Error("precoBase inválido");
  }

  if (billingType === "PIX") {
    const valorTotal = round2(precoBase * (1 - config.descontoPix));
    return {
      billingType,
      precoBase,
      parcelas: 1,
      valorTotal,
      valorParcela: valorTotal,
      encargosReais: round2(valorTotal - precoBase),
      encargosFracao: valorTotal / precoBase - 1,
      rotulo:
        config.descontoPix > 0
          ? `À vista no PIX (${Math.round(config.descontoPix * 100)}% off)`
          : "À vista no PIX",
    };
  }

  if (billingType === "BOLETO") {
    const valorTotal = round2(precoBase + config.asaas.taxaBoleto);
    return {
      billingType,
      precoBase,
      parcelas: 1,
      valorTotal,
      valorParcela: valorTotal,
      encargosReais: round2(valorTotal - precoBase),
      encargosFracao: valorTotal / precoBase - 1,
      rotulo: "Boleto bancário",
    };
  }

  // CREDIT_CARD
  const n = Math.max(
    1,
    Math.min(Math.trunc(parcelas), config.maxParcelas),
  );

  const { valorTotal, valorParcela } = grossUpCartao(
    precoBase,
    n,
    config.asaas,
  );

  return {
    billingType,
    precoBase,
    parcelas: n,
    valorTotal,
    valorParcela,
    encargosReais: round2(valorTotal - precoBase),
    encargosFracao: valorTotal / precoBase - 1,
    rotulo: n === 1 ? "Cartão à vista (1x)" : `${n}x no cartão`,
  };
}

/** Lista todas as 12 opções de parcelamento (UI estilo Mercado Livre). */
export function listarOpcoesParcelamento(
  precoBase: number,
  config: CheckoutPricingConfig = DEFAULT_PRICING_CONFIG,
): PricingResult[] {
  const opcoes: PricingResult[] = [];
  for (let n = 1; n <= config.maxParcelas; n++) {
    opcoes.push(calcularPrecoFinal(precoBase, "CREDIT_CARD", n, config));
  }
  return opcoes;
}

/** R$ 1.234,56. */
export function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Mapeia tipo 'ui' (CadastroRefinadoState) para BillingType canônico Asaas. */
export function uiPagamentoToBillingType(
  uiPag: "pix" | "cartao" | "boleto",
): BillingType {
  if (uiPag === "pix") return "PIX";
  if (uiPag === "boleto") return "BOLETO";
  return "CREDIT_CARD";
}

/**
 * Helper de auditoria — útil para devs e relatórios.
 * Retorna o detalhamento de descontos esperados pelo Asaas
 * sobre o valorTotal. Confere "valor líquido = preco_base".
 *
 * Use no painel admin para validar contra o extrato Asaas real.
 */
export function auditarRecebimentoLiquido(
  pricing: PricingResult,
  config: CheckoutPricingConfig = DEFAULT_PRICING_CONFIG,
): {
  valorCobrado: number;
  descontoMdr: number;
  descontoAntecipacao: number;
  taxaFixa: number;
  liquidoEsperado: number;
  diffParaBase: number;
} {
  if (pricing.billingType === "PIX") {
    return {
      valorCobrado: pricing.valorTotal,
      descontoMdr: 0,
      descontoAntecipacao: 0,
      taxaFixa: 0,
      liquidoEsperado: pricing.valorTotal,
      diffParaBase: round2(pricing.valorTotal - pricing.precoBase),
    };
  }
  if (pricing.billingType === "BOLETO") {
    return {
      valorCobrado: pricing.valorTotal,
      descontoMdr: 0,
      descontoAntecipacao: 0,
      taxaFixa: config.asaas.taxaBoleto,
      liquidoEsperado: round2(pricing.valorTotal - config.asaas.taxaBoleto),
      diffParaBase: round2(
        pricing.valorTotal - config.asaas.taxaBoleto - pricing.precoBase,
      ),
    };
  }
  const n = pricing.parcelas;
  const mdr = mdrParaParcelas(n, config.asaas);
  const i = taxaAntecipacaoEfetiva(n, config.asaas);
  const pmt = pricing.valorParcela;
  const descontoMdr = round2(pmt * n * mdr);
  let descontoAntecipacao = 0;
  if (i > 0) {
    let acumulado = 0;
    for (let k = 1; k <= n; k++) {
      acumulado += pmt * (1 - mdr) * (1 - Math.pow(1 - i, k));
    }
    descontoAntecipacao = round2(acumulado);
  }
  const taxaFixa = config.asaas.taxaFixaCartao;
  const liquidoEsperado = round2(
    pmt * n - descontoMdr - descontoAntecipacao - taxaFixa,
  );
  return {
    valorCobrado: pricing.valorTotal,
    descontoMdr,
    descontoAntecipacao,
    taxaFixa,
    liquidoEsperado,
    diffParaBase: round2(liquidoEsperado - pricing.precoBase),
  };
}
