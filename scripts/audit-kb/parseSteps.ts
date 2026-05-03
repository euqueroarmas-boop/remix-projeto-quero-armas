export type AuditStep = {
  n: number;
  route: string;
  wait?: string;
  click?: string;
  fill?: string;
  caption?: string;
  expected_text?: string[];
  confidence?: number;
  source?: "manual" | "ai_plan";
};

/**
 * Lê o body do artigo procurando blocos:
 *   <!-- audit-step n="1" route="/path" wait="text=X" click="..." fill="sel::valor" -->
 *   conteúdo opcional / título do passo
 *   <!-- /audit-step -->
 * Retorna lista ordenada de passos auditáveis.
 */
export function parseAuditSteps(body: string): AuditStep[] {
  if (!body) return [];
  const re = /<!--\s*audit-step\s+([^>]+?)-->([\s\S]*?)<!--\s*\/audit-step\s*-->/gi;
  const steps: AuditStep[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const attrs = parseAttrs(m[1]);
    const n = Number(attrs.n);
    const route = attrs.route;
    if (!Number.isFinite(n) || !route) continue;
    steps.push({
      n,
      route,
      wait: attrs.wait,
      click: attrs.click,
      fill: attrs.fill,
      caption: (m[2] || "").trim().slice(0, 240) || undefined,
      source: "manual",
      confidence: 1,
    });
  }
  return steps.sort((a, b) => a.n - b.n);
}

export type AuditPlan = {
  intent?: string;
  entities?: string[];
  candidate_routes?: string[];
  steps?: Array<{
    n: number;
    route: string;
    caption?: string;
    expected_text?: string[];
    click?: string;
    fill?: string;
    wait?: string;
    confidence?: number;
  }>;
  overall_confidence?: number;
  needs_human_review?: boolean;
  notes?: string;
};

/**
 * Converte um plano gerado pela IA em AuditStep[] usado pelo capture.
 * Filtra passos com confidence < minConfidence.
 */
export function planToSteps(plan: AuditPlan | null | undefined, minConfidence = 0.6): AuditStep[] {
  if (!plan?.steps?.length) return [];
  return plan.steps
    .filter((s) => s && s.route && (s.confidence ?? 0) >= minConfidence)
    .map((s) => ({
      n: s.n,
      route: s.route,
      caption: s.caption,
      click: s.click,
      fill: s.fill,
      wait: s.wait,
      expected_text: s.expected_text ?? [],
      confidence: s.confidence ?? 0,
      source: "ai_plan" as const,
    }))
    .sort((a, b) => a.n - b.n);
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out[m[1]] = m[2];
  return out;
}