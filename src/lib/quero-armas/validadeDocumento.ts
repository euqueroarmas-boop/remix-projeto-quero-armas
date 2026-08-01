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

export interface DocValidadeInput {
  tipo_documento?: string | null;
  data_emissao?: string | null;
  data_validade_efetiva?: string | null;
  data_validade?: string | null;
  ano_competencia?: number | string | null;
  regra_validacao?: any;
}

export type ValidadeStatus = "vigente" | "vence_em_breve" | "vencido" | "indefinido" | "historico";

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
  const t = String(tipo ?? "").toLowerCase();
  return [
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
  ].includes(t);
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
 * Documentos societários emitidos pela Receita Federal: cartão CNPJ, CCMEI e
 * QSA. Valem 30 dias da emissão — o órgão exige extrato recente.
 * O QSA é emitido junto com o cartão CNPJ e acompanha a data dele.
 */
export function isDocumentoEmpresa30Dias(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return (
    t === "renda_cartao_cnpj" ||
    t === "renda_cnpj_autonomo" ||
    t === "renda_ccmei" ||
    t === "renda_qsa" ||
    t === "cartao_cnpj_mei" // alias legado
  );
}

/**
 * Janela de alerta antecipado (status "vence_em_breve") por tipo.
 * Padrão: 7 dias. Procuração: 90 dias — a renovação exige nova assinatura
 * Gov.br do cliente, então os avisos começam com 90 dias de antecedência
 * (90 → 45 → 30 → 15 → 7 → hoje → vencida).
 */
export function limiarAlertaDias(tipo?: string | null): number {
  if (isProcuracao(tipo)) return 90;
  return 7;
}

export function calcularValidadeEfetiva(
  tipo: string | null | undefined,
  dataEmissao: string | null | undefined,
): string | null {
  const emi = parseISODate(dataEmissao);
  if (!emi) return null;
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

  // 1) Preferência: recálculo a partir da data de emissão/referência (regra oficial).
  let iso = calcularValidadeEfetiva(doc.tipo_documento, doc.data_emissao || getDataEmissaoDocumentoHub(doc));
  let origem: ValidadeInfo["origem"] = iso ? "regra_negocio" : "indefinido";

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

  if (!iso) {
    return { iso: null, label: null, dias: null, status: "indefinido", origem: "indefinido" };
  }

  const venc = parseISODate(iso)!;
  const hojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const dias = Math.round((venc.getTime() - hojeUTC) / 86400000);
  const status: ValidadeStatus =
    dias < 0 ? "vencido" : dias <= 7 ? "vence_em_breve" : "vigente";
  return { iso, label: formatBR(iso), dias, status, origem };
}
