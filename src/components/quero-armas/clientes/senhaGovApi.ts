import { supabase } from "@/integrations/supabase/client";

class SenhaGovAuthError extends Error {
  constructor(message = "Sessão expirada. Faça login novamente.") {
    super(message);
    this.name = "SenhaGovAuthError";
  }
}

/**
 * Lançado quando o usuário autenticado NÃO é membro da Equipe Quero Armas
 * (ex.: cliente logado no portal `/area-do-cliente`). Não é um erro real —
 * o caller deve apenas ignorar silenciosamente (a Senha Gov só é visível
 * para a Equipe Quero Armas).
 */
class SenhaGovForbiddenError extends Error {
  constructor(message = "Senha Gov disponível apenas para a Equipe Quero Armas.") {
    super(message);
    this.name = "SenhaGovForbiddenError";
  }
}

/**
 * Event bus simples para sincronizar instâncias de `SenhaGovField` quando
 * a senha é gravada em outro lugar (ex.: ClienteFormModal salva e o campo
 * `exposed` na aba "Dados" precisa recarregar o valor mais recente).
 */
type SenhaGovListener = (cadastroCrId: number) => void;
const listeners = new Set<SenhaGovListener>();
export function subscribeSenhaGovUpdates(fn: SenhaGovListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitSenhaGovUpdated(cadastroCrId: number) {
  for (const fn of listeners) {
    try { fn(cadastroCrId); } catch { /* ignore */ }
  }
}

/**
 * Centraliza o acesso à Senha Gov.
 * Toda leitura/escrita passa pela edge function `qa-senha-gov`
 * (AES-256-GCM + auditoria em qa_senha_gov_acessos).
 *
 * IMPORTANTE: nunca leia `qa_cadastro_cr.senha_gov` direto do client —
 * o campo está deprecated e pode estar nulo. Use `getSenhaGov`.
 */
async function callSenhaGov(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new SenhaGovAuthError();
  }

  // getSession() pode retornar um token persistido que já foi revogado no servidor.
  // Valida antes de chamar a Edge Function para evitar 401 global/blank screen.
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user?.id) {
    await supabase.auth.signOut().catch(() => undefined);
    throw new SenhaGovAuthError();
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-senha-gov`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json as any)?.error) {
    if (res.status === 401) {
      await supabase.auth.signOut().catch(() => undefined);
      throw new SenhaGovAuthError();
    }
    if (res.status === 403) {
      // Cliente logado no portal não é membro da Equipe Quero Armas — silencia.
      throw new SenhaGovForbiddenError();
    }
    throw new Error((json as any)?.detail || (json as any)?.error || `HTTP ${res.status}`);
  }
  return json as any;
}

export async function getSenhaGov(
  cadastroCrId: number | null,
  contexto?: string,
  clienteId?: number | null,
): Promise<string | null> {
  try {
    const data = await callSenhaGov({
      action: "get",
      cadastro_cr_id: cadastroCrId ?? null,
      cliente_id: clienteId ?? null,
      contexto,
    });
    return (data?.senha as string | null) ?? null;
  } catch (e: any) {
    // Cliente do portal: não tem permissão para ler Senha Gov — retorna null.
    if (e?.name === "SenhaGovForbiddenError") return null;
    throw e;
  }
}

export async function setSenhaGov(
  cadastroCrId: number | null,
  senha: string,
  contexto?: string,
  clienteId?: number | null,
): Promise<void> {
  await callSenhaGov({
    action: "set",
    cadastro_cr_id: cadastroCrId ?? null,
    cliente_id: clienteId ?? null,
    senha,
    contexto,
  });
  if (cadastroCrId) emitSenhaGovUpdated(cadastroCrId);
}
