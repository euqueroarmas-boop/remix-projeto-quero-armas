/**
 * CIPA Pulse — Stats Aggregator (Phase 5)
 * Calculates monthly statistics from emotion_logs and emotion_events
 */

import { supabase } from "@/integrations/supabase/client";

export interface MonthlyStats {
  month_key: string;
  average_score: number;
  max_score: number;
  critical_events: number;
  conflict_events: number;
  cooldown_avg_minutes: number;
  total_readings: number;
  stability_score: number;
}

export async function aggregateMonthStats(monthKey?: string): Promise<MonthlyStats | null> {
  const key = monthKey || getCurrentMonthKey();
  const startDate = `${key}-01T00:00:00`;
  const endDate = getMonthEndDate(key);

  try {
    // Fetch all logs for this month
    const { data: logs } = await supabase
      .from("emotion_logs" as any)
      .select("manual_level, created_at")
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .order("created_at", { ascending: true });

    if (!logs || logs.length === 0) return null;

    const levels = (logs as any[]).map(l => l.manual_level as number);
    const totalReadings = levels.length;
    const averageScore = levels.reduce((a, b) => a + b, 0) / totalReadings;
    const maxScore = Math.max(...levels);

    // Count critical events (>= 70) and conflict events (>= 81)
    const criticalEvents = levels.filter(l => l >= 70).length;
    const conflictEvents = levels.filter(l => l >= 81).length;

    // Fetch emotion_events for cooldown calculation
    const { data: events } = await supabase
      .from("emotion_events" as any)
      .select("duration_minutes, conflict_flag")
      .gte("created_at", startDate)
      .lt("created_at", endDate);

    let cooldownAvg = 0;
    if (events && events.length > 0) {
      const durations = (events as any[])
        .filter(e => e.duration_minutes != null && e.duration_minutes > 0)
        .map(e => e.duration_minutes as number);
      if (durations.length > 0) {
        cooldownAvg = durations.reduce((a, b) => a + b, 0) / durations.length;
      }
    }

    // Stability score: starts at 100, decreases with intensity and events
    const stabilityScore = Math.max(0, Math.min(100,
      100
      - (averageScore * 0.40)
      - (criticalEvents * 1.5)
      - (conflictEvents * 4)
      + (cooldownAvg > 0 && cooldownAvg < 10 ? 5 : 0) // bonus for quick cooldowns
    ));

    const stats: MonthlyStats = {
      month_key: key,
      average_score: round(averageScore),
      max_score: maxScore,
      critical_events: criticalEvents,
      conflict_events: conflictEvents,
      cooldown_avg_minutes: round(cooldownAvg),
      total_readings: totalReadings,
      stability_score: round(stabilityScore),
    };

    // Persist
    await supabase.from("emotion_statistics" as any).upsert({
      user_id: "anonymous",
      month_key: key,
      ...stats,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,month_key" });

    return stats;
  } catch (e) {
    console.error("[PulseStatsAggregator] failed:", e);
    return null;
  }
}

export async function detectTriggers(monthKey?: string) {
  const key = monthKey || getCurrentMonthKey();
  const startDate = `${key}-01T00:00:00`;
  const endDate = getMonthEndDate(key);

  try {
    const { data: logs } = await supabase
      .from("emotion_logs" as any)
      .select("manual_level, created_at, status_label")
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .order("created_at", { ascending: true });

    if (!logs || logs.length < 3) return [];

    const entries = logs as any[];
    const triggers: { name: string; count: number; avgIntensity: number }[] = [];

    // Detect rapid escalation patterns (jump of +20 in consecutive readings)
    let rapidEscalations = 0;
    let escalationIntensity = 0;
    for (let i = 1; i < entries.length; i++) {
      const delta = entries[i].manual_level - entries[i - 1].manual_level;
      if (delta >= 20) {
        rapidEscalations++;
        escalationIntensity += delta;
      }
    }
    if (rapidEscalations > 0) {
      triggers.push({
        name: "escalada_rapida",
        count: rapidEscalations,
        avgIntensity: round(escalationIntensity / rapidEscalations),
      });
    }

    // Detect sustained high stress (3+ consecutive readings >= 60)
    let sustainedCount = 0;
    let streak = 0;
    for (const e of entries) {
      if (e.manual_level >= 60) {
        streak++;
        if (streak >= 3) sustainedCount++;
      } else {
        streak = 0;
      }
    }
    if (sustainedCount > 0) {
      triggers.push({
        name: "tensao_sustentada",
        count: sustainedCount,
        avgIntensity: 70,
      });
    }

    // Detect morning stress (readings before 10:00 with level >= 50)
    const morningHigh = entries.filter(e => {
      const hour = new Date(e.created_at).getHours();
      return hour < 10 && e.manual_level >= 50;
    });
    if (morningHigh.length > 0) {
      triggers.push({
        name: "estresse_matinal",
        count: morningHigh.length,
        avgIntensity: round(morningHigh.reduce((s, e) => s + e.manual_level, 0) / morningHigh.length),
      });
    }

    // Persist triggers
    for (const t of triggers) {
      await supabase.from("emotion_triggers" as any).upsert({
        user_id: "anonymous",
        trigger_name: t.name,
        frequency: t.count,
        avg_intensity: t.avgIntensity,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,trigger_name" });
    }

    return triggers;
  } catch (e) {
    console.error("[PulseStatsAggregator] triggers failed:", e);
    return [];
  }
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthEndDate(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const next = new Date(y, m, 1);
  return next.toISOString();
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
