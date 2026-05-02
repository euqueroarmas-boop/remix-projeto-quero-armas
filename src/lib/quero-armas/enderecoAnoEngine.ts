/**
 * Slice 2.2 — Engine pura (sem I/O) das regras de ano de competência
 * para os comprovantes de endereço da Concessão de CR.
 *
 * Reflete fielmente as funções SQL:
 *   - qa_aproveitar_endereco_cadastro_publico
 *   - qa_mover_endereco_revisao_para_ano
 *   - qa_trg_revisao_endereco_auto_promover
 *
 * Permite testes determinísticos sem depender do banco.
 */

export type SlotEndereco = {
  id: string;
  tipo_documento: string;            // ex.: comprovante_endereco_ano_2025
  ano_competencia: number | null;
  arquivo_storage_key: string | null;
  status: "pendente" | "em_analise" | "aprovado" | "invalido" | "revisao_humana" | string;
};

export type ResultadoAproveitamento =
  | { tipo: "vinculado_ao_ano"; ano: number; slotId: string }
  | { tipo: "revisao_manual"; motivo: "sem_data" | "fora_da_janela" | "slot_preenchido" };

export const ANO_ATUAL_DEFAULT = (): number => new Date().getFullYear();

export function janelaAnos(anoAtual: number = ANO_ATUAL_DEFAULT()): number[] {
  return [0, 1, 2, 3, 4].map((i) => anoAtual - i);
}

export function tipoSlotDoAno(ano: number): string {
  return `comprovante_endereco_ano_${ano}`;
}

/**
 * Decide o que fazer com um comprovante recebido (ex.: do cadastro público).
 * NÃO presume ano atual quando não há data extraída.
 */
export function aproveitarComprovante(input: {
  dataEmissao: string | null;       // ISO YYYY-MM-DD ou null
  slots: SlotEndereco[];
  anoAtual?: number;
}): ResultadoAproveitamento {
  const anoAtual = input.anoAtual ?? ANO_ATUAL_DEFAULT();

  if (!input.dataEmissao) {
    return { tipo: "revisao_manual", motivo: "sem_data" };
  }
  const ano = Number(String(input.dataEmissao).slice(0, 4));
  const janela = janelaAnos(anoAtual);
  if (!Number.isFinite(ano) || !janela.includes(ano)) {
    return { tipo: "revisao_manual", motivo: "fora_da_janela" };
  }

  const tipoEsperado = tipoSlotDoAno(ano);
  const slot = input.slots.find(
    (s) => s.tipo_documento === tipoEsperado && s.arquivo_storage_key === null && s.status === "pendente",
  );
  if (!slot) {
    return { tipo: "revisao_manual", motivo: "slot_preenchido" };
  }
  return { tipo: "vinculado_ao_ano", ano, slotId: slot.id };
}

/**
 * Valida se o ano informado pela Equipe pode ser usado para promover um item
 * de revisão para o slot correspondente.
 */
export function validarAnoManual(input: {
  ano: number;
  slots: SlotEndereco[];
  anoAtual?: number;
}): { ok: true; slotId: string } | { ok: false; erro: string } {
  const anoAtual = input.anoAtual ?? ANO_ATUAL_DEFAULT();
  const janela = janelaAnos(anoAtual);
  if (!janela.includes(input.ano)) {
    return { ok: false, erro: `Ano ${input.ano} fora da janela permitida` };
  }
  const slot = input.slots.find(
    (s) =>
      s.tipo_documento === tipoSlotDoAno(input.ano) &&
      s.arquivo_storage_key === null &&
      s.status === "pendente",
  );
  if (!slot) {
    return { ok: false, erro: `Slot do ano ${input.ano} já está preenchido` };
  }
  return { ok: true, slotId: slot.id };
}
