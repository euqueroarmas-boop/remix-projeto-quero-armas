/**
 * BLOCO 5 — Validade efetiva de documentos (camada ADITIVA).
 *
 * Não substitui a edge `qa-extract-doc-dates` nem o validador congelado
 * `qa-processo-doc-validar-ia`. Apenas calcula, no momento de exibir, a
 * regra de negócio oficial da Quero Armas:
 *
 *  - Comprovante de residência → vale da emissão de uma conta até a
 *    emissão da próxima (ciclo mensal: mesmo dia do mês seguinte). Anos
 *    anteriores continuam tratados como HISTÓRICOS (não vencem).
 *  - Certidões específicas (Federal TRF3 regional, TJM-SP e STM) → emissão + 90 dias.
 *  - Demais documentos temporários → emissão + 1 mês calendário.
 *
 * A função é tolerante: prefere `data_emissao` para recalcular; se não
 * houver, cai em `data_validade_efetiva` já gravada pelo backend, e por
 * fim em `data_validade`.
 */

// ─── FUSO CANÔNICO: America/Sao_Paulo ────────────────────────────────────────
// Toda contagem de prazo da plataforma usa o "hoje" de Brasília. Usar UTC fazia
// o resumo virar o dia às 21h (BRT) e mostrar 1 dia a menos que o banco.

/** Data de hoje em America/Sao_Paulo no formato YYYY-MM-DD. */
export function hojeISOBRT(ref: Date = new Date()): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(ref); // en-CA → "YYYY-MM-DD"
}

/** Timestamp (UTC ms) da meia-noite de hoje em Brasília, para diferenças em dias. */
export function hojeBRT(ref: Date = new Date()): number {
  const [y, m, d] = hojeISOBRT(ref).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Dias até a data informada (ISO YYYY-MM-DD ou BR DD/MM/AAAA), sempre no fuso
 * de Brasília. Fonte única de verdade para prazos exibidos ao cliente.
 */
export function diasAteBRT(value?: string | null, ref: Date = new Date()): number | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  let alvo: number | null = null;
  if (iso) alvo = Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  else if (br) alvo = Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  if (alvo === null || Number.isNaN(alvo)) return null;
  return Math.round((alvo - hojeBRT(ref)) / 86400000);
}

export interface DocValidadeInput {
  tipo_documento?: string | null;
  data_emissao?: string | null;
  data_validade_efetiva?: string | null;
  data_validade?: string | null;
  ano_competencia?: number | string | null;
  regra_validacao?: any;
  /** Documento cuja validade é explicitamente INDETERMINADA (não vence). */
  validade_indeterminada?: boolean | null;
  ia_dados_extraidos?: any;
  observacoes?: string | null;
}

/**
 * Regra canônica: quando o próprio documento declara validade INDETERMINADA
 * (ex.: identidade funcional "VALIDADE: INDETERM."), ele NÃO tem prazo de
 * vencimento — nunca pode ser reprovado por vencimento e o Hub Documental
 * exibe "Sem vencimento".
 */
export const RX_VALIDADE_INDETERMINADA =
  /indetermin|prazo\s+indeterminado|sem\s+prazo\s+de\s+validade|sem\s+validade|vital[ií]ci|validade\s*:?\s*permanente/i;

// ─── BLOCO 4 — FONTE ÚNICA DE VALIDADE ───────────────────────────────────────
// A tabela `public.qa_validade_documentos` é a fonte oficial dos prazos.
// `carregarCatalogoValidade()` (catalogoValidade.ts) registra o catálogo aqui
// e, a partir daí, TODA regra de prazo passa a sair do banco. As funções
// `isCertidao90Dias`, `isDocumentoEmpresa30Dias` etc. continuam existindo
// apenas como fallback para quando o catálogo ainda não carregou ou o tipo
// não está cadastrado — nunca sobrepõem o banco.

export interface RegraValidade {
  tipo_documento: string;
  validade_dias: number;
  unidade: "dias" | "meses";
  perpetuo: boolean;
  alerta_dias: number;
}

let CATALOGO_VALIDADE: Record<string, RegraValidade> = {};

export function setCatalogoValidade(regras: RegraValidade[]) {
  const map: Record<string, RegraValidade> = {};
  for (const r of regras) {
    if (!r?.tipo_documento) continue;
    map[String(r.tipo_documento).trim().toLowerCase()] = {
      ...r,
      unidade: r.unidade === "meses" ? "meses" : "dias",
    };
  }
  CATALOGO_VALIDADE = map;
}

export function getRegraValidade(tipo?: string | null): RegraValidade | null {
  const t = String(tipo ?? "").trim().toLowerCase();
  if (!t) return null;
  return CATALOGO_VALIDADE[t] ?? null;
}

export function catalogoValidadeCarregado(): boolean {
  return Object.keys(CATALOGO_VALIDADE).length > 0;
}

export function textoIndicaValidadeIndeterminada(...valores: unknown[]): boolean {
  return valores.some((v) => typeof v === "string" && RX_VALIDADE_INDETERMINADA.test(v));
}

export function docTemValidadeIndeterminada(doc: any): boolean {
  if (!doc || typeof doc !== "object") return false;
  if (doc.validade_indeterminada === true) return true;
  const campos = doc.ia_dados_extraidos?.camposExtraidos || {};
  if (campos?.validade_indeterminada === true || campos?.validade_indeterminada === "true") return true;
  if (doc.ia_dados_extraidos?.validade_indeterminada === true) return true;
  if (doc.regra_validacao?.validade_indeterminada === true) return true;
  return textoIndicaValidadeIndeterminada(
    campos?.data_validade,
    campos?.validade,
    campos?.observacoes,
    doc.observacoes,
  );
}

export type ValidadeStatus = "vigente" | "vence_em_breve" | "vencido" | "indefinido" | "historico";

/**
 * Validade DECLARADA no próprio documento (lida pelo parser/IA ou gravada
 * manualmente). Tem precedência sobre qualquer prazo do catálogo do banco:
 * se a certidão diz "válida por 30 dias" (ou 60/90), é essa data que vale.
 */
export function getValidadeDeclarada(doc: DocValidadeInput): string | null {
  const campos = (doc as any)?.ia_dados_extraidos?.camposExtraidos || {};
  const candidatos = [
    campos?.data_validade,
    campos?.validade,
    (doc as any)?.regra_validacao?.data_validade_declarada,
    doc.data_validade,
  ];
  for (const c of candidatos) {
    if (typeof c !== "string" || !c.trim()) continue;
    if (RX_VALIDADE_INDETERMINADA.test(c)) return null;
    const p = parseFlexibleDate(c) ?? parseISODate(c);
    if (p) return toISO(p);
  }
  return null;
}

export interface ValidadeInfo {
  /** ISO yyyy-mm-dd da data de validade efetiva calculada. Null se desconhecida. */
  iso: string | null;
  /** "DD/MM/AAAA" formatada para UI. Null se desconhecida. */
  label: string | null;
  /** Dias até vencer (negativo = vencido). Null se desconhecida. */
  dias: number | null;
  status: ValidadeStatus;
  /** Origem da data: recálculo de negócio, valor do backend, ou desconhecido. */
  origem: "regra_negocio" | "backend" | "indefinido" | "historico";
  /**
   * Documento histórico (ex.: comprovante de residência de competência passada):
   * não vence, não deve receber cor de vencido. UI mostra apenas `label`
   * (ex.: "Competência 2023").
   */
  semVencimento?: boolean;
}

const COMPROVANTE_TOKENS = [
  "comprovante_endereco",
  "comprovante_residencia",
  "comprovante_de_endereco",
  "comprovante_de_residencia",
];

export function isComprovanteEndereco(tipo?: string | null): boolean {
  if (!tipo) return false;
  const t = String(tipo).toLowerCase();
  return COMPROVANTE_TOKENS.some((k) => t.includes(k));
}

/**
 * Certidões civis (nascimento, casamento, averbação) NÃO têm validade
 * para o fluxo da Quero Armas — o que conta é o estado civil atual e a
 * averbação. A camada de UI nunca deve marcar este tipo como "vencido".
 */
const CERTIDAO_CIVIL_TIPOS = new Set<string>([
  "certidao_nascimento",
  "certidao_casamento",
  "certidao_alteracao_nome",
  "certidao_averbacao",
  "certidao_civil",
]);
export function isCertidaoCivilSemVencimento(tipo?: string | null): boolean {
  if (!tipo) return false;
  const t = String(tipo).toLowerCase();
  if (CERTIDAO_CIVIL_TIPOS.has(t)) return true;
  // cobre variações tipo `certidao_nascimento_averbada`, `certidao_casamento_v2`
  return /^certidao_(nascimento|casamento|averbacao|alteracao_nome)(_|$)/.test(t);
}

function parseISODate(s?: string | null): Date | null {
  if (!s) return null;
  // aceita "yyyy-mm-dd" ou ISO completo
  const onlyDate = s.length >= 10 ? s.slice(0, 10) : s;
  const [y, m, d] = onlyDate.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return isNaN(dt.getTime()) ? null : dt;
}

function pickNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

function parseFlexibleDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return parseISODate(`${iso[1]}-${iso[2]}-${iso[3]}`);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return parseISODate(`${br[3]}-${br[2]}-${br[1]}`);
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return parseISODate(`${ym[1]}-${ym[2]}-01`);
  const my = raw.match(/^(\d{2})\/(\d{4})$/);
  if (my) return parseISODate(`${my[2]}-${my[1]}-01`);
  return null;
}

export function getDataEmissaoDocumentoHub(doc: any): string | null {
  const paths = [
    "data_emissao",
    "data_expedicao",
    "data_expedicao_rg",
    "data_documento",
    "data_referencia",
    "mes_referencia",
    "periodo_referencia",
    "ia_dados_extraidos.camposExtraidos.data_emissao",
    "ia_dados_extraidos.camposExtraidos.data_expedicao",
    "ia_dados_extraidos.camposExtraidos.data_expedicao_rg",
    "ia_dados_extraidos.camposExtraidos.data_documento",
    "ia_dados_extraidos.camposExtraidos.data_referencia",
    "ia_dados_extraidos.camposExtraidos.mes_referencia",
    "ia_dados_extraidos.camposExtraidos.periodo_referencia",
    "ia_dados_extraidos.campos_extraidos.data_emissao",
    "ia_dados_extraidos.campos_extraidos.data_expedicao",
    "ia_dados_extraidos.campos_extraidos.data_expedicao_rg",
    "ia_dados_extraidos.campos_extraidos.data_documento",
    "ia_dados_extraidos.campos_extraidos.data_referencia",
    "ia_dados_extraidos.campos_extraidos.mes_referencia",
    "ia_dados_extraidos.campos_extraidos.periodo_referencia",
    "ia_dados_extraidos.campos.data_emissao",
    "ia_dados_extraidos.campos.data_expedicao",
    "ia_dados_extraidos.campos.data_expedicao_rg",
    "ia_dados_extraidos.campos.data_documento",
    "ia_dados_extraidos.campos.data_referencia",
    "ia_dados_extraidos.campos.mes_referencia",
    "ia_dados_extraidos.campos.periodo_referencia",
  ];
  for (const path of paths) {
    const date = parseFlexibleDate(path.includes(".") ? pickNestedValue(doc, path) : doc?.[path]);
    if (date) return toISO(date);
  }
  return null;
}

function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function ultimoDiaDoMes(year: number, monthZeroBased: number): Date {
  // dia 0 do mês seguinte = último dia do mês corrente
  return new Date(Date.UTC(year, monthZeroBased + 1, 0));
}

function addCalendarMonths(d: Date, months = 1): Date {
  const targetFirst = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = ultimoDiaDoMes(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth()).getUTCDate();
  return new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), Math.min(d.getUTCDate(), lastDay)));
}

function pickAnoCompetencia(doc: DocValidadeInput): number | null {
  const r = doc.regra_validacao;
  const candidates: any[] = [
    r && typeof r === "object" ? r.ano_competencia : null,
    doc.ano_competencia,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const n = Number(c);
    if (Number.isFinite(n) && n > 1900 && n < 3000) return n;
  }
  // Fallback: comprovantes históricos são modelados como
  // `comprovante_residencia_YYYY` (gerado pelo modal) ou, legado,
  // `comprovante_endereco_ano_YYYY`. Extraímos o ano do próprio tipo
  // para que o motor de validade trate corretamente como histórico.
  const m = /^comprovante_(?:endereco|residencia)(?:_ano)?_(\d{4})$/i.exec(String(doc.tipo_documento || ""));
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 1900 && n < 3000) return n;
  }
  return null;
}

function pickTipoBase(doc: DocValidadeInput): string | null {
  const r = doc.regra_validacao;
  const tb = r && typeof r === "object" ? r.tipo_base : null;
  return (tb || doc.tipo_documento || null) as string | null;
}

function isResidenciaDoc(doc: DocValidadeInput): boolean {
  const tipoBase = String(pickTipoBase(doc) || "").toLowerCase();
  if (tipoBase === "comprovante_residencia" || tipoBase === "comprovante_endereco") return true;
  const tipo = String(doc.tipo_documento || "").toLowerCase();
  return tipo.startsWith("comprovante_residencia") || tipo.startsWith("comprovante_endereco");
}

export function isCertidao90Dias(tipo?: string | null): boolean {
  const t = String(tipo ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const exatos = [
    "certidao_federal_trf3_regional",
    "certidao_federal_trf3",
    "certidao_federal_trf",
    "antecedentes_federal_trf3_regional",
    "antecedentes_federal_trf3",
    "antecedentes_federal_trf",
    "trf3",
    "certidao_criminal_tjmsp",
    "certidao_crimes_militares_stm",
    "certidao_estadual_justica_militar",
    "antecedentes_militar",
    "antecedentes_militar_estadual",
  ];
  if (exatos.includes(t)) return true;
  // Justiça Federal (TRF de qualquer região, Seção Judiciária e JEF):
  // certidões emitidas com validade oficial de 90 dias.
  if (/trf\d?/.test(t) || t.includes("tribunal_regional_federal")) return true;
  if (t.includes("secao_judiciar") || t.includes("sjsp") || /(^|_)jef(_|$)/.test(t)) return true;
  if (t.includes("justica_federal")) return true;
  // Justiça Militar (STM / TJM estaduais) também seguem 90 dias.
  if (t.includes("justica_militar") || t.includes("crimes_militares") || t.includes("tjm")) return true;
  return false;
}

/**
 * Filiação de clube de tiro: a validade real segue a anuidade
 * (12 meses a partir da emissão da carteirinha/comprovante), não os
 * 30 dias do fallback antigo. Se houver `data_validade` gravada
 * futura, ela prevalece; caso contrário aplicamos emissão + 1 ano.
 */
export function isFiliacaoClube(tipo?: string | null): boolean {
  const t = String(tipo ?? "").toLowerCase();
  return t === "comprovante_clube_tiro" || t === "filiacao_clube" || t === "carteirinha_clube_tiro";
}

export function isDocumentoIdentificacao10Anos(tipo?: string | null): boolean {
  const t = String(tipo ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return [
    "rg",
    "rg_com_cpf",
    "cin",
    "cnh",
    "passaporte",
    "documento_identidade",
    "documento_identificacao",
    "identidade",
  ].includes(t) ||
    t.includes("carteira_de_identidade") ||
    t.includes("carteira_identidade") ||
    t.includes("identidade_nacional") ||
    t.includes("passaporte");
}

export function isProcuracao365Dias(tipo?: string | null): boolean {
  const t = String(tipo ?? "").toLowerCase();
  return t === "procuracao" || t.startsWith("procuracao_");
}

/**
 * Procuração (assinada ou não): validade padrão de 12 meses a partir da
 * emissão. Regra oficial Quero Armas — permite reaproveitamento entre
 * processos enquanto vigente no Hub Documental.
 */
export function isProcuracao(tipo?: string | null): boolean {
  const t = String(tipo ?? "").toLowerCase();
  return t === "procuracao" || t === "procuracao_assinada";
}

/**
 * Calcula a data de validade efetiva conforme regra de negócio.
 * Retorna null se não houver `data_emissao` (não recalcula).
 */
/**
 * Nota fiscal (de serviços/produto): comprova renda de um fato passado e
 * NÃO vence — validade perpétua. Única exceção do grupo Ocupação Lícita.
 */
export function isNotaFiscalSemVencimento(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return (
    t === "renda_nf_recente" ||
    t === "renda_nf_empresa" ||
    t === "nota_fiscal" ||
    t.includes("nota_fiscal") ||
    /(^|_)nf(_|$)/.test(t)
  );
}

/**
 * Documentos CONSTITUTIVOS da empresa: não têm prazo de validade. O CCMEI,
 * o contrato social e o requerimento de empresário provam a existência da
 * empresa, não a situação dela num dado dia. A atualidade da ocupação lícita
 * é conferida pela EMISSÃO do cartão CNPJ e do QSA (esses sim, 30 dias).
 */
export function isDocumentoConstitutivoPerpetuo(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return (
    t === "renda_ccmei" ||
    t === "ccmei" ||
    t.includes("ccmei") ||
    t === "renda_contrato_social" ||
    t.includes("contrato_social") ||
    t === "renda_ficha_cadastral_jucesp" ||
    t.includes("ficha_cadastral") ||
    t.includes("requerimento_empresario") ||
    t.includes("requerimento_de_empresario")
  );
}

/**
 * IDENTIDADE FUNCIONAL / carteira funcional (PM, PC, Bombeiros, Fé Pública
 * Decreto 14.298/79, magistratura, etc.): o próprio documento traz
 * "VALIDADE: INDETERMINADA". Não vence — nunca calcular 30 dias sobre a
 * data de expedição.
 */
export function isIdentidadeFuncionalPerpetua(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return (
    t === "renda_carteira_funcional" ||
    t.includes("carteira_funcional") ||
    t.includes("identidade_funcional") ||
    t.includes("funcional_militar") ||
    t.includes("fe_publica")
  );
}

/**
 * Comprovante de pagamento do contrato: recibo de um fato passado (pagamento
 * já realizado). Pertence ao CONTRATO e NÃO vence — nunca calcular validade.
 */
export function isComprovantePagamentoContrato(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return t === "comprovante_pagamento" || t === "comprovante_pagamento_contrato";
}

/**
 * AGREGADOR CANÔNICO — o tipo NÃO tem prazo de validade por natureza.
 *
 * Fonte única para qualquer camada que precise decidir "este documento pode
 * ser considerado VENCIDO?". Nenhuma tela pode inventar a própria lista: a
 * falsa reprovação do CCMEI nasceu exatamente de uma trava genérica que olhava
 * só para `data_validade` e ignorava a natureza do tipo, carimbando
 * "REPROVADO — VENCIDO" num certificado que não tem vencimento.
 *
 * Cobre: comprovante de pagamento do contrato, nota fiscal, documentos
 * constitutivos da empresa (CCMEI, contrato social, requerimento/ficha da
 * Junta), carteira/identidade funcional e certidões civis.
 *
 * NÃO cobre Cartão CNPJ nem QSA — esses continuam com 30 dias da emissão.
 */
export function isTipoSemVencimento(tipo?: string | null): boolean {
  return (
    isComprovantePagamentoContrato(tipo) ||
    isNotaFiscalSemVencimento(tipo) ||
    isDocumentoConstitutivoPerpetuo(tipo) ||
    isIdentidadeFuncionalPerpetua(tipo) ||
    isCertidaoCivilSemVencimento(tipo)
  );
}

/**
 * TRAVA DE VENCIMENTO — fonte única do "este documento está vencido?".
 *
 * Regra: só pode estar vencido o tipo que realmente exige validade. Antes de
 * comparar a data, a natureza do tipo manda. Um `data_validade` residual (troca
 * de arquivo no formulário, dado legado no banco, palpite da IA) NUNCA pode
 * reprovar CCMEI, contrato social, requerimento de empresário, nota fiscal,
 * carteira funcional ou certidão civil.
 *
 * O "hoje" é o de Brasília — comparar com UTC virava o dia às 21h e reprovava
 * documento que ainda valia.
 */
export function isDocumentoVencido(
  tipo: string | null | undefined,
  dataValidade: string | null | undefined,
  opts: { validadeIndeterminada?: boolean; hoje?: string; ref?: Date } = {},
): boolean {
  if (opts.validadeIndeterminada) return false;
  if (isTipoSemVencimento(tipo)) return false;
  const validade = String(dataValidade || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) return false;
  const hoje = opts.hoje || hojeISOBRT(opts.ref);
  return validade < hoje;
}

/**
 * Grupo OCUPAÇÃO LÍCITA E RENDA: regra oficial Quero Armas — todos valem
 * 30 dias a partir da emissão (CCMEI, cartão CNPJ, QSA, contrato social,
 * ficha JUCESP, holerite, extrato INSS, CTPS, carteira funcional etc.).
 * Exceções sem vencimento: nota fiscal e documentos constitutivos
 * (CCMEI, contrato social, requerimento de empresário).
 */
export function isDocumentoEmpresa30Dias(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  if (isNotaFiscalSemVencimento(t)) return false;
  if (isDocumentoConstitutivoPerpetuo(t)) return false;
  if (isIdentidadeFuncionalPerpetua(t)) return false;
  return (
    t.startsWith("renda_") ||
    t.startsWith("ocupacao_licita") ||
    t === "renda_cartao_cnpj" ||
    t === "cartao_cnpj_mei" // alias legado
  );
}

// ─── FAIXAS DE ALERTA DE VENCIMENTO (fonte única) ────────────────────────────
/**
 * REGRA CANÔNICA DE COR/ALERTA POR PRAZO (definida pelo usuário, 14/08/2026).
 *
 * O erro que isto conserta: as faixas eram fixas (vermelho ≤10, amarelo ≤30) e
 * ignoravam quanto tempo o documento vive. Numa certidão de 30 dias isso fazia
 * o alerta NASCER amarelo — 25 dias restantes já apareciam como pendência — e
 * ficar vermelho na metade da vida útil. Alerta que nasce aceso não é alerta.
 *
 * CICLO CURTO (validade nominal de 30 dias: antecedentes de 30 dias e
 * comprovante de endereço):
 *
 *   30 → 10 dias  → VERDE   (nasce em dia e fica ~20 dias tranquilo)
 *    9 →  5 dias  → AMARELO (abre a janela de renovação)
 *    4 → vencido  → VERMELHO
 *
 * DEMAIS DOCUMENTOS (certidões de 90 dias, CR, CRAF, laudos, procuração…):
 * seguem a faixa padrão de sempre — vermelho ≤10, amarelo ≤30, verde acima.
 * Um CR com 20 dias para vencer é crítico; uma certidão de 30 dias com 20
 * dias para vencer é rotina. A faixa tem que respeitar o ciclo de cada um.
 */
export const PRAZO_CRITICO_DIAS = 10;
export const PRAZO_ATENCAO_DIAS = 30;
export const CICLO_CURTO_CRITICO_DIAS = 4;
export const CICLO_CURTO_ATENCAO_DIAS = 9;
/** Teto de validade nominal (em dias) para um tipo ser tratado como ciclo curto. */
export const CICLO_CURTO_VALIDADE_MAX_DIAS = 31;

/**
 * O tipo é de CICLO CURTO (vive ~30 dias)?
 *
 * Só entram aqui os documentos que a regra de negócio renova todo mês:
 * comprovante de endereço e as certidões de antecedentes SEM os 90 dias
 * oficiais (TRF/Seção Judiciária/JEF, STM e TJM continuam com 90).
 * Quando o catálogo do banco (`qa_validade_documentos`) tem o tipo, é ele
 * quem decide — regra local é só fallback.
 */
export function isVencimentoCicloCurto(tipo?: string | null): boolean {
  const t = String(tipo ?? "").trim().toLowerCase();
  if (!t) return false;
  if (isTipoSemVencimento(t)) return false;
  const curtoPorNatureza = isComprovanteEndereco(t) || t.startsWith("antecedentes_");
  if (!curtoPorNatureza) return false;
  const regra = getRegraValidade(t);
  if (regra) {
    if (regra.perpetuo || regra.validade_dias <= 0) return false;
    const dias = regra.unidade === "meses" ? regra.validade_dias * 30 : regra.validade_dias;
    return dias <= CICLO_CURTO_VALIDADE_MAX_DIAS;
  }
  return !isCertidao90Dias(t);
}

export type FaixaVencimento = "bad" | "warn" | "ok";

/**
 * Faixa de alerta de um documento a partir dos dias restantes e do tipo.
 * Retorna null quando não há prazo conhecido (o chamador decide o "neutro").
 */
export function faixaVencimento(
  dias: number | null | undefined,
  tipo?: string | null,
): FaixaVencimento | null {
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
 * Dia em que o documento começa a alertar (primeiro dia amarelo).
 * Ciclo curto: 9 dias. Demais: 30 dias.
 */
export function inicioAlertaDias(tipo?: string | null): number {
  return isVencimentoCicloCurto(tipo) ? CICLO_CURTO_ATENCAO_DIAS : PRAZO_ATENCAO_DIAS;
}

/**
 * Janela de alerta antecipado (status "vence_em_breve") por tipo.
 * Padrão: 7 dias. Procuração: 90 dias — a renovação exige nova assinatura
 * Gov.br do cliente, então os avisos começam com 90 dias de antecedência
 * (90 → 45 → 30 → 15 → 7 → hoje → vencida). Ciclo curto: 9 dias, o mesmo dia
 * em que a faixa vira amarela — chip e cor têm que contar a mesma história.
 */
export function limiarAlertaDias(tipo?: string | null): number {
  const regra = getRegraValidade(tipo);
  if (regra && regra.alerta_dias > 0) return regra.alerta_dias;
  if (isProcuracao(tipo)) return 90;
  if (isVencimentoCicloCurto(tipo)) return CICLO_CURTO_ATENCAO_DIAS;
  // NÃO estender aqui as janelas de CR (180d) e laudos (120d): este limiar
  // pinta o chip "vence em breve" no Hub e deixaria quase todo laudo amarelo.
  // Essas janelas vivem no motor de avisos (badge da home + e-mails):
  // src/lib/quero-armas/avisosVencimento.ts.
  return 7;
}

export function calcularValidadeEfetiva(
  tipo: string | null | undefined,
  dataEmissao: string | null | undefined,
): string | null {
  const emi = parseISODate(dataEmissao);
  if (!emi) return null;
  // Comprovante de pagamento do contrato nunca vence — precede o catálogo.
  if (isComprovantePagamentoContrato(tipo)) return null;
  // Documentos sem vencimento POR NATUREZA precedem o catálogo do banco:
  // uma linha errada em `qa_validade_documentos` (ex.: CCMEI com 30 dias)
  // não pode reintroduzir prazo em nota fiscal, CCMEI, contrato social,
  // requerimento de empresário ou carteira funcional.
  if (isNotaFiscalSemVencimento(tipo)) return null;
  if (isDocumentoConstitutivoPerpetuo(tipo)) return null;
  if (isIdentidadeFuncionalPerpetua(tipo)) return null;
  // 1º) Catálogo do banco (fonte única). Só cai nas regras locais quando o
  //     tipo não está cadastrado ou o catálogo ainda não carregou.
  const regra = getRegraValidade(tipo);
  if (regra) {
    if (regra.perpetuo || regra.validade_dias <= 0) return null;
    if (regra.unidade === "meses") return toISO(addCalendarMonths(emi, regra.validade_dias));
    const v = new Date(emi.getTime());
    v.setUTCDate(v.getUTCDate() + regra.validade_dias);
    return toISO(v);
  }
  if (isCertidao90Dias(tipo)) {
    const v = new Date(emi.getTime());
    v.setUTCDate(v.getUTCDate() + 90);
    return toISO(v);
  }
  if (isFiliacaoClube(tipo)) {
    // Anuidade: 12 meses a partir da emissão.
    return toISO(addCalendarMonths(emi, 12));
  }
  if (isDocumentoIdentificacao10Anos(tipo)) {
    return toISO(addCalendarMonths(emi, 120));
  }
  if (isProcuracao(tipo)) {
    // Procuração: 12 meses a partir da emissão (padrão parametrizável).
    return toISO(addCalendarMonths(emi, 12));
  }
  // Documentos de empresa (cartão CNPJ, CCMEI, QSA): 30 dias da emissão.
  // O órgão exige documento recente da Receita Federal. O QSA herda a data de
  // emissão do cartão CNPJ quando não traz data própria — a resolução dessa
  // herança acontece em quem grava (Central de Adesão / Hub), aqui só
  // aplicamos o prazo sobre a data que chegou.
  if (isDocumentoEmpresa30Dias(tipo)) {
    const v = new Date(emi.getTime());
    v.setUTCDate(v.getUTCDate() + 30);
    return toISO(v);
  }
  // Comprovante de residência: vale até o dia da PRÓXIMA LEITURA impressa na
  // conta — até lá o cliente não terá outro comprovante. Esse dia ainda conta
  // como válido; no seguinte, está vencido.
  // O + 1 mês abaixo é só aproximação para quando a próxima leitura não foi
  // lida do documento; quem tiver a data real deve gravá-la em data_validade.
  const tipoStr = String(tipo || "").toLowerCase();
  const isRes =
    tipoStr.startsWith("comprovante_residencia") ||
    tipoStr.startsWith("comprovante_endereco") ||
    tipoStr === "comprovante_de_residencia" ||
    tipoStr === "comprovante_de_endereco";
  if (isRes) return toISO(addCalendarMonths(emi, 1));
  // Demais documentos (CR, CRAF, GTE, etc.) NÃO devem ter validade inferida
  // a partir da emissão — cada um tem prazo próprio que já vem gravado em
  // `data_validade` pelo extractor/admin. Retornar null aqui força o
  // `getValidadeInfo` a usar o backend como fonte.
  return null;
}

/**
 * Retorna o pacote completo de validade para a UI.
 */
export function getValidadeInfo(doc: DocValidadeInput, hoje: Date = new Date()): ValidadeInfo {
  // 0-) Validade explicitamente INDETERMINADA no próprio documento:
  //     não conta prazo, nunca vence, nunca reprova.
  if (docTemValidadeIndeterminada(doc)) {
    return {
      iso: null,
      label: "Sem vencimento (validade indeterminada)",
      dias: null,
      status: "indefinido",
      origem: "indefinido",
      semVencimento: true,
    };
  }

  // 0a) Certidão civil (nascimento/casamento/averbação) NÃO tem vencimento
  //     para este fluxo. Curto-circuito antes de qualquer cálculo de prazo.
  if (isCertidaoCivilSemVencimento(doc.tipo_documento)) {
    return {
      iso: null,
      label: "Sem vencimento",
      dias: null,
      status: "indefinido",
      origem: "indefinido",
      semVencimento: true,
    };
  }

  // 0b) Nota fiscal: validade perpétua (Ocupação Lícita). Ignora qualquer
  //     data_validade legada gravada no backend.
  if (isNotaFiscalSemVencimento(doc.tipo_documento)) {
    return {
      iso: null,
      label: "Sem vencimento",
      dias: null,
      status: "indefinido",
      origem: "indefinido",
      semVencimento: true,
    };
  }

  // 0c) Catálogo do banco marca o tipo como perpétuo → nunca vence.
  const regraCatalogo = getRegraValidade(doc.tipo_documento);
  if (regraCatalogo && (regraCatalogo.perpetuo || regraCatalogo.validade_dias <= 0)) {
    return {
      iso: null,
      label: "Sem vencimento",
      dias: null,
      status: "indefinido",
      origem: "indefinido",
      semVencimento: true,
    };
  }

  // 0d) Identidade/carteira funcional (Fé Pública, PM/PC/Bombeiros) e
  //     documentos constitutivos: validade INDETERMINADA por natureza.
  //     Guarda local — vale mesmo quando o catálogo do banco não carregou.
  if (
    isIdentidadeFuncionalPerpetua(doc.tipo_documento) ||
    isDocumentoConstitutivoPerpetuo(doc.tipo_documento) ||
    isComprovantePagamentoContrato(doc.tipo_documento) ||
    textoIndicaValidadeIndeterminada((doc as any)?.nome_documento)
  ) {
    return {
      iso: null,
      label: "Sem vencimento",
      dias: null,
      status: "indefinido",
      origem: "indefinido",
      semVencimento: true,
    };
  }

  // 0) Comprovante de residência HISTÓRICO → não vence.
  //    Distinção sem coluna nova: usa regra_validacao.ano_competencia / ano_competencia
  //    contra o ano corrente. Canônico sem ano = corrente.
  if (isResidenciaDoc(doc)) {
    const ano = pickAnoCompetencia(doc);
    const anoAtual = hoje.getUTCFullYear();
    const isCorrente = ano == null || ano >= anoAtual;
    if (!isCorrente) {
      return {
        iso: null,
        label: ano ? `Competência ${ano}` : "Documento histórico",
        dias: null,
        status: "historico",
        origem: "historico",
        semVencimento: true,
      };
    }
  }

  // 1) Precedência máxima: validade DECLARADA no próprio documento.
  let iso = getValidadeDeclarada(doc);
  let origem: ValidadeInfo["origem"] = iso ? "backend" : "indefinido";

  // 1a) Sem validade declarada → prazo do catálogo do banco (fonte única),
  //     calculado sobre a data de emissão.
  if (!iso) {
    iso = calcularValidadeEfetiva(doc.tipo_documento, doc.data_emissao || getDataEmissaoDocumentoHub(doc));
    origem = iso ? "regra_negocio" : "indefinido";
  }

  // 2) Fallback: valor já gravado pelo backend.
  if (!iso) {
    const candidato = doc.data_validade_efetiva || doc.data_validade || null;
    if (candidato) {
      const parsed = parseISODate(candidato);
      if (parsed) {
        iso = toISO(parsed);
        origem = "backend";
      }
    }
  }

  // 3) Último recurso: documento sem validade declarada e sem regra no
  //    catálogo → prazo padrão de 30 dias sobre a emissão.
  if (!iso) {
    const emi = parseISODate(doc.data_emissao || getDataEmissaoDocumentoHub(doc) || null);
    if (emi) {
      const v = new Date(emi.getTime());
      v.setUTCDate(v.getUTCDate() + 30);
      iso = toISO(v);
      origem = "regra_negocio";
    }
  }

  if (!iso) {
    return { iso: null, label: null, dias: null, status: "indefinido", origem: "indefinido" };
  }

  const venc = parseISODate(iso)!;
  // Fuso canônico America/Sao_Paulo — nunca UTC (virava o dia às 21h BRT).
  const dias = Math.round((venc.getTime() - hojeBRT(hoje)) / 86400000);
  const limiar = limiarAlertaDias(doc.tipo_documento);
  const status: ValidadeStatus =
    dias < 0 ? "vencido" : dias <= limiar ? "vence_em_breve" : "vigente";
  return { iso, label: formatBR(iso), dias, status, origem };
}
