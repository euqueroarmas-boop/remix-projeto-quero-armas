// ============================================================================
// efetivaNecessidadePassos
// ----------------------------------------------------------------------------
// Fonte única de verdade dos passos da EFETIVA NECESSIDADE.
//
// Regra do usuário (09/08/2026): a efetiva necessidade NÃO é um item único do
// checklist com um wizard escondido dentro. Cada passo é um item da fila do
// pop-up guiado e conta no rodapé ("N de M concluídos"), exatamente como
// qualquer outra exigência.
//
// O estado de cada passo é derivado do registro em `qa_efetiva_necessidade`
// (+ provas anexadas) — nada de estado local de componente.
// ============================================================================

export type EfetivaPassoId =
  | "tem_bo"
  | "tem_inquerito"
  | "tem_acao_criminal"
  | "sofre_ameaca"
  | "relato"
  | "contexto"
  | "revisao"
  | "registrar_bo"
  | "enviar_bo"
  | "defesa_final";

export interface EfetivaPasso {
  id: EfetivaPassoId;
  label: string;
  concluido: boolean;
}

export const EFETIVA_PASSO_ROTULO: Record<EfetivaPassoId, string> = {
  tem_bo: "Boletim de ocorrência",
  tem_inquerito: "Inquérito policial",
  tem_acao_criminal: "Ação criminal",
  sofre_ameaca: "Ameaça atual",
  relato: "Seu relato",
  contexto: "Rotina de risco",
  revisao: "Revisão e geração do relato",
  registrar_bo: "Registrar o boletim na delegacia",
  enviar_bo: "Enviar o boletim registrado",
  defesa_final: "Defesa final e aprovação",
};

const PASSOS_BASE: EfetivaPassoId[] = [
  "tem_bo",
  "tem_inquerito",
  "tem_acao_criminal",
  "sofre_ameaca",
  "relato",
  "contexto",
  "revisao",
];

const PASSOS_BO: EfetivaPassoId[] = ["registrar_bo", "enviar_bo", "defesa_final"];

/** Mesmo mínimo aplicado no wizard quando não há nenhuma prova documental. */
export const EFETIVA_RELATO_MINIMO = 1000;

export interface EfetivaRegistroLike {
  tem_bo?: boolean | null;
  tem_inquerito?: boolean | null;
  tem_acao_criminal?: boolean | null;
  sofre_ameaca?: boolean | null;
  relato_cliente?: string | null;
  contexto_risco?: string | null;
  narrativa_gerada?: string | null;
  narrativa_final?: string | null;
  texto_bo?: string | null;
  bo_pendente_registro?: boolean | null;
  aprovado_cliente?: boolean | null;
}

export interface EfetivaProvaLike {
  tipo?: string | null;
}

/**
 * Lista viva de passos com o estado de cumprimento de cada um.
 * Os três passos de BO só existem quando a IA gerou o texto de BO.
 */
export function calcularPassosEfetiva(
  registro: EfetivaRegistroLike | null | undefined,
  provas: EfetivaProvaLike[] = [],
): EfetivaPasso[] {
  const reg = registro ?? {};
  const temTextoBo = String(reg.texto_bo ?? "").trim().length > 0;
  const ids = temTextoBo ? [...PASSOS_BASE, ...PASSOS_BO] : PASSOS_BASE;

  const relato = String(reg.relato_cliente ?? "").trim();
  const contexto = String(reg.contexto_risco ?? "").trim();
  const narrativa = String(reg.narrativa_final ?? reg.narrativa_gerada ?? "").trim();
  const provasBo = (provas ?? []).filter((p) => String(p?.tipo ?? "") === "boletim_ocorrencia");
  const semProvaNenhuma =
    reg.tem_bo === false &&
    reg.tem_inquerito === false &&
    reg.tem_acao_criminal === false &&
    (provas?.length ?? 0) === 0;
  const boEntregue = !reg.bo_pendente_registro && provasBo.length > 0;

  const concluido = (id: EfetivaPassoId): boolean => {
    switch (id) {
      case "tem_bo":
      case "tem_inquerito":
      case "tem_acao_criminal":
      case "sofre_ameaca":
        return typeof reg[id] === "boolean";
      case "relato":
        return !semProvaNenhuma || relato.length >= EFETIVA_RELATO_MINIMO;
      case "contexto":
        return contexto.length > 0;
      case "revisao":
        return narrativa.length > 0;
      case "registrar_bo":
        return boEntregue;
      case "enviar_bo":
        return boEntregue;
      case "defesa_final":
        return reg.aprovado_cliente === true;
      default:
        return false;
    }
  };

  return ids.map((id) => ({ id, label: EFETIVA_PASSO_ROTULO[id], concluido: concluido(id) }));
}

/** Códigos de documento que representam a efetiva necessidade no checklist. */
export function ehTipoEfetivaNecessidade(rawTipo: string | null | undefined): boolean {
  return ["declaracao_necessidade_efetiva", "comprovante_efetiva_necessidade"].includes(
    String(rawTipo ?? "").trim().toLowerCase(),
  );
}
