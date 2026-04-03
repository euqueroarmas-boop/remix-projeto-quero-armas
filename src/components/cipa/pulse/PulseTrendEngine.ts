/**
 * CIPA Pulse — Trend Engine (Phase 2)
 * Calculates delta, acceleration, cooldown time and trend classification
 */

export type TrendDirection = "subida_rapida" | "estavel" | "queda" | "sem_dados";

export interface TrendResult {
  delta: number;
  direction: TrendDirection;
  directionLabel: string;
  directionIcon: "↑" | "→" | "↓" | "—";
  acceleration: number;
  accelerationLabel: string;
  avgCooldownMinutes: number | null;
}

interface LogEntry {
  manual_level: number;
  created_at: string;
}

export function classifyDelta(delta: number): { direction: TrendDirection; label: string; icon: "↑" | "→" | "↓" } {
  if (delta > 10) return { direction: "subida_rapida", label: "Subida Rápida", icon: "↑" };
  if (delta < -10) return { direction: "queda", label: "Queda", icon: "↓" };
  return { direction: "estavel", label: "Estável", icon: "→" };
}

export function calculateTrend(logs: LogEntry[]): TrendResult {
  if (logs.length < 2) {
    return {
      delta: 0,
      direction: "sem_dados",
      directionLabel: "Sem dados",
      directionIcon: "—",
      acceleration: 0,
      accelerationLabel: "—",
      avgCooldownMinutes: null,
    };
  }

  // Sort chronologically
  const sorted = [...logs].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Delta: difference between last two readings
  const current = sorted[sorted.length - 1].manual_level;
  const previous = sorted[sorted.length - 2].manual_level;
  const delta = current - previous;

  const { direction, label, icon } = classifyDelta(delta);

  // Acceleration: difference between current delta and previous delta
  let acceleration = 0;
  let accelerationLabel = "—";
  if (sorted.length >= 3) {
    const prevPrev = sorted[sorted.length - 3].manual_level;
    const prevDelta = previous - prevPrev;
    acceleration = delta - prevDelta;

    if (acceleration > 5) accelerationLabel = "Acelerando ↑↑";
    else if (acceleration < -5) accelerationLabel = "Desacelerando ↓↓";
    else accelerationLabel = "Constante";
  }

  // Average cooldown time: mean time from peak (>70) to recovery (<40)
  const avgCooldownMinutes = calculateCooldown(sorted);

  return {
    delta,
    direction,
    directionLabel: label,
    directionIcon: icon,
    acceleration,
    accelerationLabel,
    avgCooldownMinutes,
  };
}

function calculateCooldown(sorted: LogEntry[]): number | null {
  const cooldowns: number[] = [];
  let peakTime: number | null = null;

  for (const log of sorted) {
    const t = new Date(log.created_at).getTime();

    if (log.manual_level > 70 && peakTime === null) {
      peakTime = t;
    }

    if (log.manual_level < 40 && peakTime !== null) {
      const minutes = (t - peakTime) / 60000;
      cooldowns.push(Math.round(minutes * 10) / 10);
      peakTime = null;
    }
  }

  if (cooldowns.length === 0) return null;
  return Math.round((cooldowns.reduce((a, b) => a + b, 0) / cooldowns.length) * 10) / 10;
}
