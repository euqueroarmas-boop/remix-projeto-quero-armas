import { supabase } from "@/integrations/supabase/client";

/**
 * Entidades auditáveis no Quero Armas.
 * Mantenha sincronizado com os usos reais para facilitar filtros do painel de auditoria.
 */
export type AuditEntity =
  | "qa_clientes"
  | "qa_casos"
  | "qa_geracoes_pecas"
  | "qa_documentos_conhecimento"
  | "qa_armamentos"
  | "qa_vendas"
  | "qa_cadastro_publico"
  | "qa_acessos"
  | "qa_configuracoes"
  | (string & {});

export interface LogActionParams {
  entidade: AuditEntity;
  acao: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown>;
}

/**
 * Registra uma ação de auditoria. Best-effort: nunca lança — falha de log
 * jamais deve quebrar o fluxo da operação principal.
 *
 * Uso:
 *   await logAction({ entidade: "qa_casos", acao: "marcar_deferido", entidadeId, detalhes: {...} });
 */
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Sem usuário autenticado — RLS bloquearia o insert; pula silenciosamente.
      return;
    }
    const payload: Record<string, unknown> = {
      usuario_id: user.id,
      entidade: params.entidade,
      acao: params.acao,
      detalhes_json: params.detalhes ?? {},
    };
    if (params.entidadeId) payload.entidade_id = params.entidadeId;
    await supabase.from("qa_logs_auditoria" as any).insert(payload);
  } catch (err) {
    // Best-effort: log local, sem propagar.
    // eslint-disable-next-line no-console
    console.warn("[logAction] falhou (não crítico):", err);
  }
}