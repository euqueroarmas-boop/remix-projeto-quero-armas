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
import {
  aguardandoOutroBo,
  tesesConfirmadas,
  type EfetivaTeseLike,
  type RegistroLacoBo,
} from "./efetivaTeses";

export type { EfetivaTeseLike };

export type EfetivaPassoId =
  | "tem_bo"
  | "tem_inquerito"
  | "tem_acao_criminal"
  | "sofre_ameaca"
  | "relato"
  | "contexto"
  | "revisao"
  | "teses"
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
  teses: "Suas frentes de risco",
  entender_bo: "Antes de ir à delegacia, entenda o boletim",
  registrar_bo: "Registrar o boletim na delegacia",
  enviar_bo: "Enviar o boletim registrado",
  defesa_final: "Defesa final e aprovação",
};

export const PASSOS_BASE: EfetivaPassoId[] = [
  "tem_bo",
  "tem_inquerito",
  "tem_acao_criminal",
  "sofre_ameaca",
  "relato",
  "contexto",
  "revisao",
  // Regra do usuário (17/08/2026): antes de mandar alguém à delegacia, ele lê
  // as frentes de risco que separamos do relato dele e confirma cada título.
  "teses",
];

export const PASSOS_BO: EfetivaPassoId[] = [
  "entender_bo",
  "registrar_bo",
  "enviar_bo",
  "defesa_final",
];

/**
 * A ORDEM CANÔNICA dos passos — 12, sempre, para todo mundo.
 *
 * Furo real (15/08/2026, cliente Mizael): existiam DUAS listas de passos. O
 * checklist usava esta (11 itens) e o wizard montava a dele a partir do
 * `texto_bo` (7 itens quando o texto estava vazio). Aí o item "Registrar o
 * boletim" da fila renderizava a tela de Revisão, o botão virava "Concordo e
 * aprovo" e o cliente ficava preso num círculo: aprovava, nada mudava, o
 * checklist reabria a exigência pelos passos pendentes e tudo recomeçava.
 *
 * Lista única, aqui. Quem renderiza consome DAQUI — nunca monta a sua.
 */
export const EFETIVA_PASSOS_IDS: EfetivaPassoId[] = [...PASSOS_BASE, ...PASSOS_BO];

/** Mesmo mínimo aplicado no wizard quando não há nenhuma prova documental. */
export const EFETIVA_RELATO_MINIMO = 1000;

export interface EfetivaRegistroLike extends RegistroLacoBo {
  tem_bo?: boolean | null;
  tem_inquerito?: boolean | null;
  tem_acao_criminal?: boolean | null;
  sofre_ameaca?: boolean | null;
  relato_cliente?: string | null;
  contexto_risco?: string | null;
  narrativa_gerada?: string | null;
  narrativa_final?: string | null;
  narrativa_gerada_em?: string | null;
  texto_bo?: string | null;
  bo_pendente_registro?: boolean | null;
  /** Carimbo do "Já registrei o boletim" — o clique agora fica no banco. */
  bo_registro_confirmado_em?: string | null;
  /** Quando o texto do BO mudou pela última vez (só muda quando o texto muda). */
  texto_bo_gerado_em?: string | null;
  aprovado_cliente?: boolean | null;
  aprovado_cliente_em?: string | null;
  /** `rascunho` | `em_revisao` | `aprovado` | `devolvido` (qa_efetiva_necessidade.status). */
  status?: string | null;
  devolucao_motivo?: string | null;
}

export interface EfetivaAcrescimoLike {
  created_at?: string | null;
}

/**
 * O relato foi refeito DEPOIS da aprovação do cliente?
 *
 * O aceite (`aprovado_cliente`) é prova de sessão e nunca é apagado — mas ele
 * cobre o texto que estava na tela naquele instante. Refez o texto, o aceite
 * anterior não vale para o texto novo: a defesa final volta a ser pendência.
 */
export function narrativaRefeitaAposAprovacao(
  registro: EfetivaRegistroLike | null | undefined,
): boolean {
  const aprovadoEm = Date.parse(String(registro?.aprovado_cliente_em ?? ""));
  const geradaEm = Date.parse(String(registro?.narrativa_gerada_em ?? ""));
  if (!Number.isFinite(aprovadoEm) || !Number.isFinite(geradaEm)) return false;
  return geradaEm > aprovadoEm;
}

/**
 * O texto do BO mudou DEPOIS de o cliente dizer que já registrou o boletim?
 *
 * Regra do usuário (16/08/2026): o carimbo `bo_registro_confirmado_em` NUNCA é
 * apagado — ele é a prova de que o cliente declarou o registro naquela data.
 * O que reabre o passo é o confronto de datas: se o texto que vai para a
 * delegacia mudou depois da declaração dele, o boletim registrado não cobre
 * mais o texto atual e ele precisa aditar. A mudança partiu do cliente, e o
 * rastro na auditoria mostra isso — a culpa não é nossa.
 *
 * `texto_bo_gerado_em` só avança quando o texto REALMENTE muda (a edge function
 * qa-efetiva-narrativa preserva o carimbo antigo quando a rodada não trouxe
 * texto novo), então regerar sem mudar nada não reabre o passo à toa.
 */
export function textoBoRefeitoAposRegistro(
  registro: EfetivaRegistroLike | null | undefined,
): boolean {
  const registradoEm = Date.parse(String(registro?.bo_registro_confirmado_em ?? ""));
  const textoEm = Date.parse(String(registro?.texto_bo_gerado_em ?? ""));
  if (!Number.isFinite(registradoEm) || !Number.isFinite(textoEm)) return false;
  return textoEm > registradoEm;
}

/**
 * Há fato acrescentado pelo cliente que ainda NÃO entrou no texto?
 *
 * É o gatilho da pergunta "quer refazer o seu texto de defesa incluindo este
 * fato novo?". Regra do usuário (15/08/2026): o texto da IA só é refeito com
 * autorização explícita dele — nunca sozinho, e nunca por cima do texto que o
 * próprio cliente digitou.
 */
export function temFatoNovoForaDoTexto(
  registro: EfetivaRegistroLike | null | undefined,
  acrescimos: EfetivaAcrescimoLike[] = [],
): boolean {
  const geradaEm = Date.parse(String(registro?.narrativa_gerada_em ?? ""));
  if (!Number.isFinite(geradaEm)) return (acrescimos?.length ?? 0) > 0;
  return (acrescimos ?? []).some((a) => {
    const t = Date.parse(String(a?.created_at ?? ""));
    return Number.isFinite(t) && t > geradaEm;
  });
}

/**
 * A equipe devolveu o relato para ajustes?
 *
 * O aceite eletrônico do cliente (`aprovado_cliente`) é prova de sessão —
 * carimbo, IP e hash do texto — e NUNCA é apagado. Quem diz se o passo voltou
 * a ser exigível é o `status` do registro: devolvido pela equipe reabre a
 * defesa final para o cliente ajustar o texto e aprovar de novo.
 */
export function efetivaFoiDevolvida(
  registro: EfetivaRegistroLike | null | undefined,
): boolean {
  return String(registro?.status ?? "").trim().toLowerCase() === "devolvido";
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
 * A efetiva necessidade tem SEMPRE 12 passos: os 7 do questionário, a
 * confirmação das teses e os 4 do boletim de ocorrência (entender, registrar,
 * enviar, defesa final). Os passos de BO já nascem concluídos quando o cliente
 * entregou o BO.
 */
export function calcularPassosEfetiva(
  registro: EfetivaRegistroLike | null | undefined,
  provas: EfetivaProvaLike[] = [],
  /** Ciência do BO já registrada (tabela `qa_cliente_ciencias`). */
  cienciaBoAceita = false,
  /** Teses de defesa separadas do relato (tabela `qa_efetiva_teses`). */
  teses: EfetivaTeseLike[] = [],
): EfetivaPasso[] {
  const reg = registro ?? {};
  const ids = EFETIVA_PASSOS_IDS;

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
  // Devolvido pela equipe: a defesa final volta a ser pendência, mesmo com o
  // aceite anterior do cliente gravado. É isso que faz o checklist retroceder
  // para o grupo "Efetiva necessidade" em vez de seguir para os laudos.
  const devolvida = efetivaFoiDevolvida(reg);
  const listaTeses = teses ?? [];
  // Disse que vai abrir outro boletim: o passo do envio TRAVA aqui até o
  // documento chegar. Sair sem ele só por chamado com a equipe (destrava
  // gravada em `bo_destravado_em`). Regra do usuário (17/08/2026).
  const esperandoOutroBo = aguardandoOutroBo(reg);

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
      case "teses":
        // Sem tese nenhuma (registro antigo, ou IA que não separou nada) o
        // passo não pode virar pendência eterna: quem responde por ele é a
        // existência do relato, como era antes de 17/08/2026.
        if (listaTeses.length === 0) return narrativa.length > 0;
        return tesesConfirmadas(listaTeses).length === listaTeses.length;
      case "entender_bo":
        return cienciaBoAceita || boEntregue;
      case "registrar_bo":
        // O "Já registrei o boletim" agora é persistido — antes era estado
        // local do componente e o checklist nunca ficava sabendo.
        //
        // O documento anexado encerra o passo de vez. Já a DECLARAÇÃO do
        // cliente vale enquanto o texto que ele levou à delegacia continuar
        // sendo o texto atual: acrescentou fato novo e mandou refazer, o
        // boletim registrado ficou defasado e o passo reabre para ele aditar.
        if (boEntregue) return true;
        return (
          !!String(reg.bo_registro_confirmado_em ?? "").trim() &&
          !textoBoRefeitoAposRegistro(reg)
        );
      case "enviar_bo":
        // O laço dos boletins: enquanto ele disser que vai abrir mais um, o
        // passo continua em aberto — mesmo com boletim já anexado.
        return boEntregue && !esperandoOutroBo;
      case "defesa_final":
        return (
          !devolvida &&
          reg.aprovado_cliente === true &&
          !narrativaRefeitaAposAprovacao(reg)
        );
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
