export type TestStatus = "pass" | "fail" | "warn" | "pending" | "running" | "blocked" | "skipped";
export type Severity = "critical" | "high" | "medium" | "low";
export type ChecklistStatus = "approved" | "failed" | "review" | "fixed" | "blocked" | "pending";

export const QA_MODULES = [
  "home", "servicos", "segmentos", "blog", "contato", "whatsapp",
  "orcamento", "calculadora", "contratacao", "checkout", "compra-concluida",
  "contrato-pdf", "portal-cliente", "admin", "logs", "rotas",
  "seo", "responsividade", "integracoes", "webhooks", "edge-functions", "storage"
] as const;

export type QAModule = typeof QA_MODULES[number];

export const MODULE_LABELS: Record<QAModule, string> = {
  home: "Home", servicos: "Serviços", segmentos: "Segmentos", blog: "Blog",
  contato: "Contato", whatsapp: "WhatsApp", orcamento: "Orçamento",
  calculadora: "Calculadora", contratacao: "Contratação", checkout: "Checkout",
  "compra-concluida": "Compra Concluída", "contrato-pdf": "Contrato/PDF",
  "portal-cliente": "Portal do Cliente", admin: "Admin", logs: "Logs",
  rotas: "Rotas", seo: "SEO Básico", responsividade: "Responsividade",
  integracoes: "Integrações", webhooks: "Webhooks",
  "edge-functions": "Edge Functions", storage: "Storage"
};

export interface TestCase {
  id: string;
  name: string;
  module: QAModule;
  route?: string;
  scenario: string;
  severity: Severity;
  commercialImpact: number; // 1-5
  technicalImpact: number; // 1-5
  blocksPublish: boolean;
  run: () => Promise<TestResult>;
}

export interface TestResult {
  testId: string;
  status: TestStatus;
  message: string;
  technicalError?: string;
  evidence?: string;
  responseCode?: number;
  duration: number;
  executedAt: string;
  route?: string;
  dataUsed?: string;
}

export interface ModuleStats {
  module: QAModule;
  total: number;
  pass: number;
  fail: number;
  warn: number;
  pending: number;
  blocked: number;
  skipped: number;
  running: number;
  riskLevel: Severity;
  readyToPublish: "ready" | "caution" | "not_ready";
}

export interface ChecklistItem {
  id: string;
  module: QAModule;
  description: string;
  status: ChecklistStatus;
  notes?: string;
  updatedAt?: string;
}

export interface QAExecution {
  id: string;
  executedAt: string;
  environment: string;
  results: TestResult[];
  checklist: ChecklistItem[];
}

export function computePriorityScore(test: TestCase, result: TestResult): number {
  if (result.status === "pass") return 999;
  const sevScore = { critical: 1, high: 2, medium: 3, low: 4 }[test.severity];
  return sevScore * 10 + (5 - test.commercialImpact) * 3 + (5 - test.technicalImpact) * 2 + (test.blocksPublish ? 0 : 50);
}
