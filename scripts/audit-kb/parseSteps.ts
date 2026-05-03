export type AuditStep = {
  n: number;
  route: string;
  wait?: string;
  click?: string;
  fill?: string;
  caption?: string;
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
    });
  }
  return steps.sort((a, b) => a.n - b.n);
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out[m[1]] = m[2];
  return out;
}