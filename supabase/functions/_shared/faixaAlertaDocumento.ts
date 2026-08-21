/**
 * Espelho Deno das regras canônicas de alerta de vencimento.
 *
 * Fonte de verdade no front:
 *   src/lib/quero-armas/validadeDocumento.ts    (faixas por ciclo)
 *   src/lib/quero-armas/gestaoAlertaDocumento.ts (instrução × permanente)
 *
 * Alterou lá, alterou aqui. O teste
 * src/lib/quero-armas/__tests__/paridadeAlertaDocumento.test.ts trava a
 * paridade dos números para o espelho não silenciar de um lado só.
 *
 * ── FAIXAS ────────────────────────────────────────────────────────────────
 * Ciclo curto (validade nominal de 30 dias — antecedentes de 30 dias e
 * comprovante de endereço):
 *   30 → 10 dias  VERDE · 9 → 5 dias  AMARELO · 4 → vencido  VERMELHO
 * Demais (certidões de 90 dias, CR, CRAF, laudos, procuração):
 *   > 30 dias VERDE · 30 → 11 dias AMARELO · 10 → vencido VERMELHO
 *
 * ── REGIME ────────────────────────────────────────────────────────────────
 * INSTRUÇÃO (endereço, antecedentes, renda/ocupação, identificação, BO,
 * declarações, contrato, recurso): precisa estar válido NO DIA DO PROTOCOLO.
 * Protocolado o processo, para de alertar.
 * PERMANENTE (CR, CRAF/SINARM, GT, GTE, autorização de compra, laudos,
 * atividade CAC e procuração): alerta sempre.
 */

export const PRAZO_CRITICO_DIAS = 10;
export const PRAZO_ATENCAO_DIAS = 30;
export const CICLO_CURTO_CRITICO_DIAS = 4;
export const CICLO_CURTO_ATENCAO_DIAS = 9;
export const CICLO_CURTO_VALIDADE_MAX_DIAS = 31;

export type FaixaVencimento = "bad" | "warn" | "ok";
export type RegimeAlertaDocumento = "permanente" | "instrucao";

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

/** Certidões emitidas com validade oficial de 90 dias (TRF/SJSP/JEF, STM, TJM). */
export function isCertidao90Dias(tipo?: string | null): boolean {
  const t = norm(tipo);
  if (!t) return false;
  if (/trf\d?/.test(t) || t.includes("tribunal_regional_federal")) return true;
  if (t.includes("secao_judiciar") || t.includes("sjsp") || /(^|_)jef(_|$)/.test(t)) return true;
  if (t.includes("justica_federal")) return true;
  if (t.includes("justica_militar") || t.includes("crimes_militares") || t.includes("tjm")) return true;
  return t === "antecedentes_militar" || t === "antecedentes_militar_estadual";
}

export function isComprovanteEndereco(tipo?: string | null): boolean {
  const t = norm(tipo);
  return t.startsWith("comprovante_residencia") || t.startsWith("comprovante_endereco");
}

/** Documento que vive ~30 dias e por isso usa a faixa curta (9/4). */
export function isVencimentoCicloCurto(tipo?: string | null): boolean {
  const t = norm(tipo);
  if (!t) return false;
  const curtoPorNatureza = isComprovanteEndereco(t) || t.startsWith("antecedentes_");
  if (!curtoPorNatureza) return false;
  return !isCertidao90Dias(t);
}

export function faixaVencimento(dias: number | null | undefined, tipo?: string | null): FaixaVencimento | null {
  if (dias === null || dias === undefined || Number.isNaN(dias)) return null;
  if (isVencimentoCicloCurto(tipo)) {
    if (dias <= CICLO_CURTO_CRITICO_DIAS) return "bad";
    if (dias <= CICLO_CURTO_ATENCAO_DIAS) return "warn";
    return "ok";
  }
  if (dias <= PRAZO_CRITICO_DIAS) return "bad";
  if (dias <= PRAZO_ATENCAO_DIAS) return "warn";
  return "ok";
}

/**
 * Os DOIS marcos do documento: o dia em que ele entra em AMARELO e o dia em que
 * entra em VERMELHO. O e-mail sai na virada — não há contagem diária.
 */
export function marcosFaixaDocumento(tipo?: string | null): { atencao: number; critico: number } {
  return isVencimentoCicloCurto(tipo)
    ? { atencao: CICLO_CURTO_ATENCAO_DIAS, critico: CICLO_CURTO_CRITICO_DIAS }
    : { atencao: PRAZO_ATENCAO_DIAS, critico: PRAZO_CRITICO_DIAS };
}

// ─── REGIME DE GESTÃO ────────────────────────────────────────────────────────

/** Prefixos/tipos de documento sob gestão PERMANENTE. */
const TIPOS_PERMANENTES_EXATOS = new Set([
  "cr", "craf", "sinarm", "gt", "gte", "autorizacao_compra", "nota_fiscal_arma",
  "laudo_psicologico", "laudo_capacidade_tecnica",
  "atestado_aptidao_psicologica_instituicao", "atestado_capacidade_tecnica_instituicao",
  "comprovante_habitualidade", "declaracao_compromisso_habitualidade",
  "comprovante_clube_tiro", "comprovante_filiacao_entidade_tiro",
  "habilitacao_cacador_ibama", "comprovante_competicao",
]);

export function regimeAlertaDocumento(tipo?: string | null): RegimeAlertaDocumento {
  const t = norm(tipo);
  // Sem tipo não dá para classificar — não silencia nada.
  if (!t) return "permanente";
  // Procuração: sustenta a atuação do escritório em exigência e recurso, que
  // só existem DEPOIS do protocolo.
  if (t === "procuracao" || t.startsWith("procuracao_")) return "permanente";
  if (TIPOS_PERMANENTES_EXATOS.has(t)) return "permanente";
  if (t.includes("autoriza") || t.includes("aquisi")) return "permanente";
  if (t.includes("laudo")) return "permanente";
  return "instrucao";
}

const STATUS_PROCESSO_POS_PROTOCOLO = new Set([
  "protocolado", "enviado_ao_orgao", "enviado_orgao", "em_analise_orgao", "em_analise_pf",
  "deferido", "indeferido", "concluido", "finalizado", "arquivado", "cancelado",
  "desistiu", "restituido",
]);

const STATUS_PROCESSO_EXIGENCIA = new Set([
  "em_exigencia", "exigencia", "exigencia_emitida", "cumprindo_exigencia", "notificado",
  // Lei 9.784/99 (regra do titular, 20/08/2026): pós-protocolo o relógio só
  // volta em notificação ou recurso administrativo. SIGMA e SINARM.
  "recurso_administrativo", "em_recurso",
]);

/** Ainda existe processo que precisa da documentação de instrução válida? */
export function instrucaoAindaExigida(processos?: Array<{ status?: string | null }> | null): boolean {
  const status = (processos ?? []).map((p) => norm(p?.status)).filter(Boolean);
  // Sem processo conhecido não dá para afirmar que já foi protocolado: cobra.
  if (!status.length) return true;
  if (status.some((s) => STATUS_PROCESSO_EXIGENCIA.has(s))) return true;
  return status.some((s) => !STATUS_PROCESSO_POS_PROTOCOLO.has(s));
}

export function documentoSobGestaoDeAlerta(
  tipo: string | null | undefined,
  opts: { instrucaoExigida: boolean },
): boolean {
  if (regimeAlertaDocumento(tipo) === "permanente") return true;
  return opts.instrucaoExigida;
}
