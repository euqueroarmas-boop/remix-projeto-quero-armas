/**
 * CIPA Pulse — Bio Sync Service (iOS Integration)
 * Client-side service for syncing bio data from external sources
 */

import { supabase } from "@/integrations/supabase/client";
import { validateBioPayload, type BioIngestPayload } from "../services/PulseBioContract";

export type DeviceType = "web" | "ios" | "watch";

export interface SyncResult {
  success: boolean;
  error?: string;
  synced?: number;
}

export async function syncBioData(
  payload: Partial<BioIngestPayload> & { deviceType?: DeviceType }
): Promise<SyncResult> {
  const validation = validateBioPayload(payload);
  if (!validation.valid) {
    return { success: false, error: `Validation failed: ${validation.errors.join(", ")}` };
  }

  try {
    const { error } = await supabase.from("emotion_logs" as any).insert({
      manual_level: 0,
      status_label: "bio_only",
      source_type: payload.source_type || "ios_watch",
      device_type: payload.deviceType || "watch",
      device_id: payload.device_id || null,
      bio_source: "ios_watch",
      data_mode: "real",
      heart_rate: payload.heart_rate || null,
      hrv: payload.hrv || null,
      sleep_score: payload.sleep_score || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, synced: 1 };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function syncBioBatch(
  readings: (Partial<BioIngestPayload> & { deviceType?: DeviceType })[]
): Promise<SyncResult> {
  let synced = 0;
  const errors: string[] = [];

  for (const reading of readings) {
    const result = await syncBioData(reading);
    if (result.success) synced++;
    else errors.push(result.error || "Unknown error");
  }

  return {
    success: errors.length === 0,
    synced,
    error: errors.length > 0 ? `${errors.length} failures: ${errors[0]}` : undefined,
  };
}

export async function getLatestBioTimestamp(): Promise<string | null> {
  const { data } = await supabase
    .from("emotion_logs" as any)
    .select("created_at")
    .not("heart_rate", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) return (data as any[])[0].created_at;
  return null;
}
