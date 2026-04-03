/**
 * CIPA Pulse — Initial Dataset Generator (Phase 9, Module 2)
 * Generates 7 days of simulated data to avoid empty UI
 */

import { supabase } from "@/integrations/supabase/client";
import { getStatusLabel } from "../PulseScoreEngine";

const SESSION_ID = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

interface DayConfig {
  daysAgo: number;
  minLevel: number;
  maxLevel: number;
  readings: number;
}

const WEEK_PATTERN: DayConfig[] = [
  { daysAgo: 7, minLevel: 10, maxLevel: 25, readings: 3 },  // calmo
  { daysAgo: 6, minLevel: 12, maxLevel: 22, readings: 4 },  // calmo
  { daysAgo: 5, minLevel: 30, maxLevel: 45, readings: 3 },  // atenção
  { daysAgo: 4, minLevel: 15, maxLevel: 28, readings: 3 },  // calmo
  { daysAgo: 3, minLevel: 50, maxLevel: 65, readings: 4 },  // tensão
  { daysAgo: 2, minLevel: 35, maxLevel: 48, readings: 3 },  // atenção
  { daysAgo: 1, minLevel: 70, maxLevel: 85, readings: 3 },  // crítico
];

const HOUR_SLOTS = [
  [8, 9, 10],     // manhã
  [13, 14, 15],   // tarde
  [19, 20, 21],   // noite
  [11, 16, 22],   // variado
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function generateInitialDataset(): Promise<void> {
  const logs: any[] = [];
  const events: any[] = [];

  for (const day of WEEK_PATTERN) {
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
        session_id: SESSION_ID,
        created_at: ts.toISOString(),
        bio_source: "simulated",
        data_mode: "simulated",
        source_type: "manual",
      });

      // Create event for high readings
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
