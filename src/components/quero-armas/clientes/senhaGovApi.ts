import { supabase } from "@/integrations/supabase/client";

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
    throw new Error("Sessão expirada. Faça login novamente.");
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
    throw new Error((json as any)?.error || `HTTP ${res.status}`);
  }
  return json as any;
}

export async function getSenhaGov(
  cadastroCrId: number,
  contexto?: string,
): Promise<string | null> {
  const data = await callSenhaGov({ action: "get", cadastro_cr_id: cadastroCrId, contexto });
  return (data?.senha as string | null) ?? null;
}

export async function setSenhaGov(
  cadastroCrId: number,
  senha: string,
  contexto?: string,
): Promise<void> {
  await callSenhaGov({ action: "set", cadastro_cr_id: cadastroCrId, senha, contexto });
}
