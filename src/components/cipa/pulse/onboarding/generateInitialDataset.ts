/**
 * CIPA Pulse — Initial Dataset Generator (Phase 9, Module 2)
 * Generates 7 days of simulated data based on onboarding answers
 */

import { supabase } from "@/integrations/supabase/client";
import { getStatusLabel } from "../PulseScoreEngine";

const HOUR_SLOTS = [
  [8, 9, 10],
  [13, 14, 15],
  [19, 20, 21],
  [11, 16, 22],
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type EmotionalProfile = "calmo" | "moderado" | "tenso";

function getProfile(baseScore: number): EmotionalProfile {
  if (baseScore <= 25) return "calmo";
  if (baseScore <= 55) return "moderado";
  return "tenso";
}

interface DayConfig {
  daysAgo: number;
  minLevel: number;
  maxLevel: number;
  readings: number;
}

const PROFILES: Record<EmotionalProfile, DayConfig[]> = {
  calmo: [
    { daysAgo: 7, minLevel: 0, maxLevel: 15, readings: 3 },
    { daysAgo: 6, minLevel: 5, maxLevel: 18, readings: 3 },
    { daysAgo: 5, minLevel: 0, maxLevel: 20, readings: 3 },
    { daysAgo: 4, minLevel: 8, maxLevel: 22, readings: 3 },
    { daysAgo: 3, minLevel: 0, maxLevel: 15, readings: 3 },
    { daysAgo: 2, minLevel: 5, maxLevel: 20, readings: 3 },
    { daysAgo: 1, minLevel: 0, maxLevel: 18, readings: 3 },
  ],
  moderado: [
    { daysAgo: 7, minLevel: 10, maxLevel: 30, readings: 3 },
    { daysAgo: 6, minLevel: 15, maxLevel: 35, readings: 3 },
    { daysAgo: 5, minLevel: 20, maxLevel: 40, readings: 3 },
    { daysAgo: 4, minLevel: 10, maxLevel: 25, readings: 3 },
    { daysAgo: 3, minLevel: 25, maxLevel: 45, readings: 4 },
    { daysAgo: 2, minLevel: 15, maxLevel: 35, readings: 3 },
    { daysAgo: 1, minLevel: 20, maxLevel: 40, readings: 3 },
  ],
  tenso: [
    { daysAgo: 7, minLevel: 30, maxLevel: 50, readings: 3 },
    { daysAgo: 6, minLevel: 40, maxLevel: 60, readings: 3 },
    { daysAgo: 5, minLevel: 50, maxLevel: 70, readings: 4 },
    { daysAgo: 4, minLevel: 35, maxLevel: 55, readings: 3 },
    { daysAgo: 3, minLevel: 55, maxLevel: 75, readings: 4 },
    { daysAgo: 2, minLevel: 45, maxLevel: 65, readings: 3 },
    { daysAgo: 1, minLevel: 60, maxLevel: 85, readings: 3 },
  ],
};

/**
 * @param baseScore - the score calculated from onboarding answers (0-100)
 */
export async function generateInitialDataset(baseScore: number = 50): Promise<void> {
  const profile = getProfile(baseScore);
  const pattern = PROFILES[profile];
  const sessionId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const logs: any[] = [];
  const events: any[] = [];

  for (const day of pattern) {
    const date = new Date();
    date.setDate(date.getDate() - day.daysAgo);
    const dateStr = date.toISOString().slice(0, 10);

    for (let r = 0; r < day.readings; r++) {
      const hourSlot = HOUR_SLOTS[r % HOUR_SLOTS.length];
      const hour = hourSlot[rand(0, hourSlot.length - 1)];
      const minute = rand(0, 59);
      const ts = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);

      const level = rand(day.minLevel, day.maxLevel);

      logs.push({
        manual_level: level,
        status_label: getStatusLabel(level),
        session_id: sessionId,
        created_at: ts.toISOString(),
        bio_source: "simulated",
        data_mode: "simulated",
        source_type: "manual",
      });

      if (level > 60) {
        events.push({
          started_at: ts.toISOString(),
          peak_level: level,
          ended_at: new Date(ts.getTime() + rand(5, 30) * 60000).toISOString(),
          duration_minutes: rand(5, 30),
          conflict_flag: level >= 81,
          source_type: "manual",
        });
      }
    }
  }

  try {
    await supabase.from("emotion_logs" as any).insert(logs);
    if (events.length > 0) {
      await supabase.from("emotion_events" as any).insert(events);
    }
  } catch (e) {
    console.error("[PulseOnboarding] dataset generation failed:", e);
  }
}
