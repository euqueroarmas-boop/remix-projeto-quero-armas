/**
 * Motor de Prazos Processuais (PF: Posse, Porte, CRAF)
 * --------------------------------------------------------------------
 * Regras:
 *  - Eventos que abrem prazo de 10 dias para Recurso Administrativo:
 *      data_notificacao | data_indeferimento | data_restituicao
 *    Base legal: Lei 9.784/99 art. 59 + Decreto 9.847/19 art. 10.
 *
 *  - Se `data_recurso_administrativo` for igual ou posterior ao último
 *    evento que abriu o prazo, o prazo é considerado CUMPRIDO.
 *    Nesse caso, não há alerta de "prazo para recurso".
 *
 *  - Se existir evento POSTERIOR ao recurso, abre novo prazo de 10 dias.
 *
 *  - Se existir `data_indeferimento_recurso`, abre prazo de 10 dias para
 *    Mandado de Segurança, independentemente do recurso já protocolado.
 *
 * Todas as datas devem estar no formato ISO (YYYY-MM-DD).
 * Cálculos são feitos em UTC puro (sem efeito de timezone).
 */

export type PrazoTipo = "recurso_administrativo" | "mandado_seguranca";

export interface PrazoInput {
  data_notificacao?: string | null;
  data_indeferimento?: string | null;
  data_restituicao?: string | null;
  data_recurso_administrativo?: string | null;
  data_indeferimento_recurso?: string | null;
  /** ISO YYYY-MM-DD. Default: hoje (fuso local). */
  today?: string;
}

export interface PrazoCalculo {
  tipo: PrazoTipo;
  /** Data do evento que abriu o prazo (ISO). */
  eventoBase: string;
  /** Data fatal (evento + 10 dias) em ISO. */
  dataLimite: string;
  /** Dias restantes até a data fatal. Negativo se expirado. */
  diasRestantes: number;
  /** True se já passou da data fatal. */
  expirado: boolean;
}

const PRAZO_DIAS = 10;

export function todayISO(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidISO(v: string | null | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aUTC = Date.UTC(ay, am - 1, ad);
  const bUTC = Date.UTC(by, bm - 1, bd);
  return Math.round((bUTC - aUTC) / 86_400_000);
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Retorna o evento mais recente (ISO) entre notificação/indeferimento/restituição, ou null. */
export function ultimoEventoAbertura(input: PrazoInput): string | null {
  const candidatos = [input.data_notificacao, input.data_indeferimento, input.data_restituicao]
    .filter(isValidISO);
  if (!candidatos.length) return null;
  return candidatos.reduce((max, cur) => (cur > max ? cur : max));
}

/**
 * Calcula o prazo processual ATIVO, se houver.
 * Retorna null quando não há prazo aberto (ex.: recurso já protocolado e nenhum
 * evento posterior, ou nenhum evento de abertura registrado).
 */
export function calcularPrazoProcessual(input: PrazoInput): PrazoCalculo | null {
  const today = isValidISO(input.today) ? input.today : todayISO();

  // 1) Indeferimento do recurso => abre prazo de Mandado de Segurança (sempre prevalece).
  if (isValidISO(input.data_indeferimento_recurso)) {
    const base = input.data_indeferimento_recurso;
    const limite = addDaysISO(base, PRAZO_DIAS);
    const restantes = diffDays(today, limite);
    return {
      tipo: "mandado_seguranca",
      eventoBase: base,
      dataLimite: limite,
      diasRestantes: restantes,
      expirado: restantes < 0,
    };
  }

  // 2) Sem evento de abertura → sem prazo.
  const evento = ultimoEventoAbertura(input);
  if (!evento) return null;

  // 3) Recurso já protocolado em data igual/posterior ao evento => prazo cumprido.
  const recurso = isValidISO(input.data_recurso_administrativo) ? input.data_recurso_administrativo : null;
  if (recurso && recurso >= evento) {
    return null;
  }

  // 4) Prazo de 10 dias para recurso administrativo a partir do evento.
  const limite = addDaysISO(evento, PRAZO_DIAS);
  const restantes = diffDays(today, limite);
  return {
    tipo: "recurso_administrativo",
    eventoBase: evento,
    dataLimite: limite,
    diasRestantes: restantes,
    expirado: restantes < 0,
  };
}

/**
 * True quando o item NÃO deve disparar alerta crítico/vermelho de prazo de recurso.
 * Usado para suprimir cards no dashboard quando o recurso já foi protocolado.
 */
export function prazoRecursoCumprido(input: PrazoInput): boolean {
  const prazo = calcularPrazoProcessual(input);
  if (!prazo) return true;
  return false;
}