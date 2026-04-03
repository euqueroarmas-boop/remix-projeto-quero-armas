/**
 * CIPA Pulse — Streak Service (Phase 10, Module 1)
 * Manages consecutive daily usage streaks
 */

import { supabase } from "@/integrations/supabase/client";

const USER_ID = "anonymous";

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_entry_date: string | null;
  consistency_score: number;
  total_days_logged: number;
}

export async function getStreak(): Promise<StreakData> {
  const { data } = await supabase
    .from("user_streaks" as any)
    .select("current_streak,longest_streak,last_entry_date,consistency_score,total_days_logged")
    .eq("user_id", USER_ID)
    .maybeSingle();

  if (data) return data as unknown as StreakData;

  return {
    current_streak: 0,
    longest_streak: 0,
    last_entry_date: null,
    consistency_score: 0,
    total_days_logged: 0,
  };
}

export async function updateStreak(): Promise<StreakData> {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await getStreak();

  // Already logged today
  if (existing.last_entry_date === today) return existing;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let newStreak: number;
  if (existing.last_entry_date === yesterdayStr) {
    newStreak = existing.current_streak + 1;
  } else {
    newStreak = 1;
  }

  const totalDays = existing.total_days_logged + 1;
  const longestStreak = Math.max(existing.longest_streak, newStreak);

  // Consistency: days logged out of last 30
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: recentLogs } = await supabase
    .from("emotion_logs" as any)
    .select("created_at")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  const uniqueDays = new Set<string>();
  if (recentLogs) {
    (recentLogs as any[]).forEach(l => {
      uniqueDays.add(new Date(l.created_at).toISOString().slice(0, 10));
    });
  }
  uniqueDays.add(today);
  const consistencyScore = Math.round((uniqueDays.size / 30) * 100);

  const updated: any = {
    user_id: USER_ID,
    current_streak: newStreak,
    longest_streak: longestStreak,
    last_entry_date: today,
    consistency_score: consistencyScore,
    total_days_logged: totalDays,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from("user_streaks" as any)
    .upsert(updated, { onConflict: "user_id" });

  return updated as StreakData;
}
