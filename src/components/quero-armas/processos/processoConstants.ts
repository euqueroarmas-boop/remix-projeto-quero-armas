// Constantes compartilhadas para a Central de Documentos / Processos

// ============================================================================
// STATUS DO PROCESSO — vocabulário ÚNICO, o mesmo do banco
// ----------------------------------------------------------------------------
// Até 18/08/2026 existiam DUAS listas de status que não conversavam:
//
//   • A tela oferecia `em_validacao_ia`, `em_revisao_humana`, `aprovado` e
//     `em_andamento` — nenhum dos quatro é aceito pelo CHECK de
//     `qa_processos.status`. Clicar em qualquer um deles dava erro de
//     constraint na cara do operador. Sempre deu: como o CHECK existe, nenhum
//     processo jamais esteve nesses estados.
//
//   • E sete status que o banco usa de verdade (`aguardando_assinatura`,
//     `em_validacao`, `pendente_cliente`, `revisao_humana`, `validado`,
//     `pagamento_confirmado`, `em_analise_interna`) não existiam aqui e caíam
//     todos no fallback "AGUARDANDO DOCUMENTOS". O pior deles é o primeiro:
//     cliente que pagou e não assinou o contrato aparecia para a equipe como
//     se devesse documento — a instrução errada, na tela de quem atende.
//
// Este mapa agora é EXATAMENTE o CHECK de `qa_processos_status_check`
// (migration 20260816260000). O teste `statusProcessoParidadeBanco.test.ts` lê
// a migration e falha se as duas listas divergirem de novo.
// ============================================================================

export const STATUS_PROCESSO = {
  // ── Antes do checklist ────────────────────────────────────────────────────
  aguardando_pagamento: { label: "AGUARDANDO PAGAMENTO", color: "#94A3B8", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
  pagamento_confirmado: { label: "PAGAMENTO CONFIRMADO", color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  // Pagou, mas o contrato não está `validated`. A RPC de confirmação de
  // pagamento para aqui de propósito e NÃO explode o checklist — cobrar
  // documento neste estado é cobrar a coisa errada.
  aguardando_assinatura: { label: "AGUARDANDO ASSINATURA DO CONTRATO", color: "#F97316", bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-900" },

  // ── Documentação ──────────────────────────────────────────────────────────
  aguardando_documentos: { label: "AGUARDANDO DOCUMENTOS", color: "#2F3337", bg: "bg-[#F7F7F8]", border: "border-[#D1D3D6]", text: "text-[#2F3337]" },
  em_validacao: { label: "VALIDAÇÃO AUTOMÁTICA", color: "#6366F1", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800" },
  revisao_humana: { label: "EM REVISÃO HUMANA", color: "#0EA5E9", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
  em_analise_interna: { label: "EM ANÁLISE INTERNA", color: "#0EA5E9", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
  pendente_cliente: { label: "PENDENTE COM O CLIENTE", color: "#F97316", bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-900" },
  validado: { label: "DOCUMENTAÇÃO APROVADA", color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },

  // ── Protocolo ─────────────────────────────────────────────────────────────
  pronto_para_protocolar: { label: "PRONTO PARA PROTOCOLAR", color: "#16A34A", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800" },
  protocolado: { label: "PROTOCOLADO", color: "#0EA5E9", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
  em_analise_orgao: { label: "EM ANÁLISE PELO ÓRGÃO", color: "#6366F1", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800" },

  // A vida do processo na PF é mais longa que protocolado→decisão. Sem estes
  // dois, `getStatusProcesso` cai no fallback e a tela da equipe mostraria
  // "AGUARDANDO DOCUMENTOS" num processo que está com prazo de 10 dias correndo.
  notificado: { label: "NOTIFICADO PELA PF", color: "#F59E0B", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900" },
  recurso_administrativo: { label: "RECURSO PROTOCOLADO", color: "#6366F1", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800" },

  // ── Decisão e encerramento ────────────────────────────────────────────────
  deferido: { label: "DEFERIDO", color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  indeferido: { label: "INDEFERIDO", color: "#EF4444", bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
  concluido: { label: "CONCLUÍDO", color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  cancelado: { label: "CANCELADO", color: "#64748B", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600" },
  bloqueado: { label: "BLOQUEADO", color: "#EF4444", bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
} as const;

export type StatusProcesso = keyof typeof STATUS_PROCESSO;

/** As 19 chaves do CHECK do banco, na ordem do fluxo. Base do teste de paridade. */
export const STATUS_PROCESSO_CANONICOS = Object.keys(STATUS_PROCESSO) as StatusProcesso[];

/**
 * Rótulos LEGADOS — só para exibição, nunca para gravar.
 *
 * São os quatro valores que a tela oferecia e o banco recusa. Nenhum processo
 * pode estar neles (o CHECK impede), mas há telas e logs antigos que ainda
 * carregam a string; mantê-los aqui evita que apareçam como "AGUARDANDO
 * DOCUMENTOS" numa auditoria histórica. Não entram em nenhum seletor.
 */
export const STATUS_PROCESSO_LEGADO = {
  em_validacao_ia: STATUS_PROCESSO.em_validacao,
  em_revisao_humana: STATUS_PROCESSO.revisao_humana,
  aprovado: STATUS_PROCESSO.validado,
  em_andamento: STATUS_PROCESSO.em_analise_interna,
} as const;

/**
 * Status que a equipe NÃO altera pelo seletor livre.
 *
 * `protocolado` carrega número, órgão, data, evento de auditoria e o e-mail ao
 * cliente — tudo isso vive no modal "MARCAR COMO PROTOCOLADO". Oferecer o
 * botão solto no seletor permitia protocolar um processo sem número e sem
 * avisar ninguém.
 */
export const STATUS_SOMENTE_VIA_FLUXO: ReadonlySet<string> = new Set(["protocolado"]);

/**
 * Máquina de estados do processo: de onde para onde a equipe pode mover.
 *
 * Não é burocracia — é o que impede pular do checklist direto para "deferido",
 * ou voltar um processo protocolado para "aguardando pagamento". `cancelado` e
 * `bloqueado` saem de quase todo lugar porque são as saídas de emergência.
 */
export const TRANSICOES_PROCESSO: Record<StatusProcesso, StatusProcesso[]> = {
  aguardando_pagamento: ["pagamento_confirmado", "aguardando_assinatura", "aguardando_documentos", "bloqueado", "cancelado"],
  pagamento_confirmado: ["aguardando_assinatura", "aguardando_documentos", "bloqueado", "cancelado"],
  aguardando_assinatura: ["aguardando_documentos", "bloqueado", "cancelado"],

  aguardando_documentos: ["em_validacao", "revisao_humana", "em_analise_interna", "pendente_cliente", "validado", "pronto_para_protocolar", "bloqueado", "cancelado"],
  em_validacao: ["revisao_humana", "em_analise_interna", "pendente_cliente", "aguardando_documentos", "validado", "pronto_para_protocolar", "bloqueado", "cancelado"],
  revisao_humana: ["aguardando_documentos", "pendente_cliente", "em_analise_interna", "validado", "pronto_para_protocolar", "bloqueado", "cancelado"],
  em_analise_interna: ["aguardando_documentos", "revisao_humana", "pendente_cliente", "validado", "pronto_para_protocolar", "bloqueado", "cancelado"],
  pendente_cliente: ["aguardando_documentos", "em_validacao", "revisao_humana", "bloqueado", "cancelado"],
  validado: ["pronto_para_protocolar", "aguardando_documentos", "bloqueado", "cancelado"],

  // Daqui só se sai protocolando — e protocolar é pelo modal, não pelo seletor.
  pronto_para_protocolar: ["aguardando_documentos", "bloqueado", "cancelado"],

  protocolado: ["em_analise_orgao", "notificado", "deferido", "indeferido", "cancelado"],
  em_analise_orgao: ["notificado", "deferido", "indeferido", "cancelado"],
  notificado: ["em_analise_orgao", "deferido", "indeferido", "cancelado"],
  indeferido: ["recurso_administrativo", "concluido", "cancelado"],
  recurso_administrativo: ["em_analise_orgao", "deferido", "indeferido", "concluido", "cancelado"],

  deferido: ["concluido"],
  concluido: [],
  cancelado: [],
  // Saída do bloqueio: volta para onde o cliente consegue agir.
  bloqueado: ["aguardando_documentos", "pendente_cliente", "cancelado"],
};

/**
 * Para onde a equipe pode mover um processo que está em `atual`.
 * Já remove os status que só existem dentro de um fluxo próprio (protocolado).
 */
export function transicoesPermitidas(atual: string | null | undefined): StatusProcesso[] {
  const s = String(atual ?? "").trim().toLowerCase() as StatusProcesso;
  const destinos = TRANSICOES_PROCESSO[s];
  // Status desconhecido (processo legado, dado sujo): não adivinha caminho —
  // oferece só as saídas seguras, para o operador não ficar sem ação nenhuma.
  const base = destinos ?? (["aguardando_documentos", "bloqueado", "cancelado"] as StatusProcesso[]);
  return base.filter((d) => !STATUS_SOMENTE_VIA_FLUXO.has(d));
}

export const STATUS_DOCUMENTO = {
  pendente: { label: "PENDENTE", color: "#94A3B8", icon: "Clock" },
  enviado: { label: "ENVIADO", color: "#6366F1", icon: "Upload" },
  em_analise: { label: "EM ANÁLISE", color: "#8B5CF6", icon: "Sparkles" },
  revisao_humana: { label: "REVISÃO HUMANA", color: "#0EA5E9", icon: "Eye" },
  divergente: { label: "DIVERGENTE", color: "#F59E0B", icon: "AlertTriangle" },
  // Devolvido pela equipe para o cliente ajustar (hoje: efetiva necessidade,
  // via qa-efetiva-revisar). Sem esta entrada caía no fallback e a petição
  // devolvida aparecia como "PENDENTE" — o cliente não descobria que havia um
  // motivo escrito esperando por ele.
  ajuste_necessario: { label: "AJUSTE NECESSÁRIO", color: "#F97316", icon: "AlertTriangle" },
  invalido: { label: "INVÁLIDO", color: "#EF4444", icon: "XCircle" },
  aprovado: { label: "APROVADO", color: "#10B981", icon: "CheckCircle" },
  dispensado_por_reaproveitamento: { label: "REAPROVEITADO", color: "#059669", icon: "Database" },
  entregue_pelo_hub: { label: "ENTREGUE PELO HUB", color: "#10B981", icon: "CheckCircle" },
  dispensado_grupo: { label: "DISPENSADO (GRUPO SATISFEITO)", color: "#64748B", icon: "ShieldCheck" },
} as const;

export type StatusDocumento = keyof typeof STATUS_DOCUMENTO;

export function getStatusProcesso(s: string) {
  const chave = String(s ?? "").trim().toLowerCase();
  return (
    STATUS_PROCESSO[chave as StatusProcesso] ??
    STATUS_PROCESSO_LEGADO[chave as keyof typeof STATUS_PROCESSO_LEGADO] ??
    STATUS_PROCESSO.aguardando_documentos
  );
}

/**
 * Retorna metadata de exibição do status do documento.
 * Se `iaStatus = "processando"` e o status real for `em_analise`, exibe label "VALIDANDO IA"
 * (apenas visual, o status real persistido continua `em_analise`).
 */
export function getStatusDocumento(s: string, iaStatus?: string | null) {
  const base = STATUS_DOCUMENTO[s as StatusDocumento] ?? STATUS_DOCUMENTO.pendente;
  if (s === "em_analise" && iaStatus === "processando") {
    return { ...base, label: "VALIDANDO IA" };
  }
  return base;
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
  } catch { return "—"; }
}

export function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR");
  } catch { return "—"; }
}
// ============================================================================
// PROTOCOLO NO ÓRGÃO — leitura única
// ----------------------------------------------------------------------------
// O número vivia dentro de `respostas_questionario_json.protocolo`, um blob que
// outros dez pontos do sistema reescrevem inteiro sem trava. A partir da
// migration 20260818110000 a verdade são as colunas `protocolo_*`; o JSON
// continua sendo escrito como espelho e é lido aqui só como retaguarda, para
// processo antigo que ainda não passou pelo backfill.
// ============================================================================

export interface ProtocoloProcesso {
  numero: string | null;
  orgao: string | null;
  data: string | null;
  observacao: string | null;
  registradoEm: string | null;
}

interface ProcessoComProtocolo {
  protocolo_numero?: string | null;
  protocolo_orgao?: string | null;
  protocolo_data?: string | null;
  protocolo_observacao?: string | null;
  protocolo_registrado_em?: string | null;
  respostas_questionario_json?: unknown;
}

function texto(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/** Lê o protocolo do processo: coluna primeiro, JSON legado como retaguarda. */
export function protocoloDoProcesso(
  p: ProcessoComProtocolo | null | undefined,
): ProtocoloProcesso {
  const legado = ((p?.respostas_questionario_json as { protocolo?: Record<string, unknown> } | null)
    ?.protocolo ?? {}) as Record<string, unknown>;
  return {
    numero: texto(p?.protocolo_numero) ?? texto(legado.numero_protocolo) ?? texto(legado.numero),
    orgao: texto(p?.protocolo_orgao) ?? texto(legado.orgao),
    data: texto(p?.protocolo_data) ?? texto(legado.data_protocolo),
    observacao: texto(p?.protocolo_observacao) ?? texto(legado.observacao),
    registradoEm: texto(p?.protocolo_registrado_em) ?? texto(legado.registrado_em),
  };
}
