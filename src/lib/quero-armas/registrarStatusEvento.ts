import { supabase } from "@/integrations/supabase/client";

export type StatusEventoOrigem =
  | "sistema"
  | "ia"
  | "equipe"
  | "cliente"
  | "webhook"
  | "cron"
  | "importacao";

export interface RegistrarStatusEventoInput {
  cliente_id?: number | null;
  processo_id?: string | null;
  solicitacao_id?: string | null;
  documento_id?: string | null;
  origem: StatusEventoOrigem;
  entidade: string;
  entidade_id: string | number;
  campo_status: string;
  status_anterior?: string | null;
  status_novo?: string | null;
  usuario_id?: string | null;
  motivo?: string | null;
  detalhes?: Record<string, unknown> | null;
}

/**
 * Registra um evento de mudança de status na tabela de auditoria
 * `qa_status_eventos`.
 *
 * Regras:
 * - Não registra se status_anterior === status_novo.
 * - Não registra se entidade ou entidade_id estiverem ausentes.
 * - NUNCA bloqueia o fluxo principal: erros são apenas logados.
 *
 * NOTA: a tabela só permite SELECT para a Equipe. Inserts via cliente
 * autenticado serão bloqueados pela RLS — esta função é um best-effort
 * para contextos com service_role / rotinas internas.
 */
export async function registrarStatusEvento(
  input: RegistrarStatusEventoInput
): Promise<{ ok: boolean; skipped?: string; error?: unknown }> {
  try {
    if (!input.entidade || input.entidade_id === undefined || input.entidade_id === null || input.entidade_id === "") {
      return { ok: false, skipped: "entidade_ou_id_ausente" };
    }
    const anterior = input.status_anterior ?? null;
    const novo = input.status_novo ?? null;
    if (anterior === novo) {
      return { ok: false, skipped: "status_inalterado" };
    }

    const payload = {
      cliente_id: input.cliente_id ?? null,
      processo_id: input.processo_id ?? null,
      solicitacao_id: input.solicitacao_id ?? null,
      documento_id: input.documento_id ?? null,
      origem: input.origem,
      entidade: input.entidade,
      entidade_id: String(input.entidade_id),
      campo_status: input.campo_status,
      status_anterior: anterior,
      status_novo: novo,
      usuario_id: input.usuario_id ?? null,
      motivo: input.motivo ?? null,
      detalhes: (input.detalhes ?? null) as never,
    };

    const { error } = await supabase
      .from("qa_status_eventos")
      .insert(payload as never);

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[registrarStatusEvento] insert falhou (não bloqueante):", error.message);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[registrarStatusEvento] exceção (não bloqueante):", err);
    return { ok: false, error: err };
  }
}