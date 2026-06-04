/**
 * Cálculo de SLA para clientes novos (cadastros públicos pagos).
 *
 * Regras (definidas pelo cliente):
 *   - Faixa NO PRAZO:        1–10 dias úteis decorridos
 *   - Faixa ALERTA:          11–19 dias
 *   - Faixa QUASE ATRASADO:  20–25 dias
 *   - Faixa ATRASADO:        26+ dias
 *
 * Lógica de PAUSA (quando aguardando documentos do cliente):
 *   - Após 1 dia sem retorno do cliente, o relógio congela.
 *   - Quando o documento é recebido, o relógio retoma de onde parou.
 *   - Implementação: armazenamos `aguardando_cliente_desde` e `dias_pausados`.
 *   - Dias decorridos efetivos = (hoje − pago_em) − dias_pausados − pausa_em_andamento.
 */

export type SlaStatus = "no_prazo" | "alerta" | "quase_atrasado" | "atrasado" | "concluido" | "pausado";

export interface SlaInput {
  pago_em?: string | null;
  aguardando_cliente_desde?: string | null;
  dias_pausados?: number | null;
  sla_concluido_em?: string | null;
}

export interface SlaResult {
  status: SlaStatus;
  diasEfetivos: number;          // dias contados (descontando pausas)
  diasCorridos: number;          // dias brutos desde o pago
  diasPausados: number;          // total acumulado de pausa
  pausaEmAndamento: number;      // dias de pausa atual (aguardando cliente)
  estaPausado: boolean;
  label: string;
  cor: string;                   // hex para badges
  bg: string;                    // bg suave
}

const DIA_MS = 24 * 60 * 60 * 1000;

function diffDays(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DIA_MS));
}

export function calcularSla(input: SlaInput, now: Date = new Date()): SlaResult | null {
  if (!input.pago_em) return null;

  const pagoEm = new Date(input.pago_em);
  if (isNaN(pagoEm.getTime())) return null;

  const diasCorridos = diffDays(pagoEm, now);
  const diasPausadosAcumulados = Math.max(0, input.dias_pausados ?? 0);

  // Pausa em andamento: só conta após 1 dia sem retorno
  let pausaEmAndamento = 0;
  let estaPausado = false;
  if (input.aguardando_cliente_desde) {
    const desde = new Date(input.aguardando_cliente_desde);
    if (!isNaN(desde.getTime())) {
      const diasAguardando = diffDays(desde, now);
      if (diasAguardando > 1) {
        pausaEmAndamento = diasAguardando - 1; // descontamos o "dia de tolerância"
        estaPausado = true;
      }
    }
  }

  const diasEfetivos = Math.max(
    0,
    diasCorridos - diasPausadosAcumulados - pausaEmAndamento
  );

  if (input.sla_concluido_em) {
    return {
      status: "concluido",
      diasEfetivos,
      diasCorridos,
      diasPausados: diasPausadosAcumulados + pausaEmAndamento,
      pausaEmAndamento,
      estaPausado: false,
      label: "CONCLUÍDO",
      cor: "#16a34a",
      bg: "#f0fdf4",
    };
  }

  if (estaPausado) {
    return {
      status: "pausado",
      diasEfetivos,
      diasCorridos,
      diasPausados: diasPausadosAcumulados + pausaEmAndamento,
      pausaEmAndamento,
      estaPausado: true,
      label: `PAUSADO · ${diasEfetivos}d`,
      cor: "#6366f1",
      bg: "#eef2ff",
    };
  }

  if (diasEfetivos <= 10) {
    return {
      status: "no_prazo",
      diasEfetivos, diasCorridos,
      diasPausados: diasPausadosAcumulados,
      pausaEmAndamento: 0,
      estaPausado: false,
      label: `${diasEfetivos}d · NO PRAZO`,
      cor: "#16a34a", bg: "#f0fdf4",
    };
  }
  if (diasEfetivos <= 19) {
    return {
      status: "alerta",
      diasEfetivos, diasCorridos,
      diasPausados: diasPausadosAcumulados,
      pausaEmAndamento: 0,
      estaPausado: false,
      label: `${diasEfetivos}d · ALERTA`,
      cor: "#ca8a04", bg: "#fefce8",
    };
  }
  if (diasEfetivos <= 25) {
    return {
      status: "quase_atrasado",
      diasEfetivos, diasCorridos,
      diasPausados: diasPausadosAcumulados,
      pausaEmAndamento: 0,
      estaPausado: false,
      label: `${diasEfetivos}d · QUASE ATRASADO`,
      cor: "#ea580c", bg: "#fff7ed",
    };
  }
  return {
    status: "atrasado",
    diasEfetivos, diasCorridos,
    diasPausados: diasPausadosAcumulados,
    pausaEmAndamento: 0,
    estaPausado: false,
    label: `${diasEfetivos}d · ATRASADO`,
    cor: "#dc2626", bg: "#fef2f2",
  };
}

export const SLA_PRIORIDADE: Record<SlaStatus, number> = {
  atrasado: 0,
  quase_atrasado: 1,
  alerta: 2,
  pausado: 3,
  no_prazo: 4,
  concluido: 5,
};