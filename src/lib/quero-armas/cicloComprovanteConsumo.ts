/* =============================================================================
 * cicloComprovanteConsumo.ts — validade e mês exigido de conta de consumo
 * -----------------------------------------------------------------------------
 * Regra canônica (global, todos os clientes do Arsenal):
 *
 * 1. VALIDADE do comprovante não sai da emissão da NF-e. Sai, nesta ordem:
 *      data_proxima_leitura → data_vencimento → emissão + 30 dias.
 *    A próxima leitura é o limite real do ciclo: depois dela já existe conta nova.
 *
 * 2. Quando o comprovante está vencido, NÃO se especula ("existe uma emissão
 *    mais recente"). Afirma-se qual mês de referência deve ser enviado, com
 *    base no DIA DA LEITURA (D) e na data de hoje (T):
 *      dia(T) >= D  → mês seguinte ao mês de T
 *      dia(T) <  D  → mês de T
 *    D vem da próxima leitura; sem ela, do vencimento; sem ele, da emissão.
 *
 * 3. Borda de fim de mês: D=29/30/31 é limitado ao último dia do mês corrente,
 *    senão a condição `dia(T) >= D` nunca seria satisfeita em fevereiro.
 * ============================================================================= */

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIso(v?: string | null): Date | null {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface DatasComprovanteConsumo {
  data_proxima_leitura?: string | null;
  data_vencimento?: string | null;
  data_emissao?: string | null;
}

/** Validade do comprovante de consumo. Vazio quando não há data alguma. */
export function validadeComprovanteConsumo(d: DatasComprovanteConsumo): string {
  const prox = parseIso(d.data_proxima_leitura);
  if (prox) return iso(prox);
  const venc = parseIso(d.data_vencimento);
  if (venc) return iso(venc);
  const emi = parseIso(d.data_emissao);
  if (!emi) return "";
  emi.setUTCDate(emi.getUTCDate() + 30);
  return iso(emi);
}

/** Dia da leitura (D) usado para decidir o mês exigido. */
export function diaLeituraComprovante(d: DatasComprovanteConsumo): number | null {
  const base =
    parseIso(d.data_proxima_leitura) || parseIso(d.data_vencimento) || parseIso(d.data_emissao);
  return base ? base.getUTCDate() : null;
}

export interface MesExigido {
  ano: number;
  /** 1–12 */
  mes: number;
  /** "JULHO/2026" */
  label: string;
}

/**
 * Mês de referência que o cliente já pode ter em mãos, dado o dia da leitura.
 * `hoje` é injetável apenas para teste; em produção usa a data da conexão.
 */
export function mesReferenciaExigido(diaLeitura: number, hoje: Date = new Date()): MesExigido {
  const ano = hoje.getFullYear();
  const mes0 = hoje.getMonth();
  const ultimoDiaMes = new Date(ano, mes0 + 1, 0).getDate();
  const D = Math.min(Math.max(diaLeitura, 1), ultimoDiaMes);
  const avanca = hoje.getDate() >= D ? 1 : 0;
  const alvo = new Date(ano, mes0 + avanca, 1);
  return {
    ano: alvo.getFullYear(),
    mes: alvo.getMonth() + 1,
    label: `${MESES[alvo.getMonth()]}/${alvo.getFullYear()}`,
  };
}

/**
 * Mensagem de reprovação do comprovante vencido: afirma o mês a enviar,
 * sem especular sobre existência de emissão mais recente.
 */
export function mensagemComprovanteVencido(
  d: DatasComprovanteConsumo,
  validadeIso?: string | null,
  hoje: Date = new Date(),
): string {
  const venc = parseIso(validadeIso) || parseIso(validadeComprovanteConsumo(d));
  const vencBr = venc
    ? `${String(venc.getUTCDate()).padStart(2, "0")}/${String(venc.getUTCMonth() + 1).padStart(2, "0")}/${venc.getUTCFullYear()}`
    : "";
  const dia = diaLeituraComprovante(d);
  const base = `Comprovante de endereço vencido${vencBr ? ` em ${vencBr}` : ""}.`;
  if (dia == null) return `${base} Envie a conta de consumo do mês de referência mais recente.`;
  return `${base} Envie a conta com mês de referência ${mesReferenciaExigido(dia, hoje).label}.`;
}
