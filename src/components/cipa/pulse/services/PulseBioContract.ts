/**
 * CIPA Pulse — Bio Ingestion Contract (Module 2: iOS/Apple Watch Preparation)
 * 
 * This file defines the stable payload contract for future native app integration.
 * Any iOS/watchOS app that sends data to CIPA Pulse MUST follow this contract.
 * 
 * == INTEGRATION CONTRACT ==
 * 
 * POST /functions/v1/pulse-bio-ingest
 * Content-Type: application/json
 * 
 * Payload:
 * {
 *   "user_id": "string",           // Required: authenticated user ID
 *   "timestamp": "ISO 8601",       // Required: when the reading was taken
 *   "heart_rate": number | null,   // BPM (40-220 valid range)
 *   "hrv": number | null,          // Heart Rate Variability in ms (1-300)
 *   "sleep_score": number | null,  // 0-100 quality score
 *   "source_type": "manual" | "ios_watch" | "external",
 *   "device_id": "string | null",  // Unique device identifier
 *   "data_mode": "real" | "simulated",
 *   "session_id": "string | null"  // Session tracking
 * }
 * 
 * Response:
 * { "ok": true, "id": "uuid" }
 * 
 * == APPLE WATCH INTEGRATION NOTES ==
 * 
 * Future iOS app should:
 * 1. Request HealthKit authorization for:
 *    - HKQuantityType.heartRate
 *    - HKQuantityType.heartRateVariabilitySDNN
 *    - HKCategoryType.sleepAnalysis
 * 
 * 2. Use Watch Connectivity to relay readings from watchOS to iOS.
 * 
 * 3. iOS app batches readings and POSTs to the bio-ingest endpoint.
 * 
 * 4. source_type = "ios_watch" for HealthKit data
 *    source_type = "manual" for user-entered data
 *    source_type = "external" for other integrations
 * 
 * == VALIDATION RULES ==
 * - heart_rate: 40-220 BPM or null
 * - hrv: 1-300 ms or null
 * - sleep_score: 0-100 or null
 * - At least one bio field must be non-null
 */

export interface BioIngestPayload {
  user_id: string;
  timestamp: string;
  heart_rate: number | null;
  hrv: number | null;
  sleep_score: number | null;
  source_type: "manual" | "ios_watch" | "external";
  device_id: string | null;
  data_mode: "real" | "simulated";
  session_id: string | null;
}

export interface BioIngestResponse {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Validate a bio ingest payload.
 */
export function validateBioPayload(payload: Partial<BioIngestPayload>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload.user_id) errors.push("user_id is required");
  if (!payload.timestamp) errors.push("timestamp is required");

  if (payload.heart_rate !== null && payload.heart_rate !== undefined) {
    if (payload.heart_rate < 40 || payload.heart_rate > 220) {
      errors.push("heart_rate must be between 40-220 BPM");
    }
  }

  if (payload.hrv !== null && payload.hrv !== undefined) {
    if (payload.hrv < 1 || payload.hrv > 300) {
      errors.push("hrv must be between 1-300 ms");
    }
  }

  if (payload.sleep_score !== null && payload.sleep_score !== undefined) {
    if (payload.sleep_score < 0 || payload.sleep_score > 100) {
      errors.push("sleep_score must be between 0-100");
    }
  }

  const hasBio = payload.heart_rate != null || payload.hrv != null || payload.sleep_score != null;
  if (!hasBio) errors.push("At least one bio field must be non-null");

  const validSources = ["manual", "ios_watch", "external"];
  if (payload.source_type && !validSources.includes(payload.source_type)) {
    errors.push("source_type must be manual, ios_watch, or external");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Distinguish between real and simulated data for display.
 */
export function isSimulatedData(dataMode?: string): boolean {
  return dataMode === "simulated";
}

/**
 * Get data mode label for UI display.
 */
export function getDataModeLabel(dataMode?: string): { label: string; color: string } {
  if (dataMode === "simulated") {
    return { label: "Simulado", color: "text-amber-400" };
  }
  return { label: "Real", color: "text-emerald-400" };
}

/**
 * Get source type label for UI display.
 */
export function getSourceLabel(sourceType?: string): string {
  switch (sourceType) {
    case "ios_watch": return "Apple Watch";
    case "external": return "Externo";
    case "manual": return "Manual";
    default: return "Manual";
  }
}
