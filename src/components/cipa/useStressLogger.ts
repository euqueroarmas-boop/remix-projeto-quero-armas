import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateDailyStats, type StressLog } from "./stressEventEngine";
import { updateMonthlyStats } from "./useMonthlyAggregator";

const SESSION_ID = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_DELTA = 5;
const MIN_INTERVAL_MS = 3000;
const FIGHT_THRESHOLD = 81;

interface LogEntry {
  value: number;
  timestamp: number;
}

async function updateDailyStats(dayKey: string) {
  try {
    const { data } = await supabase
      .from("cipa_stress_logs" as any)
      .select("*")
      .eq("day_key", dayKey)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) return;

    const logs = data as unknown as StressLog[];
    const stats = calculateDailyStats(logs);

    await supabase.from("cipa_stress_daily_stats" as any).upsert({
      day_key: dayKey,
      ...stats,
      updated_at: new Date().toISOString(),
    }, { onConflict: "day_key" });
  } catch (e) {
    console.error("[StressLogger] daily stats update failed:", e);
  }
}

export function useStressLogger(onFightDetected?: () => void) {
  const lastSaved = useRef<LogEntry | null>(null);

  const logStress = useCallback(async (value: number) => {
    const now = Date.now();
    const prev = lastSaved.current;

    if (prev) {
      const delta = Math.abs(value - prev.value);
      const elapsed = now - prev.timestamp;
      if (delta < MIN_DELTA && elapsed < MIN_INTERVAL_MS) return;
    }

    const delta = prev ? value - prev.value : 0;
    const minutesSince = prev ? (now - prev.timestamp) / 60000 : 0;
    const dayKey = new Date().toISOString().slice(0, 10);

    lastSaved.current = { value, timestamp: now };

    try {
      await supabase.from("cipa_stress_logs" as any).insert({
        value,
        day_key: dayKey,
        source: "manual_touch",
        session_id: SESSION_ID,
        delta_from_previous: delta,
        minutes_since_previous: Math.round(minutesSince * 100) / 100,
      });

      updateDailyStats(dayKey);

      const monthKey = dayKey.slice(0, 7);
      updateMonthlyStats(monthKey);

      // Auto-detect fight
      if (value >= FIGHT_THRESHOLD && onFightDetected) {
        onFightDetected();
      }
    } catch (e) {
      console.error("[StressLogger] save failed:", e);
    }
  }, [onFightDetected]);

  const clearDayScore = useCallback(async () => {
    const dayKey = new Date().toISOString().slice(0, 10);
    try {
      await supabase.from("cipa_stress_logs" as any).delete().eq("day_key", dayKey);
      await supabase.from("cipa_stress_daily_stats" as any).delete().eq("day_key", dayKey);
      await supabase.from("voice_emotion_logs" as any).delete().eq("day_key", dayKey);
      await supabase.from("cipa_voice_daily_stats" as any).delete().eq("day_key", dayKey);
      lastSaved.current = null;
    } catch (e) {
      console.error("[StressLogger] clear day failed:", e);
    }
  }, []);

  return { logStress, clearDayScore };
}
