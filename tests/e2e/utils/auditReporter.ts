import fs from "node:fs";
import path from "node:path";

export type AuditSeverity = "ok" | "info" | "warn" | "error" | "critical";
export type AuditCategory =
  | "route"
  | "journey"
  | "visual"
  | "console"
  | "network"
  | "ux"
  | "terminology";

export interface AuditEntry {
  category: AuditCategory;
  severity: AuditSeverity;
  route?: string;
  step?: string;
  message: string;
  expected?: string;
  found?: string;
  evidence?: string;
  hint?: string;
  file?: string;
  recommendation?: string;
  timestamp: string;
}

const OUT_DIR = path.resolve("test-results/quero-armas-audit");
const JSON_PATH = path.join(OUT_DIR, "audit-report.json");
const MD_PATH = path.join(OUT_DIR, "audit-report.md");

function ensureDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function loadEntries(): AuditEntry[] {
  ensureDir();
  if (!fs.existsSync(JSON_PATH)) return [];
  try {
    const raw = fs.readFileSync(JSON_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: AuditEntry[]) {
  ensureDir();
  fs.writeFileSync(
    JSON_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2),
  );
  fs.writeFileSync(MD_PATH, renderMarkdown(entries));
}

export function recordAudit(entry: Omit<AuditEntry, "timestamp">) {
  const entries = loadEntries();
  entries.push({ ...entry, timestamp: new Date().toISOString() });
  saveEntries(entries);
}

export function resetAudit() {
  ensureDir();
  saveEntries([]);
}

const SEV_RANK: Record<AuditSeverity, number> = {
  ok: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

function renderMarkdown(entries: AuditEntry[]): string {
  const byCat = (c: AuditCategory) => entries.filter((e) => e.category === c);
  const bySev = (s: AuditSeverity) => entries.filter((e) => e.severity === s);

  const routes = new Set(entries.map((e) => e.route).filter(Boolean));
  const critical = bySev("critical");
  const errors = bySev("error");
  const warns = bySev("warn");
  const visual = byCat("visual");
  const terminology = byCat("terminology");

  const lines: string[] = [];
  lines.push("# Auditoria de Jornada Quero Armas");
  lines.push("");
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Resumo executivo");
  lines.push("");
  lines.push(`- Rotas testadas: **${routes.size}**`);
  lines.push(`- Fluxos/passos registrados: **${entries.length}**`);
  lines.push(`- Quebras críticas: **${critical.length}**`);
  lines.push(`- Erros: **${errors.length}**`);
  lines.push(`- Atenções: **${warns.length}**`);
  lines.push(`- Problemas visuais: **${visual.length}**`);
  lines.push(`- Ocorrências de termo "admin" na UI: **${terminology.length}**`);
  lines.push("");
  const next =
    critical[0] ||
    errors[0] ||
    warns[0] ||
    entries.find((e) => e.severity !== "ok");
  lines.push(
    `- Próxima ação recomendada: ${
      next
        ? `**${next.recommendation || next.message}**${next.file ? ` (\`${next.file}\`)` : ""}`
        : "Sem ações críticas."
    }`,
  );
  lines.push("");

  lines.push("## Jornada humana testada");
  lines.push("");
  const journey = byCat("journey").sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp),
  );
  if (journey.length === 0) {
    lines.push("_Nenhum passo de jornada registrado._");
  } else {
    for (const e of journey) {
      lines.push(`### ${e.step || e.message}`);
      lines.push("");
      lines.push(`- Rota: \`${e.route || "-"}\``);
      lines.push(`- Esperado: ${e.expected || "-"}`);
      lines.push(`- Encontrado: ${e.found || "-"}`);
      lines.push(`- Status: **${severityLabel(e.severity)}**`);
      if (e.evidence) lines.push(`- Evidência: \`${e.evidence}\``);
      if (e.hint) lines.push(`- Hipótese: ${e.hint}`);
      if (e.file) lines.push(`- Arquivo provável: \`${e.file}\``);
      if (e.recommendation) lines.push(`- Correção: ${e.recommendation}`);
      lines.push("");
    }
  }

  lines.push("## Rotas quebradas");
  lines.push("");
  const broken = byCat("route")
    .filter((e) => SEV_RANK[e.severity] >= SEV_RANK.warn)
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
  if (broken.length === 0) {
    lines.push("_Nenhuma rota com falha detectada._");
  } else {
    lines.push("| Rota | Severidade | Problema | Possível causa | Evidência |");
    lines.push("|------|------------|----------|----------------|-----------|");
    for (const e of broken) {
      lines.push(
        `| \`${e.route || "-"}\` | ${severityLabel(e.severity)} | ${md(e.message)} | ${md(e.hint || "-")} | ${md(e.evidence || "-")} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Problemas de UX / Premium Layout");
  lines.push("");
  const uxIssues = [...byCat("visual"), ...byCat("ux")].sort(
    (a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity],
  );
  if (uxIssues.length === 0) {
    lines.push("_Nenhum problema visual detectado._");
  } else {
    lines.push("| Tela | Problema | Esperado | Correção sugerida |");
    lines.push("|------|----------|----------|-------------------|");
    for (const e of uxIssues) {
      lines.push(
        `| \`${e.route || "-"}\` | ${md(e.message)} | ${md(e.expected || "-")} | ${md(e.recommendation || "-")} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Termos proibidos detectados na UI");
  lines.push("");
  if (terminology.length === 0) {
    lines.push("_Nenhum termo proibido visível._");
  } else {
    lines.push("| Rota | Termo encontrado | Recomendação |");
    lines.push("|------|------------------|--------------|");
    for (const e of terminology) {
      lines.push(
        `| \`${e.route || "-"}\` | ${md(e.found || "-")} | ${md(e.recommendation || 'Substituir por "Equipe Quero Armas".')} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Conclusão");
  lines.push("");
  if (critical.length === 0 && errors.length === 0) {
    lines.push(
      "Nenhuma quebra crítica detectada no fluxo público. Revisar avisos visuais e de UX listados acima para alinhamento Premium Light.",
    );
  } else {
    lines.push("Pontos prioritários encontrados:");
    lines.push("");
    for (const e of [...critical, ...errors].slice(0, 12)) {
      lines.push(
        `- **${e.route || e.step || "fluxo"}** — ${e.message}${e.file ? ` (\`${e.file}\`)` : ""}`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

function severityLabel(s: AuditSeverity): string {
  switch (s) {
    case "ok":
      return "OK";
    case "info":
      return "Info";
    case "warn":
      return "Atenção";
    case "error":
      return "Quebrado";
    case "critical":
      return "CRÍTICO";
  }
}

function md(s: string): string {
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}