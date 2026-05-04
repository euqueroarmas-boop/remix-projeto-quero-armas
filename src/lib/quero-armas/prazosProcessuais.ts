/**
 * Engine única de prazos processuais administrativos (Lei 9.784/99 art. 59 +
 * Decreto 9.847/19 art. 10). Toda tela que exibe prazo de 10 dias DEVE usar
 * estes helpers para evitar divergência entre Dashboard, KPIs do cliente,
 * Arsenal, "Próximos vencimentos" e a aba Serviços.
 *
 * Eventos que abrem prazo administrativo:
 *   - data_notificacao             → NOTIFICAÇÃO da PF       (10 dias · Lei 9.784/99)
 *   - data_indeferimento           → INDEFERIMENTO           (10 dias · Lei 9.784/99)
 *   - data_restituicao             → RESTITUIÇÃO             (10 dias · Lei 9.784/99)
 *   - data_indeferimento_recurso   → MANDADO DE SEGURANÇA    (120 dias · art. 23 Lei 12.016/09)
 *
 * Regra de prioridade: se houver `data_indeferimento_recurso`, ela SOBREPÕE
 * qualquer outro evento (já se esgotou a via administrativa, agora corre o
 * prazo decadencial do MS). Caso contrário, vence a data MAIS RECENTE.
 */

export type EventoPrazo =
  | "NOTIFICAÇÃO"
  | "INDEFERIMENTO"
  | "RESTITUIÇÃO"
  | "MANDADO DE SEGURANÇA";

export interface PrazoProcessual {
  itemId: number | string;
  servicoId: number | null;
  servicoNome: string | null;
  evento: EventoPrazo;
  dataEvento: string;          // ISO YYYY-MM-DD
  dataLimite: string;          // ISO YYYY-MM-DD
  diasRestantes: number;       // negativo = vencido
  status: "vencido" | "vence_hoje" | "critico" | "atencao" | "em_prazo";
  statusLabel: string;
  numeroProcesso: string | null;
  itemStatus: string | null;
  /** Quantos dias o prazo total tem (10 ou 120). Útil para UI/labels. */
  prazoTotalDias: number;
}

const PRAZO_DIAS_PADRAO = 10;
const PRAZO_DIAS_MS = 120;

function todayISOLocal(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function diffDaysISO(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86_400_000);
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Converte DD/MM/YYYY ou ISO para ISO YYYY-MM-DD. Retorna null se inválido. */
export function normalizeDateISO(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function statusFor(dias: number): { status: PrazoProcessual["status"]; label: string } {
  if (dias < 0) return { status: "vencido", label: `VENCIDO HÁ ${Math.abs(dias)}D` };
  if (dias === 0) return { status: "vence_hoje", label: "VENCE HOJE" };
  if (dias <= 2) return { status: "critico", label: `CRÍTICO · ${dias}D` };
  if (dias <= 5) return { status: "atencao", label: `ATENÇÃO · ${dias}D` };
  return { status: "em_prazo", label: `EM PRAZO · ${dias}D` };
}

export interface ItemComPrazo {
  id: number | string;
  servico_id?: number | null;
  servico_nome?: string | null;
  status?: string | null;
  numero_processo?: string | null;
  data_notificacao?: string | null;
  data_indeferimento?: string | null;
  /** Opcional: alguns serviços usam restituição como evento de 10 dias. */
  data_restituicao?: string | null;
  /** Opcional — se preenchida e for posterior à notificação/indeferimento,
   * o recurso já foi protocolado e o prazo de 10 dias não corre mais. */
  data_recurso_administrativo?: string | null;
  /** Indeferimento do recurso administrativo. Inicia IMEDIATAMENTE o prazo
   *  decadencial de 120 dias para impetração de Mandado de Segurança. */
  data_indeferimento_recurso?: string | null;
}

/** Extrai (no máximo) UM prazo ativo por item, baseado na data de evento mais recente. */
export function extrairPrazoDoItem(item: ItemComPrazo): PrazoProcessual | null {
  const dNotif = normalizeDateISO(item.data_notificacao);
  const dIndef = normalizeDateISO(item.data_indeferimento);
  const dRest = normalizeDateISO(item.data_restituicao);
  const dIndefRec = normalizeDateISO(item.data_indeferimento_recurso);

  // Status finais cancelam o prazo (já não corre): deferido, concluído,
  // cancelado, desistiu. Indeferido/notificado/em análise mantêm o prazo
  // visível conforme regra de negócio.
  const statusUpper = (item.status || "").toString().toUpperCase();
  const FINALIZADOS = ["DEFERIDO", "CONCLUÍDO", "CONCLUIDO", "CANCELADO", "DESISTIU"];
  if (FINALIZADOS.includes(statusUpper)) return null;

  // PRIORIDADE 1: Indeferimento do recurso administrativo → MS 120 dias.
  // Sobrepõe qualquer prazo de 10 dias da PF (esgotada a via administrativa).
  let ativo: { data: string; evento: EventoPrazo } | null = null;
  let prazoTotal = PRAZO_DIAS_PADRAO;
  if (dIndefRec) {
    ativo = { data: dIndefRec, evento: "MANDADO DE SEGURANÇA" };
    prazoTotal = PRAZO_DIAS_MS;
  } else {
    const candidatos: { data: string; evento: EventoPrazo }[] = [];
    if (dNotif) candidatos.push({ data: dNotif, evento: "NOTIFICAÇÃO" });
    if (dIndef) candidatos.push({ data: dIndef, evento: "INDEFERIMENTO" });
    if (dRest) candidatos.push({ data: dRest, evento: "RESTITUIÇÃO" });
    if (candidatos.length === 0) return null;
    candidatos.sort((a, b) => (a.data < b.data ? 1 : -1));
    ativo = candidatos[0];
  }

  const dataLimite = addDaysISO(ativo.data, prazoTotal);
  const diasRestantes = diffDaysISO(todayISOLocal(), dataLimite);
  const { status, label } = statusFor(diasRestantes);

  return {
    itemId: item.id,
    servicoId: item.servico_id ?? null,
    servicoNome: item.servico_nome ?? null,
    evento: ativo.evento,
    dataEvento: ativo.data,
    dataLimite,
    diasRestantes,
    status,
    statusLabel: label,
    numeroProcesso: item.numero_processo ?? null,
    itemStatus: item.status ?? null,
    prazoTotalDias: prazoTotal,
  };
}

/** Aplica `extrairPrazoDoItem` em vários itens e ordena do mais urgente ao menos. */
export function calcularPrazosProcessuais(itens: ItemComPrazo[]): PrazoProcessual[] {
  const out: PrazoProcessual[] = [];
  for (const it of itens) {
    const p = extrairPrazoDoItem(it);
    if (p) out.push(p);
  }
  out.sort((a, b) => a.diasRestantes - b.diasRestantes);
  return out;
}

export function corPrazo(status: PrazoProcessual["status"]): {
  bg: string; text: string; border: string; dot: string;
} {
  switch (status) {
    case "vencido":
      return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", dot: "bg-rose-600" };
    case "vence_hoje":
      return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", dot: "bg-rose-600" };
    case "critico":
      return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-600" };
    case "atencao":
      return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" };
    default:
      return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" };
  }
}