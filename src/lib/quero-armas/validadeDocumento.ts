/**
 * BLOCO 5 — Validade efetiva de documentos (camada ADITIVA).
 *
 * Não substitui a edge `qa-extract-doc-dates` nem o validador congelado
 * `qa-processo-doc-validar-ia`. Apenas calcula, no momento de exibir, a
 * regra de negócio oficial da Quero Armas:
 *
 *  - Comprovante de residência → vale da emissão de uma conta até a
 *    emissão da próxima (ciclo mensal ≈ emissão + 30 dias). Anos
 *    anteriores continuam tratados como HISTÓRICOS (não vencem).
 *  - Demais documentos → emissão + 30 dias (ignora qualquer "90 dias" que
 *    o documento eventualmente afirme).
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
  /** Sobrescreve o prazo padrão de negócio para este documento, se informado. */
  validade_dias?: number | null;
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

/**
 * Certidões negativas / antecedentes (federal — inclusive abrangência
 * regional —, estadual, militar, eleitoral/TSE, distribuidor cível ou
 * criminal, nada consta) valem 90 dias da data de emissão. Enquanto
 * estiverem vigentes devem ser reaproveitadas por qualquer processo que
 * as exija — nunca pedidas novamente.
 */
export function isCertidao90Dias(tipo?: string | null): boolean {
  if (!tipo) return false;
  const t = String(tipo).toLowerCase();
  if (isCertidaoCivilSemVencimento(t)) return false;
  if (t.startsWith("antecedentes")) return true; // criminais, federal, estadual, militar, eleitoral
  if (t.startsWith("nada_consta")) return true;
  if (t.startsWith("certidao_")) return true;    // criminal, distribuidor, tse, etc.
  return false;
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

/**
 * Calcula a data de validade efetiva conforme regra de negócio.
 * Retorna null se não houver `data_emissao` (não recalcula).
 */
export function calcularValidadeEfetiva(
  tipo: string | null | undefined,
  dataEmissao: string | null | undefined,
  validadeDiasOverride?: number | null,
): string | null {
  const emi = parseISODate(dataEmissao);
  if (!emi) return null;
  // Prazo por tipo:
  //  - Certidões negativas / antecedentes (federal — inclusive abrangência
  //    regional —, estadual, militar, eleitoral/TSE, distribuidor, nada
  //    consta) → 90 dias.
  //  - Comprovante de residência → 30 dias (ciclo mensal).
  //  - Demais → 30 dias.
  // Override explícito (regra_validacao.validade_dias) vence tudo.
  let dias = 30;
  if (Number.isFinite(validadeDiasOverride as number) && (validadeDiasOverride as number) > 0) {
    dias = Number(validadeDiasOverride);
  } else if (isCertidao90Dias(tipo)) {
    dias = 90;
  }
  const v = new Date(emi.getTime());
  v.setUTCDate(v.getUTCDate() + dias);
  return toISO(v);
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

  // 1) Preferência: recálculo a partir de data_emissao (regra oficial).
  const override =
    (doc.regra_validacao && typeof doc.regra_validacao === "object"
      ? Number(doc.regra_validacao.validade_dias)
      : null) ||
    (Number.isFinite(doc.validade_dias as number) ? Number(doc.validade_dias) : null);
  let iso = calcularValidadeEfetiva(doc.tipo_documento, doc.data_emissao, override);
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