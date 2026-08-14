// ============================================================================
// embedding.ts — geracao de embedding LOCAL, dentro da propria edge function
// ----------------------------------------------------------------------------
// Historico (14/08/2026): tres funcoes chamavam
//   https://ai.gateway.lovable.dev/v1/embeddings
// que NAO EXISTE — o proprio qa-kb-embed ja documentava isso no cabecalho. As
// chamadas falhavam 100% das vezes e o codigo devolvia `null` em silencio, entao
// o modelo era gravado sem embedding e a tela dizia "MODELO TREINADO". Resultado
// medido no banco: 20 modelos aprovados, 0 com embedding.
//
// O contorno que existia em qa-kb-embed e PIOR e nao deve ser copiado: pede a um
// modelo de CONVERSA um "array de 1536 floats". LLM de chat nao produz embedding;
// os numeros sao inventados. Pior, aquele codigo aceita 100 numeros e completa o
// resto com ZEROS ate fechar 1536 — o vetor passa na validacao de formato e nao
// significa nada.
//
// Aqui usamos o modelo embutido no runtime do Supabase (gte-small, 384 dim). Nao
// faz chamada externa, nao usa chave, nao tem fatura.
//
// ─── Regra inegociavel deste modulo ────────────────────────────────────────
// NUNCA devolver vetor "quase certo". Sem completar com zero, sem aceitar
// dimensao diferente, sem engolir excecao. Ou vem vetor valido, ou vem o MOTIVO
// da falha — e quem chama decide o que fazer com ele, visivelmente.
// ============================================================================

export const EMBEDDING_MODELO = "gte-small";
export const EMBEDDING_DIMENSOES = 384;

export type EmbeddingResultado =
  | { ok: true; vetor: number[] }
  | { ok: false; motivo: string };

// gte-small trabalha com ~512 tokens. Mandar mais nao melhora: o excedente e
// truncado do lado do modelo. 2000 caracteres ficam com folga dentro disso.
const MAX_CARACTERES = 2000;

let sessao: unknown = null;

export async function gerarEmbedding(texto: string): Promise<EmbeddingResultado> {
  const limpo = String(texto ?? "").trim();
  if (limpo.length < 20) {
    return { ok: false, motivo: "texto_curto_demais" };
  }

  // `Supabase` e um global do Edge Runtime; o TypeScript nao o conhece.
  const runtime = (globalThis as { Supabase?: { ai?: { Session?: new (m: string) => unknown } } }).Supabase;
  if (!runtime?.ai?.Session) {
    // Ambiente sem IA embutida. Falha EXPLICITA — quem chama avisa a tela.
    return { ok: false, motivo: "runtime_sem_supabase_ai" };
  }

  try {
    sessao ??= new runtime.ai.Session(EMBEDDING_MODELO);
    const saida = await (sessao as { run: (t: string, o: unknown) => Promise<unknown> })
      .run(limpo.slice(0, MAX_CARACTERES), { mean_pool: true, normalize: true });

    if (!Array.isArray(saida)) {
      return { ok: false, motivo: `retorno_nao_e_lista:${typeof saida}` };
    }
    if (saida.length !== EMBEDDING_DIMENSOES) {
      // Dimensao errada e erro, nao coisa a "consertar" com zeros.
      return { ok: false, motivo: `dimensao_inesperada:${saida.length}` };
    }

    const vetor = saida.map((n) => Number(n));
    if (vetor.some((n) => !Number.isFinite(n))) {
      return { ok: false, motivo: "valor_nao_numerico" };
    }
    return { ok: true, vetor };
  } catch (e) {
    return { ok: false, motivo: `excecao:${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Texto curto e legivel para log e para a tela. */
export function explicarFalhaEmbedding(motivo: string): string {
  if (motivo === "runtime_sem_supabase_ai") {
    return "IA embutida indisponivel neste ambiente do Supabase.";
  }
  if (motivo === "texto_curto_demais") {
    return "Texto extraido do documento e curto demais para gerar a referencia.";
  }
  if (motivo.startsWith("dimensao_inesperada")) {
    return `O modelo devolveu vetor de tamanho inesperado (${motivo.split(":")[1]}).`;
  }
  return `Falha ao gerar a referencia de IA (${motivo}).`;
}
