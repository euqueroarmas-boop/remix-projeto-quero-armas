// ============================================================================
// respostasCadastro (shared)
// ----------------------------------------------------------------------------
// CAUSA RAIZ: o checklist só enxergava as respostas digitadas no processo
// (`respostas_questionario_json`) e ignorava o que já está gravado no cadastro
// do cliente. Resultado: perguntas já respondidas no cadastro ficavam pendentes
// e regras condicionadas à categoria do titular nunca disparavam.
//
// Aqui o cadastro vira fonte derivada de respostas. Nunca sobrescreve o que o
// cliente respondeu no processo — só preenche o que está vazio.
// ============================================================================

export interface ClienteCadastroLike {
  categoria_titular?: string | null;
  profissao?: string | null;
}

export function respostasDoCadastro(
  cliente: ClienteCadastroLike | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cliente) return out;
  const cat = String(cliente.categoria_titular ?? "").trim().toLowerCase();
  if (cat) out.categoria_titular = cat;
  const prof = String(cliente.profissao ?? "").trim();
  if (prof) out.titular_profissao = prof;
  return out;
}

export function mesclarRespostasCadastro<T extends Record<string, any>>(
  respostas: T,
  cliente: ClienteCadastroLike | null | undefined,
): T & Record<string, string> {
  const derivadas = respostasDoCadastro(cliente);
  const out: Record<string, any> = { ...(respostas ?? {}) };
  for (const [k, v] of Object.entries(derivadas)) {
    const atual = out[k];
    if (atual === undefined || atual === null || atual === "") out[k] = v;
  }
  return out as T & Record<string, string>;
}
