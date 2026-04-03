/**
 * CIPA Pulse — Logger Hook (Phase 1 + Sync)
 * Persists emotion logs and events to the database
 * Also mirrors data to cipa_stress_logs for Contador compatibility
 */

import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStatusLabel } from "./PulseScoreEngine";
import { createEventDetector, processLevel, type EventDetectorState, type PulseEvent } from "./PulseEventDetector";
import { createChemicalState, processReading, type ChemicalState } from "./PulseChemicalEngine";

const SESSION_ID = `pulse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_DELTA = 3;
const MIN_INTERVAL_MS = 2000;

/** Mirror the emotion log to the legacy cipa_stress_logs table */
async function mirrorToStressLogs(
  level: number,
  prevValue: number | null,
  prevTimestamp: number | null,
) {
  try {
    const delta = prevValue !== null ? level - prevValue : 0;
    const minutesSince = prevTimestamp !== null ? (Date.now() - prevTimestamp) / 60000 : 0;
    const dayKey = new Date().toISOString().slice(0, 10);

    await supabase.from("cipa_stress_logs" as any).insert({
      value: level,
      day_key: dayKey,
      source: "pulse_sync",
      session_id: SESSION_ID,
      delta_from_previous: delta,
      minutes_since_previous: Math.round(minutesSince * 100) / 100,
    });
  } catch (e) {
    console.error("[PulseLogger] mirror to stress_logs failed:", e);
  }
}

export function usePulseLogger(onConflict?: () => void) {
  const lastSaved = useRef<{ value: number; timestamp: number } | null>(null);
  const eventState = useRef<EventDetectorState>(createEventDetector());
  const chemicalState = useRef<ChemicalState>(createChemicalState());

  const logEmotion = useCallback(async (level: number) => {
    const now = Date.now();
    const prev = lastSaved.current;

    // Throttle
    if (prev) {
      const delta = Math.abs(level - prev.value);
      const elapsed = now - prev.timestamp;
      if (delta < MIN_DELTA && elapsed < MIN_INTERVAL_MS) return;
    }

    const prevValue = prev?.value ?? null;
    const prevTimestamp = prev?.timestamp ?? null;
    lastSaved.current = { value: level, timestamp: now };
    const timestamp = new Date().toISOString();
    const statusLabel = getStatusLabel(level);

    try {
      // Insert emotion log (Pulse system)
      await supabase.from("emotion_logs" as any).insert({
        manual_level: level,
        status_label: statusLabel,
        session_id: SESSION_ID,
      });

      // Mirror to legacy stress system (Contador compatibility)
      mirrorToStressLogs(level, prevValue, prevTimestamp);

      // Process event detection
      const { state: newState, completedEvent } = processLevel(
        eventState.current,
        level,
        timestamp
      );
      eventState.current = newState;

      // Save completed event
      if (completedEvent) {
        await saveEvent(completedEvent);
      }

      // Update chemical engine (Phase 4)
      chemicalState.current = processReading(chemicalState.current, level);
      window.dispatchEvent(new Event("pulse-chemical-update"));

      // Trigger conflict callback
      if (level >= 81 && onConflict) {
        onConflict();
      }
    } catch (e) {
      console.error("[PulseLogger] save failed:", e);
    }
  }, [onConflict]);

  const clearDayLogs = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      await Promise.all([
        supabase.from("emotion_logs" as any).delete().gte("created_at", `${today}T00:00:00`).lt("created_at", `${today}T23:59:59.999`),
        supabase.from("cipa_stress_logs" as any).delete().eq("day_key", today),
        supabase.from("cipa_stress_daily_stats" as any).delete().eq("day_key", today),
      ]);
    } catch (e) {
      console.error("[PulseLogger] clear day failed:", e);
    }
  }, []);

  /** Full reset — wipes ALL Pulse data across all tables */
  const clearAllPulse = useCallback(async () => {
    try {
      await Promise.all([
        supabase.from("emotion_logs" as any).delete().gte("created_at", "2000-01-01"),
        supabase.from("emotion_events" as any).delete().gte("created_at", "2000-01-01"),
        supabase.from("emotion_statistics" as any).delete().gte("created_at", "2000-01-01"),
        supabase.from("emotion_triggers" as any).delete().gte("created_at", "2000-01-01"),
        supabase.from("intervention_logs" as any).delete().gte("created_at", "2000-01-01"),
        supabase.from("cipa_stress_logs" as any).delete().gte("created_at", "2000-01-01"),
        supabase.from("cipa_stress_daily_stats" as any).delete().gte("created_at", "2000-01-01"),
        supabase.from("cipa_stress_monthly_stats" as any).delete().gte("created_at", "2000-01-01"),
        supabase.from("cipa_voice_daily_stats" as any).delete().gte("created_at", "2000-01-01"),
      ]);
      lastSaved.current = null;
      eventState.current = createEventDetector();
      chemicalState.current = createChemicalState();
    } catch (e) {
      console.error("[PulseLogger] full reset failed:", e);
    }
  }, []);

  return { logEmotion, clearDayLogs };
}

async function saveEvent(event: PulseEvent) {
  try {
    await supabase.from("emotion_events" as any).insert({
      started_at: event.started_at,
      peak_level: event.peak_level,
      ended_at: event.ended_at || null,
      duration_minutes: event.duration_minutes || null,
      conflict_flag: event.conflict_flag,
    });
  } catch (e) {
    console.error("[PulseLogger] event save failed:", e);
  }
}
