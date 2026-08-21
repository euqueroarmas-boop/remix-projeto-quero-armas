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
//
// A PROFISSÃO DO TITULAR É A DO TERCEIRO (regra do titular, 20/08/2026).
// A pergunta `titular_profissao` só existe quando o comprovante de residência
// está em nome de OUTRA pessoa — então a resposta é a profissão DESSA pessoa,
// que mora no bloco do responsável (`responsavel_endereco_profissao`). A
// profissão do próprio cliente já vive em `cliente.profissao` e continua
// conhecida — ela só não pode responder por outra pessoa, que era o defeito:
// o preenchimento antigo usava a profissão do cliente e a declaração do
// responsável saía com o dado do requerente.
//
// Prioridade da resposta, da mais explícita para a derivada:
//   1. o que foi respondido no processo (`titular_profissao`);
//   2. a resposta da pergunta do portal (`titular_comprovante_profissao`);
//   3. o bloco do responsável no cadastro (`responsavel_endereco_profissao`).
// ============================================================================

export interface ClienteCadastroLike {
  categoria_titular?: string | null;
  profissao?: string | null;
  /** Profissão do RESPONSÁVEL pelo imóvel — o terceiro do comprovante. */
  responsavel_endereco_profissao?: string | null;
}

export function respostasDoCadastro(
  cliente: ClienteCadastroLike | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cliente) return out;
  const cat = String(cliente.categoria_titular ?? "").trim().toLowerCase();
  if (cat) out.categoria_titular = cat;
  const profTerceiro = String(cliente.responsavel_endereco_profissao ?? "").trim();
  if (profTerceiro) out.titular_profissao = profTerceiro;
  return out;
}

export function mesclarRespostasCadastro<T extends Record<string, any>>(
  respostas: T,
  cliente: ClienteCadastroLike | null | undefined,
): T & Record<string, string> {
  const out: Record<string, any> = { ...(respostas ?? {}) };
  // A pergunta do portal ("Profissão do titular", com seletor) grava em
  // `titular_comprovante_profissao`. É a MESMA informação da pergunta do
  // checklist — a ponte abaixo evita cobrar duas vezes a mesma resposta.
  const vazio = (v: unknown) => v === undefined || v === null || v === "";
  if (vazio(out.titular_profissao) && !vazio(out.titular_comprovante_profissao)) {
    out.titular_profissao = out.titular_comprovante_profissao;
  }
  const derivadas = respostasDoCadastro(cliente);
  for (const [k, v] of Object.entries(derivadas)) {
    if (vazio(out[k])) out[k] = v;
  }
  return out as T & Record<string, string>;
}
