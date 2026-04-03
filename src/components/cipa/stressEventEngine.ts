/**
 * Stress Event Engine — Phase 2
 * Detects: rapid escalation, near-fight, fight events
 * Calculates daily conflict risk score
 */

export interface StressLog {
  value: number;
  created_at: string;
  delta_from_previous: number;
  minutes_since_previous: number;
}

export interface StressEvent {
  type: "rapid_escalation" | "near_fight" | "fight";
  value: number;
  timestamp: string;
  details: string;
}

export interface DailyStats {
  min_value: number;
  max_value: number;
  weighted_average: number;
  critical_exposure_minutes: number;
  rapid_escalation_count: number;
  near_fight_events_count: number;
  fight_events_count: number;
  cooldown_efficiency_score: number;
  daily_conflict_risk: number;
}

/* ── Event Detection ── */

export function detectEvents(logs: StressLog[]): StressEvent[] {
  if (logs.length < 2) return [];
  const events: StressEvent[] = [];
  const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];
    const delta = curr.value - prev.value;
    const mins = curr.minutes_since_previous;

    // Rapid escalation: +20 in <10min OR +30 in <20min
    if ((delta >= 20 && mins < 10) || (delta >= 30 && mins < 20)) {
      events.push({
        type: "rapid_escalation",
        value: curr.value,
        timestamp: curr.created_at,
        details: `+${delta} pts em ${mins.toFixed(1)} min`,
      });
    }

    // Fight: value >= 81
    if (curr.value >= 81) {
      // Check if coming from escalation or sustained
      const isBrusque = delta >= 15;
      const wasPrevHigh = prev.value >= 60;
      if (isBrusque || wasPrevHigh) {
        events.push({
          type: "fight",
          value: curr.value,
          timestamp: curr.created_at,
          details: isBrusque
            ? `Escalada brusca: +${delta} → ${curr.value}`
            : `Tensão sustentada → ${curr.value}`,
        });
      }
    }
    // Near fight: 60-80 sustained or escalation that didn't reach 81
    else if (curr.value >= 60 && curr.value <= 80) {
      if (prev.value >= 50 || delta >= 15) {
        events.push({
          type: "near_fight",
          value: curr.value,
          timestamp: curr.created_at,
          details: `Zona de tensão alta: ${curr.value}`,
        });
      }
    }
  }

  return events;
}

/* ── Daily Score Calculation ── */

export function calculateDailyStats(logs: StressLog[]): DailyStats {
  if (logs.length === 0) {
    return {
      min_value: 0, max_value: 0, weighted_average: 0,
      critical_exposure_minutes: 0, rapid_escalation_count: 0,
      near_fight_events_count: 0, fight_events_count: 0,
      cooldown_efficiency_score: 100, daily_conflict_risk: 0,
    };
  }

  const values = logs.map(l => l.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // Weighted average (more recent = more weight)
  let weightSum = 0;
  let weightedSum = 0;
  logs.forEach((l, i) => {
    const w = i + 1; // linear weight
    weightedSum += l.value * w;
    weightSum += w;
  });
  const avg = weightSum > 0 ? weightedSum / weightSum : 0;

  // Critical exposure: estimate minutes with value >= 61
  let criticalMinutes = 0;
  for (const l of logs) {
    if (l.value >= 61) {
      criticalMinutes += Math.max(l.minutes_since_previous, 1);
    }
  }

  const events = detectEvents(logs);
  const rapidCount = events.filter(e => e.type === "rapid_escalation").length;
  const nearFightCount = events.filter(e => e.type === "near_fight").length;
  const fightCount = events.filter(e => e.type === "fight").length;

  // Cooldown efficiency: how quickly tension drops after peaks
  let cooldowns = 0;
  let cooldownTotal = 0;
  for (let i = 1; i < logs.length; i++) {
    if (logs[i].value < logs[i - 1].value && logs[i - 1].value >= 60) {
      const drop = logs[i - 1].value - logs[i].value;
      cooldowns++;
      cooldownTotal += Math.min(100, (drop / logs[i - 1].value) * 100);
    }
  }
  const cooldownScore = cooldowns > 0 ? cooldownTotal / cooldowns : 100;

  // Daily conflict risk formula
  const fightPenalty = fightCount > 0 ? Math.min(100, fightCount * 25) : 0;
  const risk = Math.min(100, Math.max(0,
    (maxVal * 0.30) +
    (avg * 0.25) +
    (Math.min(criticalMinutes, 60) / 60 * 100 * 0.20) +
    (Math.min(rapidCount, 5) * 20 * 0.10) +
    (fightPenalty * 0.15)
  ));

  return {
    min_value: minVal,
    max_value: maxVal,
    weighted_average: Math.round(avg * 10) / 10,
    critical_exposure_minutes: Math.round(criticalMinutes * 10) / 10,
    rapid_escalation_count: rapidCount,
    near_fight_events_count: nearFightCount,
    fight_events_count: fightCount,
    cooldown_efficiency_score: Math.round(cooldownScore * 10) / 10,
    daily_conflict_risk: Math.round(risk * 10) / 10,
  };
}
