/**
 * CIPA Pulse — Emotion Service (Module 1: Backend Scale)
 * Centralized service layer for emotion log ingestion and querying.
 * Decouples UI from data persistence.
 */

import { supabase } from "@/integrations/supabase/client";
import { getStatusLabel } from "../PulseScoreEngine";

export interface EmotionLogInput {
  manualLevel: number;
  sessionId: string;
  heartRate?: number;
  hrv?: number;
  sleepScore?: number;
  bioSource?: string;
  deviceId?: string;
  sourceType?: "manual" | "ios_watch" | "external" | "voice";
  partnerUserId?: string;
  relationshipId?: string;
  dataMode?: "real" | "simulated";
}

export interface EmotionLogRecord {
  manual_level: number;
  status_label: string;
  created_at: string;
  session_id?: string;
  heart_rate?: number;
  hrv?: number;
  sleep_score?: number;
  bio_source?: string;
  device_id?: string;
  source_type?: string;
  data_mode?: string;
}

/**
 * Ingest a single emotion log entry.
 * This is the canonical way to persist emotion readings.
 */
export async function ingestEmotionLog(input: EmotionLogInput): Promise<{ success: boolean; error?: string }> {
  const statusLabel = getStatusLabel(input.manualLevel);

  try {
    const { error } = await supabase.from("emotion_logs" as any).insert({
      manual_level: input.manualLevel,
      status_label: statusLabel,
      session_id: input.sessionId,
      heart_rate: input.heartRate ?? null,
      hrv: input.hrv ?? null,
      sleep_score: input.sleepScore ?? null,
      bio_source: input.bioSource ?? "none",
      device_id: input.deviceId ?? null,
      source_type: input.sourceType ?? "manual",
      partner_user_id: input.partnerUserId ?? null,
      relationship_id: input.relationshipId ?? null,
      data_mode: input.dataMode ?? "real",
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Ingest bio data from external source (iOS app, Apple Watch, manual).
 */
export async function ingestBioData(input: {
  heartRate?: number;
  hrv?: number;
  sleepScore?: number;
  sessionId: string;
  bioSource: "manual_input" | "ios_watch" | "external";
  deviceId?: string;
  dataMode?: "real" | "simulated";
}): Promise<{ success: boolean; error?: string }> {
  return ingestEmotionLog({
    manualLevel: 0,
    sessionId: input.sessionId,
    heartRate: input.heartRate,
    hrv: input.hrv,
    sleepScore: input.sleepScore,
    bioSource: input.bioSource,
    deviceId: input.deviceId,
    sourceType: input.bioSource === "ios_watch" ? "ios_watch" : "external",
    dataMode: input.dataMode ?? "real",
  });
}

/**
 * Query today's emotion logs.
 */
export async function getTodayEmotionLogs(): Promise<EmotionLogRecord[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("emotion_logs" as any)
    .select("manual_level,created_at,status_label,session_id,heart_rate,hrv,sleep_score,bio_source,device_id,source_type,data_mode")
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59.999`)
    .order("created_at", { ascending: true });

  return (data as unknown as EmotionLogRecord[]) || [];
}

/**
 * Query recent emotion logs (last N).
 */
export async function getRecentEmotionLogs(limit = 50): Promise<EmotionLogRecord[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("emotion_logs" as any)
    .select("manual_level,created_at,status_label,session_id,heart_rate,hrv,sleep_score,bio_source,device_id,source_type,data_mode")
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59.999`)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as unknown as EmotionLogRecord[]) || [];
}
