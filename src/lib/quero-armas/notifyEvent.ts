import { supabase } from "@/integrations/supabase/client";

export type QAEvento =
  | "montando_pasta"
  | "documento_recebido"
  | "todos_documentos_recebidos"
  | "em_verificacao"
  | "pronto_para_protocolo"
  | "enviado_ao_orgao"
  | "status_orgao";

export interface NotifyEventInput {
  evento: QAEvento;
  solicitacao_id?: string | null;
  cliente_id?: number | null;
  documentos_recebidos?: number;
  documentos_total?: number;
  documento_nome?: string;
  status_orgao?: string;
  status_novo?: string | null;
  observacao?: string;
}

/**
 * Wrapper fire-and-forget para o pipeline de eventos operacionais Quero Armas.
 * Nunca bloqueia o fluxo do operador/cliente — falhas vão para console.
 */
export async function notifyQAEvent(input: NotifyEventInput): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("qa-notify-event", {
      body: input,
    });
    if (error) {
      console.warn("[qa-notify-event] falha:", error.message);
    }
  } catch (e) {
    console.warn("[qa-notify-event] exceção:", e);
  }
}

/** Mapa de status → evento de notificação. */
export const STATUS_TO_EVENT: Partial<Record<string, QAEvento>> = {
  em_verificacao: "em_verificacao",
  pronto_para_protocolo: "pronto_para_protocolo",
  enviado_ao_orgao: "enviado_ao_orgao",
  em_analise_orgao: "status_orgao",
  notificado: "status_orgao",
  restituido: "status_orgao",
  recurso_administrativo: "status_orgao",
  deferido: "status_orgao",
  indeferido: "status_orgao",
};