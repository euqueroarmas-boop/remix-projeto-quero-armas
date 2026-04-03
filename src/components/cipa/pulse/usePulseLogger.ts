/**
 * CIPA Pulse — Logger Hook (Phase 1)
 * Persists emotion logs and events to the database
 */

import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStatusLabel } from "./PulseScoreEngine";
import { createEventDetector, processLevel, type EventDetectorState, type PulseEvent } from "./PulseEventDetector";
import { createChemicalState, processReading, type ChemicalState } from "./PulseChemicalEngine";

const SESSION_ID = `pulse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_DELTA = 3;
const MIN_INTERVAL_MS = 2000;

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

    lastSaved.current = { value: level, timestamp: now };
    const timestamp = new Date().toISOString();
    const statusLabel = getStatusLabel(level);

    try {
      // Insert emotion log
      await supabase.from("emotion_logs" as any).insert({
        manual_level: level,
        status_label: statusLabel,
        session_id: SESSION_ID,
      });

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
      await supabase
        .from("emotion_logs" as any)
        .delete()
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`);
    } catch (e) {
      console.error("[PulseLogger] clear failed:", e);
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
