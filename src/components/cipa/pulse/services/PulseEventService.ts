/**
 * CIPA Pulse — Event Service (Module 1: Backend Scale)
 * Handles emotion event creation and querying.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PulseEvent } from "../PulseEventDetector";

export interface EmotionEventInput {
  startedAt: string;
  peakLevel: number;
  endedAt?: string;
  durationMinutes?: number;
  conflictFlag: boolean;
  deviceId?: string;
  sourceType?: string;
  relationshipId?: string;
}

/**
 * Save a completed emotion event.
 */
export async function saveEmotionEvent(input: EmotionEventInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("emotion_events" as any).insert({
      started_at: input.startedAt,
      peak_level: input.peakLevel,
      ended_at: input.endedAt ?? null,
      duration_minutes: input.durationMinutes ?? null,
      conflict_flag: input.conflictFlag,
      device_id: input.deviceId ?? null,
      source_type: input.sourceType ?? "manual",
      relationship_id: input.relationshipId ?? null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Save a PulseEvent from the event detector.
 */
export async function savePulseEvent(event: PulseEvent): Promise<{ success: boolean }> {
  const result = await saveEmotionEvent({
    startedAt: event.started_at,
    peakLevel: event.peak_level,
    endedAt: event.ended_at ?? undefined,
    durationMinutes: event.duration_minutes ?? undefined,
    conflictFlag: event.conflict_flag,
  });
  return { success: result.success };
}

/**
 * Get today's emotion events.
 */
export async function getTodayEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("emotion_events" as any)
    .select("*")
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59.999`)
    .order("created_at", { ascending: true });

  return data || [];
}

/**
 * Get conflict events for a date range.
 */
export async function getConflictEvents(fromDate: string, toDate: string) {
  const { data } = await supabase
    .from("emotion_events" as any)
    .select("*")
    .gte("created_at", fromDate)
    .lt("created_at", toDate)
    .eq("conflict_flag", true)
    .order("created_at", { ascending: true });

  return data || [];
}
