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
  | "entender_bo"
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
  entender_bo: "Antes de ir à delegacia, entenda o boletim",
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

const PASSOS_BO: EfetivaPassoId[] = [
  "entender_bo",
  "registrar_bo",
  "enviar_bo",
  "defesa_final",
];

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
  data_fato?: string | null;
  created_at?: string | null;
}

/** Prazo legal de representação. Abaixo disso, o boletim sustenta sozinho. */
export const BO_PRAZO_MESES = 6;
const BO_PRAZO_MS = BO_PRAZO_MESES * 30.44 * 24 * 60 * 60 * 1000;

const MARCADORES_FATO_RECENTE =
  /\b(hoje|ontem|anteontem|esta semana|essa semana|semana passada|este m[êe]s|esse m[êe]s|m[êe]s passado|recentemente|nos [úu]ltimos dias|h[áa] poucos dias|agora h[áa] pouco|ainda ontem|nesta semana)\b/i;

function idadeMs(iso: string | null | undefined, agora: number): number | null {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? agora - t : null;
}

/** O relato traz fato recente? Data dentro do prazo ou marcador temporal. */
export function relatoTemFatoRecente(relato: string | null | undefined, agora = Date.now()): boolean {
  const texto = String(relato ?? "");
  if (!texto.trim()) return false;
  if (MARCADORES_FATO_RECENTE.test(texto)) return true;
  const datas = texto.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g) ?? [];
  return datas.some((d) => {
    const [dia, mes, ano] = d.split("/");
    const t = Date.parse(`${ano}-${mes}-${dia}T12:00:00Z`);
    return Number.isFinite(t) && agora - t <= BO_PRAZO_MS && t <= agora + 86400000;
  });
}

export interface SuficienciaBo {
  /** Precisa registrar um boletim novo na delegacia? */
  exigeNovoBo: boolean;
  /** Motivo em linguagem de cliente — vai para a tela. */
  motivo: string;
  totalBo: number;
  temBoRecente: boolean;
}

/**
 * Regra do usuário (09/08/2026): boletim antigo prova REITERAÇÃO. Só pedimos
 * registro novo quando não há nada recente — um único boletim antigo e nenhum
 * fato recente no relato do cliente.
 */
export function avaliarSuficienciaBo(
  provas: EfetivaProvaLike[] = [],
  relato: string | null | undefined,
  agora = Date.now(),
): SuficienciaBo {
  const bos = (provas ?? []).filter((p) => String(p?.tipo ?? "") === "boletim_ocorrencia");
  const totalBo = bos.length;
  const temBoRecente = bos.some((p) => {
    const idade = idadeMs(p.data_fato ?? p.created_at, agora);
    return idade !== null && idade <= BO_PRAZO_MS;
  });
  const fatoRecente = relatoTemFatoRecente(relato, agora);

  if (totalBo === 0) {
    return {
      exigeNovoBo: true,
      motivo:
        "Você ainda não enviou nenhum boletim de ocorrência. Registre o boletim na delegacia e volte aqui para anexá-lo.",
      totalBo,
      temBoRecente,
    };
  }
  if (temBoRecente) {
    return {
      exigeNovoBo: false,
      motivo:
        "Você já tem boletim registrado há menos de seis meses. Ele está dentro do prazo legal e sustenta a ameaça atual — não é preciso registrar outro.",
      totalBo,
      temBoRecente,
    };
  }
  if (totalBo > 1) {
    return {
      exigeNovoBo: false,
      motivo:
        "Você enviou mais de um boletim. O conjunto demonstra a reiteração das ameaças ao longo do tempo — não é preciso registrar outro agora.",
      totalBo,
      temBoRecente,
    };
  }
  if (fatoRecente) {
    return {
      exigeNovoBo: false,
      motivo:
        "O seu relato traz fato recente que tem correlação com o boletim que você enviou. O relato traz o fato atual e o boletim anterior comprova que já vinha de antes — não é preciso registrar outro.",
      totalBo,
      temBoRecente,
    };
  }
  return {
    exigeNovoBo: true,
    motivo:
      "Você tem apenas um boletim, com mais de seis meses, e o seu relato não traz fato recente. Nesse caso precisamos de um registro novo dizendo que o risco continua.",
    totalBo,
    temBoRecente,
  };
}

/**
 * Lista viva de passos com o estado de cumprimento de cada um.
 * A efetiva necessidade tem SEMPRE 10 passos: os 7 do questionário +
 * os 3 do boletim de ocorrência (registrar, enviar, defesa final).
 * Os passos de BO já nascem concluídos quando o cliente entregou o BO.
 */
export function calcularPassosEfetiva(
  registro: EfetivaRegistroLike | null | undefined,
  provas: EfetivaProvaLike[] = [],
  /** Ciência do BO já registrada (tabela `qa_cliente_ciencias`). */
  cienciaBoAceita = false,
): EfetivaPasso[] {
  const reg = registro ?? {};
  const ids = [...PASSOS_BASE, ...PASSOS_BO];

  const relato = String(reg.relato_cliente ?? "").trim();
  const contexto = String(reg.contexto_risco ?? "").trim();
  const narrativa = String(reg.narrativa_final ?? reg.narrativa_gerada ?? "").trim();
  const provasBo = (provas ?? []).filter((p) => String(p?.tipo ?? "") === "boletim_ocorrencia");
  const semProvaNenhuma =
    reg.tem_bo === false &&
    reg.tem_inquerito === false &&
    reg.tem_acao_criminal === false &&
    (provas?.length ?? 0) === 0;
  const suficiencia = avaliarSuficienciaBo(provas, reg.relato_cliente);
  // Boletim antigo continua valendo: se o conjunto já sustenta o pedido, os
  // passos de registro/envio não ficam travados esperando documento novo.
  const boEntregue =
    provasBo.length > 0 && (!suficiencia.exigeNovoBo || !reg.bo_pendente_registro);

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
      case "entender_bo":
        return cienciaBoAceita || boEntregue;
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
