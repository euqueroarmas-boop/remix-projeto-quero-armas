/**
 * Voice Daily Stats Aggregator
 * Aggregates voice_emotion_logs into cipa_voice_daily_stats
 */

import { supabase } from "@/integrations/supabase/client";

interface VoiceLog {
  tension_score: number;
  anger_probability_estimate: number;
  created_at: string;
}

export async function updateVoiceDailyStats(dayKey: string) {
  try {
    const { data } = await supabase
      .from("voice_emotion_logs" as any)
      .select("tension_score, anger_probability_estimate, created_at")
      .eq("day_key", dayKey)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) return;

    const logs = data as unknown as VoiceLog[];

    const tensions = logs.map(l => l.tension_score);
    const avgTension = tensions.reduce((s, v) => s + v, 0) / tensions.length;
    const peakTension = Math.max(...tensions);

    // Anger spikes: tension_score >= 60
    const angerSpikes = logs.filter(l => l.tension_score >= 60).length;

    // Sustained high tension minutes: consecutive logs with tension >= 50
    let sustainedMinutes = 0;
    let highStart: number | null = null;
    for (const log of logs) {
      const t = new Date(log.created_at).getTime();
      if (log.tension_score >= 50) {
        if (highStart === null) highStart = t;
      } else {
        if (highStart !== null) {
          sustainedMinutes += (t - highStart) / 60000;
          highStart = null;
        }
      }
    }
    if (highStart !== null) {
      const lastTime = new Date(logs[logs.length - 1].created_at).getTime();
      sustainedMinutes += (lastTime - highStart) / 60000;
    }

    // Cooldown recovery score: how well tension drops after peaks
    let cooldowns = 0;
    let cooldownCount = 0;
    for (let i = 1; i < logs.length; i++) {
      if (logs[i - 1].tension_score >= 50 && logs[i].tension_score < logs[i - 1].tension_score) {
        cooldowns += (logs[i - 1].tension_score - logs[i].tension_score) / logs[i - 1].tension_score * 100;
        cooldownCount++;
      }
    }
    const cooldownRecovery = cooldownCount > 0 ? Math.round(cooldowns / cooldownCount) : 100;

    await supabase.from("cipa_voice_daily_stats" as any).upsert({
      day_key: dayKey,
      average_tension_score: Math.round(avgTension * 10) / 10,
      peak_tension_score: Math.round(peakTension * 10) / 10,
      anger_spikes_count: angerSpikes,
      sustained_high_tension_minutes: Math.round(sustainedMinutes * 10) / 10,
      cooldown_voice_recovery_score: cooldownRecovery,
      updated_at: new Date().toISOString(),
    }, { onConflict: "day_key" });
  } catch (e) {
    console.error("[VoiceDailyAggregator] failed:", e);
  }
}
