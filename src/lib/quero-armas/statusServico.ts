/**
 * Fonte única dos 15 status canônicos do fluxo operacional Quero Armas.
 * Espelha o CHECK constraint chk_qa_status_servico_v2 em qa_solicitacoes_servico.
 * NÃO incluir status antigos. Toda escrita deve usar exclusivamente esta lista.
 */
export const STATUS_SERVICO_QA = [
  "montando_pasta",
  "aguardando_documentacao",
  "documentos_em_analise",
  "documentos_incompletos",
  "documentos_aprovados",
  "em_verificacao",
  "pronto_para_protocolo",
  "enviado_ao_orgao",
  "em_analise_orgao",
  "notificado",
  "restituido",
  "recurso_administrativo",
  "deferido",
  "indeferido",
  "finalizado",
] as const;

export type StatusServicoQA = (typeof STATUS_SERVICO_QA)[number];

export const STATUS_LABELS: Record<StatusServicoQA, string> = {
  montando_pasta: "MONTANDO PASTA",
  aguardando_documentacao: "AGUARDANDO DOCUMENTAÇÃO",
  documentos_em_analise: "DOCUMENTOS EM ANÁLISE",
  documentos_incompletos: "DOCUMENTOS INCOMPLETOS",
  documentos_aprovados: "DOCUMENTOS APROVADOS",
  em_verificacao: "EM VERIFICAÇÃO",
  pronto_para_protocolo: "PRONTO PARA PROTOCOLO",
  enviado_ao_orgao: "ENVIADO AO ÓRGÃO",
  em_analise_orgao: "EM ANÁLISE NO ÓRGÃO",
  notificado: "NOTIFICADO",
  restituido: "RESTITUÍDO",
  recurso_administrativo: "RECURSO ADMINISTRATIVO",
  deferido: "DEFERIDO",
  indeferido: "INDEFERIDO",
  finalizado: "FINALIZADO",
};

export const STATUS_COLORS: Record<StatusServicoQA, string> = {
  montando_pasta: "bg-slate-100 text-slate-700 border-slate-300",
  aguardando_documentacao: "bg-amber-100 text-amber-800 border-amber-300",
  documentos_em_analise: "bg-blue-100 text-blue-800 border-blue-300",
  documentos_incompletos: "bg-orange-100 text-orange-800 border-orange-300",
  documentos_aprovados: "bg-emerald-100 text-emerald-800 border-emerald-300",
  em_verificacao: "bg-indigo-100 text-indigo-800 border-indigo-300",
  pronto_para_protocolo: "bg-violet-100 text-violet-800 border-violet-300",
  enviado_ao_orgao: "bg-cyan-100 text-cyan-800 border-cyan-300",
  em_analise_orgao: "bg-sky-100 text-sky-800 border-sky-300",
  notificado: "bg-yellow-100 text-yellow-800 border-yellow-300",
  restituido: "bg-purple-100 text-purple-800 border-purple-300",
  recurso_administrativo: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
  deferido: "bg-green-100 text-green-800 border-green-300",
  indeferido: "bg-red-100 text-red-800 border-red-300",
  finalizado: "bg-zinc-200 text-zinc-800 border-zinc-400",
};

/** Status que indicam que o órgão (PF) já tem o processo. */
export const STATUS_ORGAO: StatusServicoQA[] = [
  "enviado_ao_orgao",
  "em_analise_orgao",
  "notificado",
  "restituido",
  "recurso_administrativo",
  "deferido",
  "indeferido",
];

/** Status terminais (não há próxima ação operacional). */
export const STATUS_TERMINAIS: StatusServicoQA[] = [
  "deferido",
  "indeferido",
  "finalizado",
];

/**
 * Mapeia status legado (em UIs antigas e nomes em variáveis) para o novo padrão.
 * Apenas para LEITURA defensiva — nunca escrever status antigos no banco.
 */
export function normalizeLegacyStatus(s: string | null | undefined): StatusServicoQA | null {
  if (!s) return null;
  const v = String(s).toLowerCase().trim();
  if ((STATUS_SERVICO_QA as readonly string[]).includes(v)) return v as StatusServicoQA;
  switch (v) {
    case "aguardando_contratacao":
    case "contratado":
      return "montando_pasta";
    case "aguardando_documentos":
      return "aguardando_documentacao";
    case "em_andamento":
      return "em_verificacao";
    case "pronto":
      return "pronto_para_protocolo";
    case "enviado":
      return "enviado_ao_orgao";
    case "aguardando_orgao":
      return "em_analise_orgao";
    case "concluido":
    case "cancelado":
      return "finalizado";
    default:
      return null;
  }
}

export function statusLabel(s: string | null | undefined): string {
  const n = normalizeLegacyStatus(s);
  return n ? STATUS_LABELS[n] : (s ?? "—").toUpperCase();
}

export function statusBadgeClass(s: string | null | undefined): string {
  const n = normalizeLegacyStatus(s);
  return n ? STATUS_COLORS[n] : "bg-slate-100 text-slate-700 border-slate-300";
}