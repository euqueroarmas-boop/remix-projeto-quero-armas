export interface ChecklistMetricDoc {
  status: string | null;
}

export interface ChecklistMetrics {
  total: number;
  cumpridos: number;
  pendentes: number;
  emAnalise: number;
  outros: number;
  progresso: number;
}

const STATUS_CUMPRIDO = new Set(["aprovado", "validado", "concluido", "concluído", "dispensado_grupo"]);
const STATUS_ANALISE = new Set(["em_analise", "revisao_humana", "enviado"]);
const STATUS_PENDENTE = new Set(["pendente", "invalido", "divergente", "rejeitado", "pendente_reenvio", "expirado"]);

export function isChecklistCumprido(status: string | null | undefined): boolean {
  return STATUS_CUMPRIDO.has(String(status ?? "").toLowerCase());
}

export function isChecklistEmAnalise(status: string | null | undefined): boolean {
  return STATUS_ANALISE.has(String(status ?? "").toLowerCase());
}

export function isChecklistPendente(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").toLowerCase();
  return STATUS_PENDENTE.has(normalized) || (!STATUS_CUMPRIDO.has(normalized) && !STATUS_ANALISE.has(normalized));
}

export function computeChecklistMetrics<T extends ChecklistMetricDoc>(docs: T[]): ChecklistMetrics {
  const total = docs.length;
  const cumpridos = docs.filter((d) => isChecklistCumprido(d.status)).length;
  const emAnalise = docs.filter((d) => isChecklistEmAnalise(d.status)).length;
  const pendentes = docs.filter((d) => isChecklistPendente(d.status)).length;
  const outros = Math.max(0, total - cumpridos - emAnalise - pendentes);
  const progresso = total > 0 ? Math.round((cumpridos / total) * 100) : 0;

  return { total, cumpridos, pendentes, emAnalise, outros, progresso };
}

export function normalizeChecklistStage(etapa: string | null | undefined): "base" | "complementar" | "tecnico" | "final" {
  const normalized = String(etapa ?? "").toLowerCase();
  if (normalized === "base" || normalized === "complementar" || normalized === "tecnico" || normalized === "final") {
    return normalized;
  }
  if (normalized === "antecedentes") return "base";
  if (normalized === "declaracoes" || normalized === "renda") return "complementar";
  return "base";
}