/**
 * Hybrid Score Engine
 * Combines manual stress thermometer data with voice tension analysis
 * to produce a unified conflict risk score.
 *
 * Formula:
 *   - If only manual: 100% manual weight
 *   - If only voice: 100% voice weight
 *   - If both: manual 55% + voice 35% + cross-signal bonus 10%
 *
 * Cross-signal bonus: when both manual AND voice indicate high tension,
 * the combined risk increases (corroborating sources = higher confidence).
 */

export interface HybridInput {
  manualRisk: number | null;      // 0-100 from DailyStats
  manualPeak: number | null;
  manualAvg: number | null;
  voiceTension: number | null;    // 0-100 avg tension from voice logs
  voicePeak: number | null;
  voiceAngerSpikes: number | null;
}

export interface HybridResult {
  hybridScore: number;           // 0-100 unified risk score
  confidence: number;            // 0-100 how confident we are
  dominantSource: "manual" | "voice" | "hybrid";
  crossSignalAlert: boolean;     // both sources agree on high tension
  manualWeight: number;
  voiceWeight: number;
}

export function calculateHybridScore(input: HybridInput): HybridResult {
  const hasManual = input.manualRisk !== null && input.manualRisk > 0;
  const hasVoice = input.voiceTension !== null && input.voiceTension > 0;

  if (!hasManual && !hasVoice) {
    return { hybridScore: 0, confidence: 0, dominantSource: "manual", crossSignalAlert: false, manualWeight: 0, voiceWeight: 0 };
  }

  const mr = input.manualRisk ?? 0;
  const vt = input.voiceTension ?? 0;

  // Only one source
  if (hasManual && !hasVoice) {
    return { hybridScore: mr, confidence: 60, dominantSource: "manual", crossSignalAlert: false, manualWeight: 1, voiceWeight: 0 };
  }
  if (!hasManual && hasVoice) {
    return { hybridScore: vt, confidence: 50, dominantSource: "voice", crossSignalAlert: false, manualWeight: 0, voiceWeight: 1 };
  }

  // Both sources available
  const manualWeight = 0.55;
  const voiceWeight = 0.35;
  const crossWeight = 0.10;

  const baseScore = mr * manualWeight + vt * voiceWeight;

  // Cross-signal: both high → bonus; both low → small reduction
  const bothHigh = mr >= 50 && vt >= 50;
  const bothLow = mr <= 25 && vt <= 25;
  let crossBonus = 0;

  if (bothHigh) {
    crossBonus = Math.min(mr, vt) * crossWeight; // amplify
  } else if (bothLow) {
    crossBonus = -5; // slight confidence bonus (reduce risk)
  }

  // Anger spikes add extra risk
  const angerBonus = (input.voiceAngerSpikes ?? 0) > 2 ? 5 : 0;

  const hybridScore = Math.min(100, Math.max(0, Math.round(baseScore + crossBonus + angerBonus)));

  // Confidence: higher when sources agree
  const diff = Math.abs(mr - vt);
  const agreementFactor = Math.max(0, 100 - diff * 1.5);
  const confidence = Math.min(100, Math.round(70 + agreementFactor * 0.3));

  return {
    hybridScore,
    confidence,
    dominantSource: "hybrid",
    crossSignalAlert: bothHigh,
    manualWeight,
    voiceWeight,
  };
}
