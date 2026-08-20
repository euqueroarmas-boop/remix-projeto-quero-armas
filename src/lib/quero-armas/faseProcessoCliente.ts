/* =============================================================================
 * EM QUE PASSO O CLIENTE ESTÁ
 * -----------------------------------------------------------------------------
 * O portal sabia dizer o que FALTA, mas nunca dizia ONDE O PROCESSO ESTÁ. São
 * coisas diferentes, e a diferença aparece justamente no momento mais delicado:
 * quando o cliente termina de entregar tudo.
 *
 * A partir dali a lista de pendências dele fica vazia, a granada para de piscar
 * e a tela inicial volta a falar de vencimento de certidão — como se não
 * houvesse processo nenhum em andamento. O cliente entrega o último documento,
 * abre o portal no dia seguinte e não encontra sinal de vida: não sabe se
 * chegou, se alguém está olhando, se falta algo dele. E manda mensagem
 * perguntando — que é o custo real disso.
 *
 * Este módulo responde uma pergunta só, com o dado que já existe: de quem é a
 * bola agora, e qual é o passo atual.
 * ============================================================================= */

import { ehExigenciaEtapaFinal, exigenciaCobravelAgora } from "./etapaFinalProtocolo";

export type FaseProcessoId =
  | "documentos"
  | "defesa"
  | "protocolo"
  | "na_pf"
  | "deferido";

export type ResponsavelFase = "cliente" | "equipe" | "policia_federal";

export interface FaseProcesso {
  id: FaseProcessoId;
  /** Número do passo (1 a 5), para a régua na tela. */
  passo: number;
  titulo: string;
  /** Uma frase, em linguagem de cliente, dizendo o que está acontecendo. */
  descricao: string;
  responsavel: ResponsavelFase;
}

export const FASES: readonly { id: FaseProcessoId; passo: number; titulo: string; responsavel: ResponsavelFase }[] = [
  { id: "documentos", passo: 1, titulo: "Você reúne os documentos", responsavel: "cliente" },
  { id: "defesa", passo: 2, titulo: "Montamos a sua defesa", responsavel: "equipe" },
  { id: "protocolo", passo: 3, titulo: "Taxa, assinatura e protocolo", responsavel: "cliente" },
  { id: "na_pf", passo: 4, titulo: "Na Polícia Federal", responsavel: "policia_federal" },
  { id: "deferido", passo: 5, titulo: "Deferido", responsavel: "policia_federal" },
] as const;

export interface ProcessoParaFase {
  id?: string | null;
  status?: string | null;
  protocolo_numero?: string | null;
  protocolo_data?: string | null;
  deferimento_data?: string | null;
  deferimento_documento_id?: string | null;
}

export interface DocParaFase {
  processo_id?: string | null;
  obrigatorio?: boolean | null;
  status?: string | null;
  tipo_documento?: string | null;
  regra_validacao?: { etapa_final?: boolean | null } | null;
}

/** Status em que a exigência ainda espera ação — espelha o checklist do portal. */
const STATUS_EM_ABERTO = new Set([
  "pendente",
  "pendente_reenvio",
  "invalido",
  "reprovado",
  "divergente",
  "rejeitado",
  "aguardando_envio",
  "em_correcao",
]);

function emAberto(d: DocParaFase): boolean {
  return d?.obrigatorio === true && STATUS_EM_ABERTO.has(String(d?.status ?? "").trim().toLowerCase());
}

/**
 * Fase atual do processo, a partir do que já está gravado.
 *
 * A ordem das checagens é a ordem da vida do processo, do fim para o começo:
 * deferido vence tudo, depois protocolado, depois liberado para protocolar. Só
 * então olhamos o checklist — e aí a pergunta é uma só: sobrou alguma coisa que
 * o CLIENTE possa fazer? Se sobrou, ele ainda está juntando documento. Se não
 * sobrou e ainda há exigência aberta, a bola está com a equipe.
 */
export function faseDoProcesso(
  processo: ProcessoParaFase | null | undefined,
  docsDoProcesso: readonly DocParaFase[],
): FaseProcesso {
  const status = String(processo?.status ?? "").trim().toLowerCase();
  const abertos = (docsDoProcesso ?? []).filter(emAberto);

  const montar = (id: FaseProcessoId, descricao: string): FaseProcesso => {
    const base = FASES.find((f) => f.id === id)!;
    return { ...base, descricao };
  };

  if (processo?.deferimento_data || processo?.deferimento_documento_id) {
    return montar("deferido", "Seu processo foi deferido. O documento já está disponível para você baixar.");
  }
  if (processo?.protocolo_numero || status === "protocolado" || status === "em_analise_orgao") {
    return montar(
      "na_pf",
      "O seu processo foi protocolado e está em análise na Polícia Federal. Avisamos assim que houver movimentação.",
    );
  }
  if (status === "pronto_para_protocolar") {
    return montar(
      "protocolo",
      "Sua defesa está pronta. Agora é com você: pagar a taxa, enviar o comprovante e assinar a juntada para protocolarmos.",
    );
  }

  const podeAgir = abertos.filter((d) => exigenciaCobravelAgora(d, status));
  if (podeAgir.length > 0) {
    return montar(
      "documentos",
      podeAgir.length === 1
        ? "Falta 1 documento seu para fecharmos a documentação."
        : `Faltam ${podeAgir.length} documentos seus para fecharmos a documentação.`,
    );
  }

  // Compromisso público da casa (20/08/2026): fechada a sua parte, a defesa
  // fica pronta em até 7 dias úteis e vem para a sua aprovação. O cliente
  // precisa LER esse prazo — é o que evita o "e agora?" no WhatsApp.
  const DESCRICAO_DEFESA =
    "Você entregou tudo. A nossa equipe está escrevendo a sua defesa — em até 7 dias úteis ela fica pronta e vem para você aprovar.";

  const comAEquipe = abertos.filter((d) => ehExigenciaEtapaFinal(d));
  if (comAEquipe.length > 0) {
    return montar("defesa", DESCRICAO_DEFESA);
  }

  // Sem exigência aberta e sem protocolo: a documentação fechou e o processo
  // está na mesa da equipe. Dizer "documentos" aqui seria cobrar o cliente por
  // algo que não existe.
  return montar("defesa", DESCRICAO_DEFESA);
}

/** Agrupa os documentos por processo, para alimentar `faseDoProcesso`. */
export function docsPorProcesso<T extends DocParaFase>(docs: readonly T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const d of docs ?? []) {
    const k = String(d?.processo_id ?? "");
    if (!k) continue;
    const lista = mapa.get(k);
    if (lista) lista.push(d);
    else mapa.set(k, [d]);
  }
  return mapa;
}
