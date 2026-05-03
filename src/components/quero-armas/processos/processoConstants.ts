// Constantes compartilhadas para a Central de Documentos / Processos

export const STATUS_PROCESSO = {
  aguardando_pagamento: { label: "AGUARDANDO PAGAMENTO", color: "#94A3B8", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
  aguardando_documentos: { label: "AGUARDANDO DOCUMENTOS", color: "#3B82F6", bg: "bg-[#FBF3F4]", border: "border-[#E5C2C6]", text: "text-[#7A1F2B]" },
  em_validacao_ia: { label: "VALIDAÇÃO AUTOMÁTICA", color: "#6366F1", bg: "bg-[#FBF3F4]", border: "border-[#E5C2C6]", text: "text-[#7A1F2B]" },
  em_revisao_humana: { label: "EM REVISÃO HUMANA", color: "#0EA5E9", bg: "bg-[#FBF3F4]", border: "border-[#E5C2C6]", text: "text-[#7A1F2B]" },
  aprovado: { label: "DOCUMENTAÇÃO APROVADA", color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  em_andamento: { label: "EM ANDAMENTO", color: "#3B82F6", bg: "bg-[#FBF3F4]", border: "border-[#E5C2C6]", text: "text-[#7A1F2B]" },
  concluido: { label: "CONCLUÍDO", color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  cancelado: { label: "CANCELADO", color: "#64748B", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600" },
  bloqueado: { label: "BLOQUEADO", color: "#EF4444", bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
} as const;

export type StatusProcesso = keyof typeof STATUS_PROCESSO;

export const STATUS_DOCUMENTO = {
  pendente: { label: "PENDENTE", color: "#94A3B8", icon: "Clock" },
  enviado: { label: "ENVIADO", color: "#6366F1", icon: "Upload" },
  em_analise: { label: "EM ANÁLISE", color: "#8B5CF6", icon: "Sparkles" },
  revisao_humana: { label: "REVISÃO HUMANA", color: "#0EA5E9", icon: "Eye" },
  divergente: { label: "DIVERGENTE", color: "#F59E0B", icon: "AlertTriangle" },
  invalido: { label: "INVÁLIDO", color: "#EF4444", icon: "XCircle" },
  aprovado: { label: "APROVADO", color: "#10B981", icon: "CheckCircle" },
  dispensado_grupo: { label: "DISPENSADO (GRUPO SATISFEITO)", color: "#64748B", icon: "ShieldCheck" },
} as const;

export type StatusDocumento = keyof typeof STATUS_DOCUMENTO;

export function getStatusProcesso(s: string) {
  return STATUS_PROCESSO[s as StatusProcesso] ?? STATUS_PROCESSO.aguardando_documentos;
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