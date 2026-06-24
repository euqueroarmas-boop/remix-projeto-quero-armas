/**
 * Engine de seleção de laudos/exames para protocolo PF.
 *
 * Regra mãe (Lei 10.826/03 + prática operacional PF):
 *   - Exame psicológico e exame de tiro têm validade de 1 ANO a partir da
 *     DATA DA AVALIAÇÃO (não da emissão).
 *   - O exame de tiro só é válido se, NA DATA EM QUE FOI REALIZADO, o
 *     candidato possuía um exame psicológico vigente.
 *   - Se o psicológico vigente HOJE é POSTERIOR ao exame de tiro vigente,
 *     o psicológico ANTIGO (que estava válido na época do tiro) também
 *     precisa ser apresentado, senão a PF indefere.
 *
 * Exemplo do usuário:
 *   Psicológico A: avaliação 01/01/2025 (vence 01/01/2026)
 *   Tiro:          avaliação 01/06/2025 (vence 01/06/2026)
 *   Protocolo:     01/02/2026
 *   Como o psicológico A já venceu, o cliente faz novo psicológico B em
 *   10/02/2026. Se entregar apenas B + Tiro, a PF indefere (o tiro foi
 *   feito antes de B). Solução: entregar A (vencido, histórico) + B + Tiro.
 */

export type LaudoTipo =
  | "laudo_psicologico"
  | "exame_psicologico"
  | "laudo_psicotecnico"
  | "exame_tiro"
  | "capacidade_tecnica"
  | "laudo_capacidade_tecnica";

export interface LaudoDoc {
  id: string;
  tipo_documento: string;
  data_avaliacao?: string | null; // ISO YYYY-MM-DD
  data_emissao?: string | null;
  data_validade?: string | null;
  /** URL/path do arquivo para anexar ao protocolo. */
  arquivo_path?: string | null;
}

export interface ProtocoloSelecao {
  exameTiro: LaudoDoc | null;
  psicologicoAtual: LaudoDoc | null;
  psicologicosHistoricos: LaudoDoc[];
  /** Mensagens explicativas para a UI. */
  avisos: string[];
}

const TIRO_RE = /(exame_tiro|capacidade_tecnica)/i;
const PSICO_RE = /(psicolog|psicotecnico)/i;

function parseISO(s?: string | null): number | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

function addYears(ts: number, years: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate());
}

function dataAvaliacaoOuEmissao(doc: LaudoDoc): number | null {
  return parseISO(doc.data_avaliacao) ?? parseISO(doc.data_emissao);
}

function dataValidade(doc: LaudoDoc): number | null {
  const av = dataAvaliacaoOuEmissao(doc);
  if (av != null) return addYears(av, 1);
  return parseISO(doc.data_validade);
}

/**
 * Seleciona os exames que devem ser entregues à PF na data informada.
 * Retorna o exame de tiro vigente, o psicológico vigente e — quando o
 * psicológico vigente for POSTERIOR ao tiro — o psicológico antigo que
 * cobria a data do tiro (mesmo vencido).
 */
export function selecionarExamesParaProtocolo(
  docs: LaudoDoc[],
  dataProtocoloISO: string = new Date().toISOString().slice(0, 10),
): ProtocoloSelecao {
  const dataProtocolo = parseISO(dataProtocoloISO);
  const avisos: string[] = [];
  const out: ProtocoloSelecao = {
    exameTiro: null,
    psicologicoAtual: null,
    psicologicosHistoricos: [],
    avisos,
  };
  if (dataProtocolo == null) return out;

  const tiros = docs
    .filter((d) => TIRO_RE.test(d.tipo_documento))
    .map((d) => ({ doc: d, av: dataAvaliacaoOuEmissao(d), val: dataValidade(d) }))
    .filter((x) => x.av != null);
  const psicos = docs
    .filter((d) => PSICO_RE.test(d.tipo_documento))
    .map((d) => ({ doc: d, av: dataAvaliacaoOuEmissao(d), val: dataValidade(d) }))
    .filter((x) => x.av != null);

  // Exame de tiro vigente na data do protocolo: maior data_avaliacao
  // cuja validade (av + 1 ano) >= dataProtocolo.
  const tiroVigente =
    tiros
      .filter((x) => (x.val ?? 0) >= dataProtocolo)
      .sort((a, b) => (b.av ?? 0) - (a.av ?? 0))[0] ?? null;

  if (!tiroVigente) {
    if (tiros.length > 0) {
      avisos.push("Nenhum exame de tiro vigente na data do protocolo. É necessário refazer.");
    }
    // Ainda assim selecionamos o psicológico vigente.
  } else {
    out.exameTiro = tiroVigente.doc;
  }

  // Psicológico vigente: maior data_avaliacao com validade >= dataProtocolo.
  const psicoVigente =
    psicos
      .filter((x) => (x.val ?? 0) >= dataProtocolo)
      .sort((a, b) => (b.av ?? 0) - (a.av ?? 0))[0] ?? null;

  if (!psicoVigente) {
    if (psicos.length > 0) {
      avisos.push("Nenhum exame psicológico vigente na data do protocolo. É necessário refazer.");
    }
    return out;
  }
  out.psicologicoAtual = psicoVigente.doc;

  // Se o exame de tiro vigente é ANTERIOR ao psicológico vigente, então o
  // tiro foi feito enquanto OUTRO psicológico (mais antigo) era válido.
  // Esse psicológico antigo precisa ser apresentado também.
  if (tiroVigente && (tiroVigente.av ?? 0) < (psicoVigente.av ?? 0)) {
    const tiroAv = tiroVigente.av!;
    // Psicológico mais recente cuja data_avaliacao <= tiroAv e validade >= tiroAv.
    const psicoNaEpoca =
      psicos
        .filter((x) => (x.av ?? 0) <= tiroAv && (x.val ?? 0) >= tiroAv)
        .sort((a, b) => (b.av ?? 0) - (a.av ?? 0))[0] ?? null;

    if (psicoNaEpoca && psicoNaEpoca.doc.id !== psicoVigente.doc.id) {
      out.psicologicosHistoricos.push(psicoNaEpoca.doc);
      avisos.push(
        "Exame psicológico anterior incluído no protocolo: cobria a data do exame de tiro " +
          "vigente. A PF exige comprovação de que o tiro foi realizado com psicológico válido.",
      );
    } else {
      avisos.push(
        "ATENÇÃO: o exame de tiro vigente foi realizado ANTES do psicológico atual e não há " +
          "psicológico no histórico cobrindo aquela data. A PF provavelmente indeferirá — " +
          "considere refazer o exame de tiro após o psicológico atual.",
      );
    }
  }

  return out;
}
