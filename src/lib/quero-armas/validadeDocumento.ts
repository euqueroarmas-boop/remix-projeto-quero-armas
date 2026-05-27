/**
 * BLOCO 5 — Validade efetiva de documentos (camada ADITIVA).
 *
 * Não substitui a edge `qa-extract-doc-dates` nem o validador congelado
 * `qa-processo-doc-validar-ia`. Apenas calcula, no momento de exibir, a
 * regra de negócio oficial da Quero Armas:
 *
 *  - Comprovante de residência → vale até o fim do mês SEGUINTE ao da
 *    emissão (ex.: emitido em qualquer dia de março → válido até 30/abr).
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
}

export type ValidadeStatus = "vigente" | "vence_em_breve" | "vencido" | "indefinido";

export interface ValidadeInfo {
  /** ISO yyyy-mm-dd da data de validade efetiva calculada. Null se desconhecida. */
  iso: string | null;
  /** "DD/MM/AAAA" formatada para UI. Null se desconhecida. */
  label: string | null;
  /** Dias até vencer (negativo = vencido). Null se desconhecida. */
  dias: number | null;
  status: ValidadeStatus;
  /** Origem da data: recálculo de negócio, valor do backend, ou desconhecido. */
  origem: "regra_negocio" | "backend" | "indefinido";
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

/**
 * Calcula a data de validade efetiva conforme regra de negócio.
 * Retorna null se não houver `data_emissao` (não recalcula).
 */
export function calcularValidadeEfetiva(
  tipo: string | null | undefined,
  dataEmissao: string | null | undefined,
): string | null {
  const emi = parseISODate(dataEmissao);
  if (!emi) return null;
  if (isComprovanteEndereco(tipo)) {
    // fim do mês SEGUINTE ao da emissão
    const fim = ultimoDiaDoMes(emi.getUTCFullYear(), emi.getUTCMonth() + 1);
    return toISO(fim);
  }
  // emissão + 30 dias
  const v = new Date(emi.getTime());
  v.setUTCDate(v.getUTCDate() + 30);
  return toISO(v);
}

/**
 * Retorna o pacote completo de validade para a UI.
 */
export function getValidadeInfo(doc: DocValidadeInput, hoje: Date = new Date()): ValidadeInfo {
  // 1) Preferência: recálculo a partir de data_emissao (regra oficial).
  let iso = calcularValidadeEfetiva(doc.tipo_documento, doc.data_emissao);
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