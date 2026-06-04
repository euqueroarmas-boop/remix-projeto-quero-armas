/**
 * Engine pura (sem I/O) das regras de ano de competência para os
 * comprovantes de endereço da Concessão de CR.
 *
 * Reflete a função SQL `qa_aproveitar_endereco_cadastro_publico`:
 *   - Vincula o comprovante ao slot `comprovante_endereco_ano_<YYYY>` apenas
 *     quando há `data_emissao` real e o ano está dentro da janela de 5 anos
 *     (ano atual + 4 anteriores) e o slot ainda está vazio.
 *   - Sem data: NÃO cria documento auxiliar e NÃO presume ano atual.
 *
 * O tipo "comprovante_endereco_revisao_ano" foi descontinuado.
 */

export type SlotEndereco = {
  id: string;
  tipo_documento: string;            // ex.: comprovante_endereco_ano_2025
  ano_competencia: number | null;
  arquivo_storage_key: string | null;
  status: "pendente" | "em_analise" | "aprovado" | "invalido" | string;
};

export type ResultadoAproveitamento =
  | { tipo: "vinculado_ao_ano"; ano: number; slotId: string }
  | { tipo: "nao_aproveitado"; motivo: "sem_data" | "fora_da_janela" | "slot_preenchido" };

export const ANO_ATUAL_DEFAULT = (): number => new Date().getFullYear();

export function janelaAnos(anoAtual: number = ANO_ATUAL_DEFAULT()): number[] {
  return [0, 1, 2, 3, 4].map((i) => anoAtual - i);
}

export function tipoSlotDoAno(ano: number): string {
  return `comprovante_endereco_ano_${ano}`;
}

/**
 * Decide o que fazer com um comprovante recebido (ex.: do cadastro público).
 * NÃO presume ano atual quando não há data extraída e NÃO cria item auxiliar.
 */
export function aproveitarComprovante(input: {
  dataEmissao: string | null;       // ISO YYYY-MM-DD ou null
  slots: SlotEndereco[];
  anoAtual?: number;
}): ResultadoAproveitamento {
  const anoAtual = input.anoAtual ?? ANO_ATUAL_DEFAULT();

  if (!input.dataEmissao) {
    return { tipo: "nao_aproveitado", motivo: "sem_data" };
  }
  const ano = Number(String(input.dataEmissao).slice(0, 4));
  const janela = janelaAnos(anoAtual);
  if (!Number.isFinite(ano) || !janela.includes(ano)) {
    return { tipo: "nao_aproveitado", motivo: "fora_da_janela" };
  }

  const tipoEsperado = tipoSlotDoAno(ano);
  const slot = input.slots.find(
    (s) => s.tipo_documento === tipoEsperado && s.arquivo_storage_key === null && s.status === "pendente",
  );
  if (!slot) {
    return { tipo: "nao_aproveitado", motivo: "slot_preenchido" };
  }
  return { tipo: "vinculado_ao_ano", ano, slotId: slot.id };
}
