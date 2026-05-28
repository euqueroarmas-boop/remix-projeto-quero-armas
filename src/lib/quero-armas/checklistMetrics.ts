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

// ---------------------------------------------------------------------------
// FONTE ÚNICA DE CLASSIFICAÇÃO DE STATUS — Admin + Cliente
// ---------------------------------------------------------------------------
// Bloco 13: Admin (ProcessoDetalheDrawer) e Cliente (ChecklistGuiadoModal /
// ClienteProcessosSection / QAClientePortalPage) devem usar EXATAMENTE estes
// conjuntos para classificar um documento do checklist. Qualquer outro lugar
// que precise saber "este doc é pendência? em análise? cumprido?" deve
// importar daqui — nunca recriar listas inline.
export const STATUS_CHECKLIST_CUMPRIDO: ReadonlySet<string> = new Set([
  "aprovado",
  "validado",
  "concluido",
  "concluído",
  "dispensado",
  "dispensado_grupo",
  "dispensado_por_reaproveitamento",
  "nao_aplicavel",
]);

export const STATUS_CHECKLIST_EM_ANALISE: ReadonlySet<string> = new Set([
  "em_analise",
  "enviado",
  "fila",
  "processando",
  "revisao_humana",
  "em_revisao_humana",
  "pendente_aprovacao",
  "aguardando_equipe",
]);

export const STATUS_CHECKLIST_PENDENTE: ReadonlySet<string> = new Set([
  "pendente",
  "nao_enviado",
  "invalido",
  "reprovado",
  "rejeitado",
  "divergente",
  "ajuste_necessario",
  "correcao_solicitada",
  "pendente_reenvio",
  "expirado",
  "pulou",
]);

// Aliases legados — mantidos para compatibilidade interna deste módulo.
const STATUS_CUMPRIDO = STATUS_CHECKLIST_CUMPRIDO;
const STATUS_ANALISE = STATUS_CHECKLIST_EM_ANALISE;
const STATUS_PENDENTE = STATUS_CHECKLIST_PENDENTE;

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

// ---------------------------------------------------------------------------
// ORDENAÇÃO CANÔNICA DO CHECKLIST — Admin + Cliente devem usar este helper.
// Ordem: etapa numérica (1..5) → ordem do catálogo/processo → created_at → nome.
// O mapeamento de `etapa`/`tipo_documento` → número fica neste módulo para
// evitar dependência circular com o engine.
// ---------------------------------------------------------------------------
function etapaNumeroChecklist(tipo: string, etapaRaw: string | null | undefined): number {
  const raw = String(etapaRaw ?? "").trim().toLowerCase();
  if (/^[1-5]$/.test(raw)) return Number(raw);
  if (raw === "endereco" || raw === "endereço" || raw === "comprovacao_endereco") return 1;
  if (raw === "renda" || raw === "condicao_profissional" || raw === "condicao") return 2;
  if (raw === "antecedentes" || raw === "criminal") return 3;
  if (raw === "declaracoes" || raw === "declaracao" || raw === "compromissos") return 4;
  if (raw === "tecnico" || raw === "exames" || raw === "laudo" || raw === "psicologico") return 5;
  const t = (tipo || "").toLowerCase();
  if (t === "renda_definir_condicao" || t.startsWith("renda_")) return 2;
  if (t.startsWith("certidao") || t.includes("antecedentes")) return 3;
  if (
    t.includes("laudo") || t.includes("psicologic") ||
    t.includes("capacidade_tecnica") || t.includes("tiro") || t.includes("aptidao")
  ) return 5;
  if (
    t === "pergunta_comprovante_em_nome" ||
    t === "pergunta_ainda_reside_imovel" ||
    t === "pergunta_responde_inquerito_criminal" ||
    t === "declaracao_responsavel_imovel" ||
    t === "declaracao_sem_inquerito_processo_criminal"
  ) return 1;
  if (t.includes("endereco") || t.includes("residenc")) return 1;
  if (t.startsWith("declaracao") || t.startsWith("dsa_") || t.includes("compromisso")) return 4;
  return 1;
}

export interface ChecklistOrderableDoc {
  etapa?: string | null;
  tipo_documento?: string | null;
  ordem?: number | null;
  created_at?: string | null;
  nome_documento?: string | null;
}

/**
 * Ordenação canônica usada por Admin (ProcessoDetalheDrawer) e Cliente
 * (checklistGuiadoEngine / ChecklistGuiadoModal). Não muta o array de entrada.
 */
export function ordenarDocumentosChecklist<T extends ChecklistOrderableDoc>(docs: T[]): T[] {
  return [...docs].sort((a, b) => {
    const ea = etapaNumeroChecklist(String(a.tipo_documento ?? ""), a.etapa);
    const eb = etapaNumeroChecklist(String(b.tipo_documento ?? ""), b.etapa);
    if (ea !== eb) return ea - eb;
    const oa = typeof a.ordem === "number" ? a.ordem : Number.POSITIVE_INFINITY;
    const ob = typeof b.ordem === "number" ? b.ordem : Number.POSITIVE_INFINITY;
    if (oa !== ob) return oa - ob;
    const ca = String(a.created_at ?? "");
    const cb = String(b.created_at ?? "");
    if (ca && cb && ca !== cb) return ca < cb ? -1 : 1;
    return String(a.nome_documento ?? "").localeCompare(String(b.nome_documento ?? ""));
  });
}

// ---------------------------------------------------------------------------
// Bloco 14 — UX operacional do Admin no checklist.
// Retorna o próximo documento que ainda exige ação da Equipe Quero Armas,
// começando pelo item logo após `itemAtualId` na ordem canônica. Se não houver
// próximo na sequência, volta para o primeiro pendente da lista (wrap-around).
// Retorna null quando nenhum item está pendente.
// ---------------------------------------------------------------------------
export interface ProximoItemDoc extends ChecklistOrderableDoc {
  id: string;
  status: string | null;
}

export function getProximoItemAcionavelAdmin<T extends ProximoItemDoc>(
  docs: T[],
  itemAtualId: string | null | undefined,
): T | null {
  const ordenados = ordenarDocumentosChecklist(docs);
  const pendentes = ordenados.filter((d) => isChecklistPendente(d.status));
  if (pendentes.length === 0) return null;
  if (!itemAtualId) return pendentes[0];
  const idx = ordenados.findIndex((d) => d.id === itemAtualId);
  if (idx >= 0) {
    const seguinte = ordenados
      .slice(idx + 1)
      .find((d) => isChecklistPendente(d.status));
    if (seguinte) return seguinte;
  }
  // Sem próximo após o item atual — volta para o primeiro pendente (wrap).
  return pendentes[0];
}