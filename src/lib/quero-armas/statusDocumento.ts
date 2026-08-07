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
  const status = normalizarStatusDocumento(raw);
  if (status === "dispensado") {
    return isReaproveitamento(raw) ? "REAPROVEITADO" : "DISPENSADO POR LEI";
  }
  return LABELS[status];
}

/**
 * Dentro de "dispensado" existem duas histórias diferentes:
 *  - reaproveitamento (o documento já existe no Hub);
 *  - dispensa legal (a categoria do titular não exige o documento).
 * A tela precisa dizer qual é.
 */
const ALIAS_REAPROVEITAMENTO = new Set([
  "reaproveitado",
  "hub_reaproveitado",
  "dispensado_por_reaproveitamento",
  "dispensado_grupo",
]);

export function isReaproveitamento(raw?: string | null): boolean {
  return ALIAS_REAPROVEITAMENTO.has(normalizarChaveStatus(raw));
}

/** True quando a dispensa vem da lei/categoria do titular, não de reaproveitamento. */
export function isDispensadoPorLei(raw?: string | null): boolean {
  return normalizarStatusDocumento(raw) === "dispensado" && !isReaproveitamento(raw);
}

/* -----------------------------------------------------------------------------
 * BLOCO 5 — Vocabulário exibido ao CLIENTE
 *
 * A equipe fala "PENDENTE/REPROVADO"; o cliente precisa de instrução, não de
 * jargão interno. Este é o único lugar onde a tradução para o portal existe.
 * --------------------------------------------------------------------------- */
const LABELS_CLIENTE: Record<StatusDocCanonico, string> = {
  pendente: "TE AGUARDANDO",
  em_analise: "EM ANÁLISE",
  aprovado: "APROVADO",
  reprovado: "REENVIAR",
  dispensado: "JÁ RESOLVIDO",
  vencido: "VENCIDO",
  arquivado: "ARQUIVADO",
};

/** Label UPPERCASE para telas do portal do cliente. */
export function labelStatusDocumentoCliente(raw?: string | null): string {
  const status = normalizarStatusDocumento(raw);
  if (status === "dispensado") {
    return isReaproveitamento(raw) ? "JÁ RESOLVIDO" : "DISPENSADO POR LEI";
  }
  return LABELS_CLIENTE[status];
}

const CLASSES: Record<StatusDocCanonico, string> = {
  pendente: "bg-[#7A1F2B]/10 text-[#7A1F2B] border-[#7A1F2B]/30",
  em_analise: "bg-amber-100 text-amber-700 border-amber-300",
  aprovado: "bg-emerald-100 text-emerald-700 border-emerald-300",
  reprovado: "bg-red-100 text-red-700 border-red-300",
  dispensado: "bg-emerald-100 text-emerald-700 border-emerald-300",
  vencido: "bg-red-100 text-red-700 border-red-300",
  arquivado: "bg-slate-100 text-slate-600 border-slate-300",
};

/** Badge canônico (label + classes + cor) — evita mapas locais por tela. */
export function badgeStatusDocumento(
  raw?: string | null,
  audiencia: "equipe" | "cliente" = "equipe",
): { status: StatusDocCanonico; label: string; cls: string; cor: string } {
  const status = normalizarStatusDocumento(raw);
  return {
    status,
    label: audiencia === "cliente" ? labelStatusDocumentoCliente(raw) : labelStatusDocumento(raw),
    cls: CLASSES[status],
    cor: CORES[status],
  };
}

/** Tom visual canônico usado por listas e cockpit. */
export function toneStatusDocumento(raw?: string | null): "green" | "amber" | "red" | "gray" {
  switch (normalizarStatusDocumento(raw)) {
    case "aprovado":
    case "dispensado":
      return "green";
    case "em_analise":
      return "amber";
    case "reprovado":
    case "vencido":
      return "red";
    default:
      return "gray";
  }
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
