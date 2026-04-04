// ─── CMS Type Definitions ───

export type PageType = 'service' | 'segment';
export type PageStatus = 'draft' | 'published' | 'archived';

export interface CmsPage {
  id: string;
  page_type: PageType;
  slug: string;
  title: string;
  status: PageStatus;
  // SEO
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  noindex: boolean;
  sitemap_priority: string;
  sitemap_changefreq: string;
  // Content
  hero_data: HeroData;
  pain_data: PainItem[];
  solution_data: SolutionData;
  benefits_data: BenefitItem[];
  faq_data: FaqItem[];
  cta_data: CtaData;
  scope_data: ScopeData;
  proof_data: ProofItem[];
  // Segment-specific
  compliance_data: ComplianceData;
  niche_data: NicheData;
  // Calculator/pricing
  calculator_config: CalculatorConfig;
  pricing_config: PricingConfig;
  // Relations
  related_services: string[];
  related_segments: string[];
  // Composition
  blocks_order: BlockRef[];
  template: string;
  legacy_component: string | null;
  // Timestamps
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HeroData {
  tag?: string;
  headline?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
}

export interface PainItem {
  text: string;
}

export interface SolutionData {
  items?: string[];
}

export interface BenefitItem {
  icon?: string;
  title: string;
  text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface CtaData {
  title?: string;
  description?: string;
  buttonText?: string;
  whatsappMessage?: string;
}

export interface ScopeData {
  included?: string[];
  excluded?: string[];
  sla?: string;
  dependencies?: string[];
}

export interface ProofItem {
  type: 'testimonial' | 'logo' | 'stat';
  content: string;
  author?: string;
  company?: string;
}

export interface ComplianceData {
  regulations?: string[];
  certifications?: string[];
  requirements?: string[];
}

export interface NicheData {
  operationDetails?: string;
  specificPains?: string[];
  industryContext?: string;
}

export interface CalculatorConfig {
  enabled?: boolean;
  mode?: 'recorrente_only' | 'sob_demanda_only' | 'both';
  showHoursCalculator?: boolean;
}

export interface PricingConfig {
  customPricing?: boolean;
  baseMultiplier?: number;
}

export interface BlockRef {
  type: string;
  variant?: string;
  data?: Record<string, unknown>;
}

// Block types available
export const BLOCK_TYPES = [
  { type: 'HeroContainer', label: 'Hero', description: 'Banner principal com título e CTA' },
  { type: 'PainContainer', label: 'Dores', description: 'Lista de problemas do cliente' },
  { type: 'SolutionContainer', label: 'Soluções', description: 'Como resolvemos os problemas' },
  { type: 'BenefitsContainer', label: 'Benefícios', description: 'Vantagens do serviço' },
  { type: 'CalculatorContainer', label: 'Calculadora', description: 'Calculadora de preços' },
  { type: 'ProofContainer', label: 'Prova Social', description: 'Depoimentos e logos' },
  { type: 'FAQContainer', label: 'FAQ', description: 'Perguntas frequentes' },
  { type: 'CTAContainer', label: 'CTA', description: 'Chamada para ação final' },
  { type: 'SegmentFitContainer', label: 'Fit do Segmento', description: 'Por que serve ao nicho' },
  { type: 'ContractPreviewContainer', label: 'Preview Contrato', description: 'Visualização do contrato' },
] as const;

export interface CmsPricingRule {
  id: string;
  resource_type: 'host' | 'vm' | 'workstation';
  os_type: string;
  base_price: number;
  sla_standard_multiplier: number;
  sla_24h_multiplier: number;
  criticality_low: number;
  criticality_medium: number;
  criticality_high: number;
  progressive_discount: ProgressiveDiscount[];
  min_value: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgressiveDiscount {
  min: number;
  max: number;
  discount: number;
}

export interface CmsRedirect {
  id: string;
  from_slug: string;
  to_slug: string;
  active: boolean;
  created_at: string;
}

// Criticality assessment
export interface CriticalityAnswer {
  stopsOperation: boolean;
  hasSensitiveData: boolean;
  hasCompliance: boolean;
  needsAfterHours: boolean;
  userCount: 'small' | 'medium' | 'large';
  hasRedundancy: boolean;
  hasBackup: boolean;
  hasMonitoring: boolean;
}

export function calculateCriticality(answers: CriticalityAnswer): 'baixo' | 'medio' | 'alto' {
  let score = 0;
  if (answers.stopsOperation) score += 3;
  if (answers.hasSensitiveData) score += 2;
  if (answers.hasCompliance) score += 2;
  if (answers.needsAfterHours) score += 1;
  if (answers.userCount === 'large') score += 2;
  else if (answers.userCount === 'medium') score += 1;
  if (!answers.hasRedundancy) score += 1;
  if (!answers.hasBackup) score += 1;
  if (!answers.hasMonitoring) score += 1;
  
  if (score >= 8) return 'alto';
  if (score >= 4) return 'medio';
  return 'baixo';
}

// Default empty page
export function createEmptyPage(type: PageType): Partial<CmsPage> {
  return {
    page_type: type,
    slug: '',
    title: '',
    status: 'draft',
    meta_title: '',
    meta_description: '',
    canonical_url: null,
    og_image: null,
    noindex: false,
    sitemap_priority: '0.7',
    sitemap_changefreq: 'monthly',
    hero_data: {},
    pain_data: [],
    solution_data: { items: [] },
    benefits_data: [],
    faq_data: [],
    cta_data: {},
    scope_data: {},
    proof_data: [],
    compliance_data: {},
    niche_data: {},
    calculator_config: { enabled: true, mode: 'both' },
    pricing_config: {},
    related_services: [],
    related_segments: [],
    blocks_order: [],
    template: 'default',
    legacy_component: null,
  };
}
