/**
 * FASE 2 — Fundação de identidade do cliente Quero Armas.
 *
 * Garante que o usuário logado tenha vínculo com `qa_clientes` e `cliente_auth_links`.
 * SEGURANÇA: o `user_id` é resolvido server-side via `auth.uid()` dentro da RPC.
 * Este helper NUNCA envia `user_id` para a RPC.
 *
 * Uso típico (portal do cliente):
 *   const { qa_cliente_id } = await ensureClienteFromAuthUser({
 *     email: user.email,
 *     cpf: cpfDoFormulario,
 *     nome: nomeDoFormulario,
 *     telefone: telDoFormulario,
 *   });
 *
 * Antes de qualquer INSERT de arma/documento pelo portal, chame este helper.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EnsureClienteInput {
  email?: string | null;
  cpf?: string | null;
  nome?: string | null;
  telefone?: string | null;
}

export interface EnsureClienteResult {
  qa_cliente_id: number | null;
  created: boolean;
  linked: boolean;
  needs_manual_review: boolean;
  reason: string | null;
  matched_by: string;
  match_count?: number;
}

export class EnsureClienteError extends Error {
  result?: EnsureClienteResult;
  constructor(message: string, result?: EnsureClienteResult) {
    super(message);
    this.name = "EnsureClienteError";
    this.result = result;
  }
}

export async function ensureClienteFromAuthUser(
  input: EnsureClienteInput = {},
): Promise<EnsureClienteResult> {
  const { data: sessionData } = await supabase.auth.getUser();
  if (!sessionData?.user) {
    throw new EnsureClienteError("Usuário não autenticado.");
  }

  const { data, error } = await supabase.rpc("qa_ensure_cliente_from_auth" as any, {
    p_email: (input.email ?? sessionData.user.email ?? null) || null,
    p_cpf: input.cpf ?? null,
    p_nome: input.nome ?? null,
    p_telefone: input.telefone ?? null,
  });

  if (error) {
    throw new EnsureClienteError(
      `Falha ao garantir vínculo do cliente: ${error.message}`,
    );
  }

  const result = (data ?? {}) as EnsureClienteResult;

  if (result.needs_manual_review) {
    // Não é erro fatal: caller decide o que fazer (ex.: mostrar tela de revisão).
    return result;
  }

  if (!result.qa_cliente_id) {
    throw new EnsureClienteError(
      "Não foi possível resolver o cliente para este usuário.",
      result,
    );
  }

  return result;
}
