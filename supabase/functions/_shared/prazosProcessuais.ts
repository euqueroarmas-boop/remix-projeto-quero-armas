/**
 * Motor único de prazos processuais — versão Deno-compatível para Edge Functions.
 *
 * IMPORTANTE: este arquivo DEVE permanecer em paridade lógica com
 * src/lib/quero-armas/prazosProcessuais.ts (mesma regra, mesmos thresholds,
 * mesma prioridade MS=120d > demais=10d). Cobertura por testes em ambos os lados.
 * Se mudar um, mude o outro.
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
  dataEvento: string;
  dataLimite: string;
  diasRestantes: number;
  status: "vencido" | "vence_hoje" | "critico" | "atencao" | "em_prazo";
  statusLabel: string;
  numeroProcesso: string | null;
  itemStatus: string | null;
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
  data_restituicao?: string | null;
  data_recurso_administrativo?: string | null;
  data_indeferimento_recurso?: string | null;
}

export function extrairPrazoDoItem(item: ItemComPrazo): PrazoProcessual | null {
  const dNotif = normalizeDateISO(item.data_notificacao);
  const dIndef = normalizeDateISO(item.data_indeferimento);
  const dRest = normalizeDateISO(item.data_restituicao);
  const dIndefRec = normalizeDateISO(item.data_indeferimento_recurso);
  const dRecurso = normalizeDateISO(item.data_recurso_administrativo);

  const statusUpper = (item.status || "").toString().toUpperCase();
  const FINALIZADOS = ["DEFERIDO", "CONCLUÍDO", "CONCLUIDO", "CANCELADO", "DESISTIU"];
  if (FINALIZADOS.includes(statusUpper)) return null;

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

    // RECURSO PROTOCOLADO FECHA O PRAZO DE 10 DIAS.
    //
    // Até 18/08/2026 esta coluna era declarada aqui, documentada como "se
    // preenchida, o prazo de 10 dias nao corre mais" — e nunca lida. O efeito
    // era o pior possível: depois de o recurso entrar na delegacia, o cron
    // continuava mandando "prazo VENCIDO há N dias" para o cliente e para a
    // equipe, todo dia, para sempre. Alarme falso no evento mais sensível do
    // fluxo, e um KPI vermelho em processo que está correto — o oposto do que
    // manda a regra-mãe.
    //
    // A comparação é `>=` de propósito: recurso protocolado no MESMO dia da
    // notificação/indeferimento já cumpre o prazo. Recurso ANTERIOR ao evento
    // ativo é de outro ciclo (o cliente recorreu, a PF notificou de novo) e
    // não fecha nada.
    //
    // O indeferimento do recurso NÃO passa por aqui: ele é PRIORIDADE 1 acima
    // e abre os 120 dias do Mandado de Segurança.
    if (dRecurso && dRecurso >= ativo.data) return null;
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

export function calcularPrazosProcessuais(itens: ItemComPrazo[]): PrazoProcessual[] {
  const out: PrazoProcessual[] = [];
  for (const it of itens) {
    const p = extrairPrazoDoItem(it);
    if (p) out.push(p);
  }
  out.sort((a, b) => a.diasRestantes - b.diasRestantes);
  return out;
}

/** Marcos discretos de notificação. Vencido (<0) → -1. */
export const MARCOS_PRAZO = [30, 15, 7, 3, 0] as const;
export function pickMarcoExato(dias: number): number | null {
  if (dias < 0) return -1;
  return (MARCOS_PRAZO as readonly number[]).includes(dias) ? dias : null;
}