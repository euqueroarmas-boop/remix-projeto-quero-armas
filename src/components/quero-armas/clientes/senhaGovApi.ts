import { supabase } from "@/integrations/supabase/client";

/**
 * Centraliza o acesso à Senha Gov.
 * Toda leitura/escrita passa pela edge function `qa-senha-gov`
 * (AES-256-GCM + auditoria em qa_senha_gov_acessos).
 *
 * IMPORTANTE: nunca leia `qa_cadastro_cr.senha_gov` direto do client —
 * o campo está deprecated e pode estar nulo. Use `getSenhaGov`.
 */
export async function getSenhaGov(
  cadastroCrId: number,
  contexto?: string,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("qa-senha-gov", {
    body: { action: "get", cadastro_cr_id: cadastroCrId, contexto },
  });
  if (error) throw new Error(error.message || "Falha ao consultar Senha Gov");
  if ((data as any)?.error) throw new Error((data as any).error);
  return ((data as any)?.senha as string | null) ?? null;
}

export async function setSenhaGov(
  cadastroCrId: number,
  senha: string,
  contexto?: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("qa-senha-gov", {
    body: { action: "set", cadastro_cr_id: cadastroCrId, senha, contexto },
  });
  if (error) throw new Error(error.message || "Falha ao salvar Senha Gov");
  if ((data as any)?.error) throw new Error((data as any).error);
}
