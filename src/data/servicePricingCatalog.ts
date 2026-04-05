/**
 * WMTi Service Pricing Catalog — Single Source of Truth
 * 
 * Defines per-service pricing configuration:
 * - basePrice: first hour cost
 * - hasProgressiveDiscount: whether volume discounts apply
 * - maxDiscountPercent: ceiling for progressive discount
 * - hasRecurring: whether recurring/monthly plan is available
 * - hasHoursCalculator: whether hourly calculator is shown
 * - hasContactForm: whether "Fale Conosco" section is shown
 * - isConsultative: no calculator, only contact/WhatsApp
 * - contractHref: checkout route override
 */

export interface ServicePricingConfig {
  slug: string;
  name: string;
  basePrice: number;
  hasProgressiveDiscount: boolean;
  maxDiscountPercent: number;
  hasRecurring: boolean;
  hasHoursCalculator: boolean;
  hasContactForm: boolean;
  isConsultative: boolean;
  contractHref?: string;
}

/**
 * Generates a progressive discount price table.
 * Discount increases linearly from 0% at 1h to maxDiscount at 8h.
 */
export function generatePriceTable(
  basePrice: number,
  hasDiscount: boolean,
  maxDiscountPercent: number = 27.5
): Record<number, number> {
  const table: Record<number, number> = {};
  for (let h = 1; h <= 8; h++) {
    if (!hasDiscount || h === 1) {
      table[h] = basePrice;
    } else {
      // Linear interpolation: 0% at h=1, maxDiscount% at h=8
      const discountFraction = ((h - 1) / 7) * (maxDiscountPercent / 100);
      table[h] = Math.round(basePrice * (1 - discountFraction) * 100) / 100;
    }
  }
  return table;
}

export const SERVICE_PRICING_CATALOG: ServicePricingConfig[] = [
  {
    slug: "administracao-de-servidores",
    name: "Administração de Servidores",
    basePrice: 500,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "microsoft-365-para-empresas-jacarei",
    name: "Microsoft 365 Para Empresas",
    basePrice: 200,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "automacao-alexa",
    name: "Automação com Alexa",
    basePrice: 350,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: false,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "automacao-de-ti-com-inteligencia-artificial",
    name: "Automação de TI com IA",
    basePrice: 500,
    hasProgressiveDiscount: false,
    maxDiscountPercent: 0,
    hasRecurring: false,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "backup-empresarial-jacarei",
    name: "Backup Corporativo",
    basePrice: 400,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "desenvolvimento-de-sites-e-sistemas-web",
    name: "Desenvolvimento de Sites e Sistemas Web",
    basePrice: 500,
    hasProgressiveDiscount: false,
    maxDiscountPercent: 0,
    hasRecurring: false,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "firewall-pfsense-jacarei",
    name: "Firewall Corporativo pfSense",
    basePrice: 400,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "servidor-dell-poweredge-jacarei",
    name: "Implantação de Servidores Dell PowerEdge",
    basePrice: 500,
    hasProgressiveDiscount: false,
    maxDiscountPercent: 0,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "montagem-e-monitoramento-de-redes-jacarei",
    name: "Infraestrutura de Rede Corporativa",
    basePrice: 500,
    hasProgressiveDiscount: false,
    maxDiscountPercent: 0,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "infraestrutura-ti-corporativa-jacarei",
    name: "Infraestrutura de TI para Empresas",
    basePrice: 500,
    hasProgressiveDiscount: false,
    maxDiscountPercent: 0,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "manutencao-de-infraestrutura-de-ti",
    name: "Manutenção de Infraestrutura de TI",
    basePrice: 500,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "monitoramento-de-rede",
    name: "Monitoramento de Rede",
    basePrice: 500,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "monitoramento-de-servidores",
    name: "Monitoramento de Servidores",
    basePrice: 400,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "reestruturacao-completa-de-rede",
    name: "Reestruturação Completa de Rede",
    basePrice: 500,
    hasProgressiveDiscount: false,
    maxDiscountPercent: 0,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "suporte-linux",
    name: "Suporte Linux",
    basePrice: 400,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "suporte-tecnico-emergencial",
    name: "Suporte Técnico Emergencial para Estações de Trabalho",
    basePrice: 300,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: false,
    hasHoursCalculator: true,
    hasContactForm: false,
    isConsultative: false,
  },
  {
    slug: "suporte-tecnico-para-redes-corporativas",
    name: "Suporte Técnico para Redes Corporativas",
    basePrice: 500,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "suporte-windows-server",
    name: "Suporte Windows Server",
    basePrice: 500,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "seguranca-de-rede",
    name: "Segurança de Rede",
    basePrice: 500,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
  {
    slug: "terceirizacao-de-mao-de-obra-ti",
    name: "Terceirização de TI",
    basePrice: 0,
    hasProgressiveDiscount: false,
    maxDiscountPercent: 0,
    hasRecurring: false,
    hasHoursCalculator: false,
    hasContactForm: true,
    isConsultative: true,
  },
  {
    slug: "suporte-ti-jacarei",
    name: "Suporte Técnico Empresarial",
    basePrice: 200,
    hasProgressiveDiscount: true,
    maxDiscountPercent: 27.5,
    hasRecurring: true,
    hasHoursCalculator: true,
    hasContactForm: true,
    isConsultative: false,
  },
];

/** Lookup helper */
export function getServicePricing(slug: string): ServicePricingConfig | null {
  return SERVICE_PRICING_CATALOG.find((s) => s.slug === slug) ?? null;
}

/** Lookup by partial slug match */
export function getServicePricingByPartialSlug(pathname: string): ServicePricingConfig | null {
  const clean = pathname.replace(/^\//, "").split("?")[0];
  return SERVICE_PRICING_CATALOG.find((s) => clean === s.slug || clean.startsWith(s.slug)) ?? null;
}
