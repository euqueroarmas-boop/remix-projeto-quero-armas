/**
 * DUPLICIDADE NO HUB — "este documento aprovado ainda cobre a exigência?"
 *
 * O Hub recusa um envio quando já existe documento do MESMO TIPO aprovado no
 * acervo do cliente. A recusa acontece antes do upload: o arquivo nem chega a
 * subir. Isso está certo para o caso que a trava foi escrita para pegar — o
 * cliente reenviando o que já entregou.
 *
 * O que estava errado: a trava olhava só `tipo_documento` + `status`. O banco
 * NUNCA se contentou com isso. Tanto o gatilho `qa_doc_hub_satisfaz_exigencias_processo`
 * quanto o motor `qa_processo_rever_exigencias` exigem também:
 *
 *   1. documento dentro da validade (`data_validade >= CURRENT_DATE`);
 *   2. no slot com ano de competência, documento emitido NAQUELE ano.
 *
 * Com as duas pontas discordando, o comprovante de residência vencido virava
 * uma armadilha fechada: o checklist continuava pedindo o comprovante (o banco,
 * corretamente, não fechava o slot com documento vencido), e o Hub recusava o
 * comprovante novo por "duplicidade" (a tela, incorretamente, achava que o
 * vencido ainda valia). O cliente reenviava, via carimbo verde, e a pendência
 * não saía do lugar — caso Gilson, 17/08/2026.
 *
 * Este motor é a fonte única da decisão, com as MESMAS regras do banco:
 *
 *   - documento aprovado e ainda válido para o alvo → duplicata de verdade,
 *     o reenvio é recusado;
 *   - documento aprovado mas vencido ou de outro ano → NÃO é duplicata: é
 *     RENOVAÇÃO, e o envio novo substitui o antigo.
 */
import { getValidadeInfo, type DocValidadeInput } from "./validadeDocumento";

export interface DocHubAprovado {
  id?: string | null;
  tipo_documento?: string | null;
  status?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  data_validade_efetiva?: string | null;
  ano_competencia?: number | string | null;
  regra_validacao?: unknown;
  ia_dados_extraidos?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Por que o documento aprovado deixou de cobrir a exigência. */
export type MotivoRenovacao = "vencido" | "outro_ano";

export interface AvaliacaoDuplicidade {
  /** Documento aprovado que REALMENTE cobre a exigência — reenvio é duplicidade. */
  duplicata: DocHubAprovado | null;
  /** Documento aprovado que não cobre mais — o envio novo entra como substituição. */
  renovar: DocHubAprovado | null;
  motivo: MotivoRenovacao | null;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

const ehAprovado = (d: DocHubAprovado) => ["aprovado", "validado"].includes(norm(d?.status));

const tsDoc = (d: DocHubAprovado): number => {
  const t = Date.parse(String(d?.updated_at || d?.created_at || ""));
  return Number.isFinite(t) ? t : 0;
};

/**
 * Ano exigido por um slot de endereço (`comprovante_endereco_ano_2025`,
 * `comprovante_residencia_2025`). Null quando o slot não amarra ano — é o
 * comprovante ATUAL, que por definição pede o ano corrente.
 */
export function anoDoSlotEndereco(tipo?: string | null): number | null {
  const m = /^comprovante_(?:endereco|residencia)(?:_ano)?_(\d{4})$/i.exec(norm(tipo));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 1900 && n < 3000 ? n : null;
}

/** Documentos de endereço são os únicos com exigência por ano de competência. */
function ehDocEndereco(tipo?: string | null): boolean {
  const t = norm(tipo);
  return t.startsWith("comprovante_endereco") || t.startsWith("comprovante_residencia");
}

/**
 * Ano de competência do documento entregue — mesma cascata que
 * `validadeDocumento` usa: campo explícito, regra gravada, ou o ano da emissão.
 */
function anoDoDocumento(doc: DocHubAprovado): number | null {
  const regra = doc?.regra_validacao as { ano_competencia?: unknown } | null | undefined;
  const candidatos: unknown[] = [
    regra && typeof regra === "object" ? regra.ano_competencia : null,
    doc?.ano_competencia,
  ];
  for (const c of candidatos) {
    if (c == null) continue;
    const n = Number(c);
    if (Number.isFinite(n) && n > 1900 && n < 3000) return n;
  }
  const doTipo = anoDoSlotEndereco(doc?.tipo_documento);
  if (doTipo) return doTipo;
  const emissao = String(doc?.data_emissao || "").slice(0, 4);
  const n = Number(emissao);
  return Number.isFinite(n) && n > 1900 && n < 3000 ? n : null;
}

/**
 * O documento aprovado cobre a exigência aberta?
 *
 * `anoAlvo` só é considerado para documentos de endereço. Quando o slot não
 * amarra ano (comprovante ATUAL), o alvo é o ano corrente: comprovante de 2023
 * é prova histórica de residência, não prova de onde a pessoa mora hoje.
 */
export function docCobreExigencia(
  doc: DocHubAprovado,
  opts: { tipoAlvo?: string | null; anoAlvo?: number | null; hoje?: Date } = {},
): { cobre: boolean; motivo: MotivoRenovacao | null } {
  const hoje = opts.hoje ?? new Date();
  const anoAtual = hoje.getFullYear();

  // Ordem igual à do gatilho `qa_doc_hub_satisfaz_exigencias_processo`: o ano
  // manda antes da validade. Comprovante de ano passado é prova histórica de
  // residência — não vence, e por isso mesmo não serve para o ano corrente.
  if (ehDocEndereco(doc?.tipo_documento) || ehDocEndereco(opts.tipoAlvo)) {
    const alvo = opts.anoAlvo ?? anoAtual;
    const anoDoc = anoDoDocumento(doc);
    // Sem data de emissão legível não dá para afirmar que o documento é do ano
    // pedido — e o banco, no mesmo caso, também não fecha o slot. Fail-closed:
    // não bloqueia o reenvio.
    if (anoDoc !== alvo) return { cobre: false, motivo: "outro_ano" };
    if (alvo < anoAtual) return { cobre: true, motivo: null };
  }

  if (getValidadeInfo(doc as DocValidadeInput, hoje).status === "vencido") {
    return { cobre: false, motivo: "vencido" };
  }

  return { cobre: true, motivo: null };
}

/**
 * Decide, entre os documentos aprovados do acervo, se o envio em curso é
 * duplicidade (recusa) ou renovação (substitui o antigo).
 */
export function avaliarDuplicidadeHub(opts: {
  docs: DocHubAprovado[];
  tipo?: string | null;
  /** Ano exigido pelo slot do checklist que abriu o envio, quando houver. */
  anoAlvo?: number | null;
  hoje?: Date;
}): AvaliacaoDuplicidade {
  const tipo = norm(opts.tipo);
  const vazio: AvaliacaoDuplicidade = { duplicata: null, renovar: null, motivo: null };
  if (!tipo) return vazio;

  const mesmoTipo = (opts.docs || [])
    .filter((d) => ehAprovado(d) && norm(d?.tipo_documento) === tipo)
    .sort((a, b) => tsDoc(b) - tsDoc(a));
  if (mesmoTipo.length === 0) return vazio;

  const avaliados = mesmoTipo.map((doc) => ({
    doc,
    ...docCobreExigencia(doc, { tipoAlvo: opts.tipo, anoAlvo: opts.anoAlvo, hoje: opts.hoje }),
  }));

  const cobre = avaliados.find((a) => a.cobre);
  if (cobre) return { duplicata: cobre.doc, renovar: null, motivo: null };

  const alvo = avaliados[0];
  return { duplicata: null, renovar: alvo.doc, motivo: alvo.motivo };
}

/** Frase mostrada ao cliente quando o envio é renovação, não duplicidade. */
export function mensagemRenovacao(motivo: MotivoRenovacao | null): string | null {
  if (motivo === "vencido") {
    return "O documento que estava no seu Hub venceu. Este envio substitui o anterior.";
  }
  if (motivo === "outro_ano") {
    return "O documento que estava no seu Hub é de outro ano. Este envio substitui o anterior.";
  }
  return null;
}
