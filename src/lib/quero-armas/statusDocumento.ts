/* =============================================================================
 * BLOCO 2 — Dicionário canônico de status de DOCUMENTO (Quero Armas)
 *
 * Uma exigência/documento vive em duas tabelas (`qa_processo_documentos` e
 * `qa_documentos_cliente`) e é lida por Hub, checklist, portal do cliente,
 * carimbos e KPIs. Cada camada havia criado seu vocabulário
 * (aprovado/validado/conforme, pendente/aguardando/em_analise,
 * reprovado/recusado/nao_conforme), o que gerava progresso errado, carimbo
 * divergente e pendência que some ou reaparece.
 *
 * Aqui está a ÚNICA tradução aceita. Não escreve em banco: normaliza leitura.
 * ============================================================================= */

export type StatusDocCanonico =
  | "pendente"
  | "em_analise"
  | "aprovado"
  | "reprovado"
  | "dispensado"
  | "vencido"
  | "arquivado";

export type FamiliaStatusDoc = "pendencia" | "analise" | "cumprido" | "encerrado";

/** Normalização crua: minúsculas, sem acento, separadores unificados. */
export function normalizarChaveStatus(raw?: string | null): string {
  if (!raw) return "";
  return String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[\s\-/]+/g, "_")
    .replace(/_+/g, "_");
}

/** Todo alias legado conhecido → código canônico. */
const ALIAS_STATUS_DOC: Record<string, StatusDocCanonico> = {
  // ── cumprido ──────────────────────────────────────────────────────────────
  aprovado: "aprovado",
  aprovada: "aprovado",
  validado: "aprovado",
  validada: "aprovado",
  conforme: "aprovado",
  concluido: "aprovado",
  entregue: "aprovado",
  ok: "aprovado",
  pre_validado: "aprovado",

  // ── dispensado (cumprido sem envio) ───────────────────────────────────────
  dispensado: "dispensado",
  dispensado_grupo: "dispensado",
  dispensado_por_reaproveitamento: "dispensado",
  nao_aplicavel: "dispensado",
  reaproveitado: "dispensado",
  hub_reaproveitado: "dispensado",

  // ── em análise ────────────────────────────────────────────────────────────
  em_analise: "em_analise",
  analise: "em_analise",
  enviado: "em_analise",
  recebido: "em_analise",
  fila: "em_analise",
  processando: "em_analise",
  revisao_humana: "em_analise",
  em_revisao_humana: "em_analise",
  pendente_aprovacao: "em_analise",
  aguardando_aprovacao: "em_analise",
  aguardando_equipe: "em_analise",

  // ── pendência ─────────────────────────────────────────────────────────────
  pendente: "pendente",
  pendente_reenvio: "pendente",
  aguardando: "pendente",
  aguardando_envio: "pendente",
  nao_enviado: "pendente",
  faltando: "pendente",
  pulou: "pendente",

  // ── reprovado ─────────────────────────────────────────────────────────────
  reprovado: "reprovado",
  reprovada: "reprovado",
  rejeitado: "reprovado",
  rejeitada: "reprovado",
  recusado: "reprovado",
  recusada: "reprovado",
  nao_conforme: "reprovado",
  invalido: "reprovado",
  invalidado: "reprovado",
  divergente: "reprovado",
  ajuste_necessario: "reprovado",
  correcao_solicitada: "reprovado",

  // ── vencido ───────────────────────────────────────────────────────────────
  vencido: "vencido",
  vencida: "vencido",
  expirado: "vencido",
  expirada: "vencido",

  // ── encerrado / fora do fluxo ─────────────────────────────────────────────
  substituido: "arquivado",
  excluido: "arquivado",
  descartado: "arquivado",
  descartado_por_troca_servico: "arquivado",
  cancelado: "arquivado",
};

/** Status canônico de qualquer string vinda de qualquer tabela/camada. */
export function normalizarStatusDocumento(raw?: string | null): StatusDocCanonico {
  const chave = normalizarChaveStatus(raw);
  if (!chave) return "pendente";
  return ALIAS_STATUS_DOC[chave] ?? "pendente";
}

/** Família usada por contadores e barras de progresso. */
export function familiaStatusDocumento(raw?: string | null): FamiliaStatusDoc {
  switch (normalizarStatusDocumento(raw)) {
    case "aprovado":
    case "dispensado":
      return "cumprido";
    case "em_analise":
      return "analise";
    case "arquivado":
      return "encerrado";
    default:
      return "pendencia";
  }
}

export function isDocCumprido(raw?: string | null): boolean {
  return familiaStatusDocumento(raw) === "cumprido";
}
export function isDocEmAnalise(raw?: string | null): boolean {
  return familiaStatusDocumento(raw) === "analise";
}
export function isDocPendencia(raw?: string | null): boolean {
  return familiaStatusDocumento(raw) === "pendencia";
}
export function isDocEncerrado(raw?: string | null): boolean {
  return familiaStatusDocumento(raw) === "encerrado";
}

const LABELS: Record<StatusDocCanonico, string> = {
  pendente: "PENDENTE",
  em_analise: "EM ANÁLISE",
  aprovado: "APROVADO",
  reprovado: "REPROVADO",
  dispensado: "DISPENSADO",
  vencido: "VENCIDO",
  arquivado: "ARQUIVADO",
};

/** Label UPPERCASE único para badges, carimbos e KPIs. */
export function labelStatusDocumento(raw?: string | null): string {
  return LABELS[normalizarStatusDocumento(raw)];
}

const CORES: Record<StatusDocCanonico, string> = {
  pendente: "#7A1F2B",
  em_analise: "#B45309",
  aprovado: "#15803D",
  reprovado: "#B91C1C",
  dispensado: "#15803D",
  vencido: "#B91C1C",
  arquivado: "#6B7280",
};

/** Cor canônica (hex) do status — evita paletas divergentes por tela. */
export function corStatusDocumento(raw?: string | null): string {
  return CORES[normalizarStatusDocumento(raw)];
}

/** Tipo do carimbo exibido ao cliente após o envio. */
export function carimboStatusDocumento(raw?: string | null): "aprovado" | "analise" | "reprovado" {
  const s = normalizarStatusDocumento(raw);
  if (s === "aprovado" || s === "dispensado") return "aprovado";
  if (s === "em_analise") return "analise";
  return "reprovado";
}
