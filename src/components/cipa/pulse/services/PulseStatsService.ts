/**
 * CIPA Pulse — Stats Service (Module 1: Backend Scale)
 * Handles statistics aggregation and querying.
 */

import { supabase } from "@/integrations/supabase/client";

export interface MonthlyStatsResult {
  monthKey: string;
  averageScore: number;
  maxScore: number;
  criticalEvents: number;
  conflictEvents: number;
  cooldownAvgMinutes: number;
  totalReadings: number;
  stabilityScore: number;
}

/**
 * Aggregate monthly statistics from emotion_logs.
 */
export async function aggregateMonthlyStats(monthKey: string): Promise<MonthlyStatsResult> {
  const startDate = `${monthKey}-01T00:00:00`;
  const endMonth = parseInt(monthKey.slice(5, 7));
  const endYear = parseInt(monthKey.slice(0, 4));
  const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
  const nextYear = endMonth === 12 ? endYear + 1 : endYear;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`;

  const { data: logs } = await supabase
    .from("emotion_logs" as any)
    .select("manual_level,created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at", { ascending: true });

  const records = (logs as any[]) || [];
  if (records.length === 0) {
    return {
      monthKey,
      averageScore: 0,
      maxScore: 0,
      criticalEvents: 0,
      conflictEvents: 0,
      cooldownAvgMinutes: 0,
      totalReadings: 0,
      stabilityScore: 100,
    };
  }

  const levels = records.map((r) => r.manual_level as number);
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  const max = Math.max(...levels);
  const critical = levels.filter((l) => l >= 61).length;
  const conflicts = levels.filter((l) => l >= 81).length;
  const stdDev = Math.sqrt(levels.reduce((sum, l) => sum + (l - avg) ** 2, 0) / levels.length);
  const stability = Math.max(0, 100 - stdDev * 2);

  return {
    monthKey,
    averageScore: Math.round(avg * 10) / 10,
    maxScore: max,
    criticalEvents: critical,
    conflictEvents: conflicts,
    cooldownAvgMinutes: 0,
    totalReadings: records.length,
    stabilityScore: Math.round(stability * 10) / 10,
  };
}

/**
 * Persist aggregated monthly statistics.
 */
export async function saveMonthlyStats(stats: MonthlyStatsResult): Promise<void> {
  try {
    await supabase.from("emotion_statistics" as any).upsert(
      {
        month_key: stats.monthKey,
        average_score: stats.averageScore,
        max_score: stats.maxScore,
        critical_events: stats.criticalEvents,
        conflict_events: stats.conflictEvents,
        cooldown_avg_minutes: stats.cooldownAvgMinutes,
        total_readings: stats.totalReadings,
        stability_score: stats.stabilityScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month_key,user_id" }
    );
  } catch (e) {
    console.error("[PulseStatsService] save failed:", e);
  }
}

/**
 * Get current risk score based on recent readings.
 */
export async function getCurrentRisk(): Promise<{ riskLevel: string; score: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("emotion_logs" as any)
    .select("manual_level")
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59.999`)
    .order("created_at", { ascending: false })
    .limit(10);

  const records = (data as any[]) || [];
  if (records.length === 0) return { riskLevel: "baixo", score: 0 };

  const avg = records.reduce((a, r) => a + r.manual_level, 0) / records.length;

  if (avg >= 81) return { riskLevel: "critico", score: avg };
  if (avg >= 61) return { riskLevel: "alto", score: avg };
  if (avg >= 41) return { riskLevel: "moderado", score: avg };
  return { riskLevel: "baixo", score: avg };
}
