/**
 * CIPA Pulse — Composite Score Engine (Phase 3)
 * Combines manual level + biometric data + recent history into a weighted score
 * 
 * Formula:
 * stress_score = (0.30 * manual) + (0.25 * heart_rate_norm) + (0.20 * hrv_inv_norm) + (0.15 * sleep_inv_norm) + (0.10 * recent_history)
 */

export interface BioData {
  heartRate?: number | null;
  hrv?: number | null;
  sleepScore?: number | null;
}

export interface CompositeScoreResult {
  score: number;
  manualComponent: number;
  heartRateComponent: number;
  hrvComponent: number;
  sleepComponent: number;
  historyComponent: number;
  hasBioData: boolean;
  breakdown: { label: string; value: number; weight: number; normalized: number }[];
}

// Normalize heart rate to 0-100 stress scale
// Resting ~60bpm = low stress, >120bpm = high stress
function normalizeHeartRate(hr: number): number {
  const clamped = Math.max(50, Math.min(180, hr));
  return Math.round(((clamped - 50) / 130) * 100);
}

// Normalize HRV inversely: high HRV = low stress, low HRV = high stress
// Normal HRV 20-100ms range
function normalizeHrvInverse(hrv: number): number {
  const clamped = Math.max(10, Math.min(120, hrv));
  return Math.round(100 - ((clamped - 10) / 110) * 100);
}

// Normalize sleep inversely: good sleep = low stress
function normalizeSleepInverse(sleepScore: number): number {
  return Math.round(100 - Math.max(0, Math.min(100, sleepScore)));
}

export function calculateCompositeScore(
  manualLevel: number,
  bio: BioData,
  recentHistory: number[] = []
): CompositeScoreResult {
  const hasBio = !!(bio.heartRate || bio.hrv || bio.sleepScore);

  // Normalize bio data
  const hrNorm = bio.heartRate ? normalizeHeartRate(bio.heartRate) : 0;
  const hrvNorm = bio.hrv ? normalizeHrvInverse(bio.hrv) : 0;
  const sleepNorm = bio.sleepScore ? normalizeSleepInverse(bio.sleepScore) : 0;

  // Recent history average (last 5 readings)
  const historyAvg = recentHistory.length > 0
    ? recentHistory.slice(-5).reduce((a, b) => a + b, 0) / Math.min(recentHistory.length, 5)
    : manualLevel;

  let score: number;
  const breakdown: CompositeScoreResult["breakdown"] = [];

  if (hasBio) {
    // Full composite score
    const manualComp = manualLevel * 0.30;
    const hrComp = hrNorm * 0.25;
    const hrvComp = hrvNorm * 0.20;
    const sleepComp = sleepNorm * 0.15;
    const histComp = historyAvg * 0.10;

    score = Math.round(Math.min(100, Math.max(0, manualComp + hrComp + hrvComp + sleepComp + histComp)));

    breakdown.push(
      { label: "Manual", value: manualLevel, weight: 0.30, normalized: manualLevel },
      { label: "Freq. Cardíaca", value: bio.heartRate || 0, weight: 0.25, normalized: hrNorm },
      { label: "VFC (HRV)", value: bio.hrv || 0, weight: 0.20, normalized: hrvNorm },
      { label: "Sono", value: bio.sleepScore || 0, weight: 0.15, normalized: sleepNorm },
      { label: "Histórico", value: Math.round(historyAvg), weight: 0.10, normalized: Math.round(historyAvg) },
    );

    return {
      score,
      manualComponent: Math.round(manualComp),
      heartRateComponent: Math.round(hrComp),
      hrvComponent: Math.round(hrvComp),
      sleepComponent: Math.round(sleepComp),
      historyComponent: Math.round(histComp),
      hasBioData: true,
      breakdown,
    };
  }

  // No bio data — use manual only with slight history influence
  score = Math.round(manualLevel * 0.85 + historyAvg * 0.15);

  breakdown.push(
    { label: "Manual", value: manualLevel, weight: 0.85, normalized: manualLevel },
    { label: "Histórico", value: Math.round(historyAvg), weight: 0.15, normalized: Math.round(historyAvg) },
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    manualComponent: manualLevel,
    heartRateComponent: 0,
    hrvComponent: 0,
    sleepComponent: 0,
    historyComponent: Math.round(historyAvg * 0.15),
    hasBioData: false,
    breakdown,
  };
}
