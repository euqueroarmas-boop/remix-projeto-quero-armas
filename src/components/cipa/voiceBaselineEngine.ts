/**
 * Voice Baseline Engine
 * Learns individual voice patterns and works with personal deviation.
 * All processing is local — no audio is stored.
 */

const BASELINE_KEY = "cipa-voice-baseline";
const MIN_SAMPLES = 5;

export interface VoiceFeatures {
  energy: number;
  pitchMean: number;
  pitchVariation: number;
  speechRate: number;
}

export interface VoiceBaseline {
  energy: { mean: number; std: number };
  pitchMean: { mean: number; std: number };
  pitchVariation: { mean: number; std: number };
  speechRate: { mean: number; std: number };
  sampleCount: number;
  updatedAt: string;
}

function loadBaseline(): VoiceBaseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveBaseline(b: VoiceBaseline) {
  localStorage.setItem(BASELINE_KEY, JSON.stringify(b));
}

function mean(arr: number[]) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function std(arr: number[], m: number) {
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

export function updateBaseline(features: VoiceFeatures): VoiceBaseline {
  const existing = loadBaseline();
  const samplesKey = "cipa-voice-samples";
  let samples: VoiceFeatures[] = [];

  try {
    const raw = localStorage.getItem(samplesKey);
    samples = raw ? JSON.parse(raw) : [];
  } catch {}

  samples.push(features);
  // Keep last 50 samples for baseline
  if (samples.length > 50) samples = samples.slice(-50);
  localStorage.setItem(samplesKey, JSON.stringify(samples));

  const energies = samples.map(s => s.energy);
  const pitches = samples.map(s => s.pitchMean);
  const pitchVars = samples.map(s => s.pitchVariation);
  const rates = samples.map(s => s.speechRate);

  const baseline: VoiceBaseline = {
    energy: { mean: mean(energies), std: std(energies, mean(energies)) },
    pitchMean: { mean: mean(pitches), std: std(pitches, mean(pitches)) },
    pitchVariation: { mean: mean(pitchVars), std: std(pitchVars, mean(pitchVars)) },
    speechRate: { mean: mean(rates), std: std(rates, mean(rates)) },
    sampleCount: samples.length,
    updatedAt: new Date().toISOString(),
  };

  saveBaseline(baseline);
  return baseline;
}

export function getBaseline(): VoiceBaseline | null {
  return loadBaseline();
}

export function isBaselineReady(): boolean {
  const b = loadBaseline();
  return b !== null && b.sampleCount >= MIN_SAMPLES;
}

/**
 * Calculate tension score based on deviation from personal baseline.
 * Returns 0–100.
 */
export function calculateVoiceTension(features: VoiceFeatures, baseline: VoiceBaseline): {
  tensionScore: number;
  angerProbability: number;
  confidence: number;
} {
  if (baseline.sampleCount < MIN_SAMPLES) {
    return { tensionScore: 0, angerProbability: 0, confidence: 0 };
  }

  // Z-scores (deviation from personal normal)
  const zEnergy = baseline.energy.std > 0 ? (features.energy - baseline.energy.mean) / baseline.energy.std : 0;
  const zPitch = baseline.pitchMean.std > 0 ? (features.pitchMean - baseline.pitchMean.mean) / baseline.pitchMean.std : 0;
  const zPitchVar = baseline.pitchVariation.std > 0 ? (features.pitchVariation - baseline.pitchVariation.mean) / baseline.pitchVariation.std : 0;
  const zRate = baseline.speechRate.std > 0 ? (features.speechRate - baseline.speechRate.mean) / baseline.speechRate.std : 0;

  // Tension indicators: higher energy, higher pitch, more variation, faster rate
  const tensionRaw =
    Math.max(0, zEnergy) * 0.30 +
    Math.max(0, zPitch) * 0.25 +
    Math.max(0, zPitchVar) * 0.25 +
    Math.max(0, zRate) * 0.20;

  // Map to 0-100
  const tensionScore = Math.min(100, Math.max(0, tensionRaw * 25));

  // Anger probability: high energy + high pitch variation + fast rate
  const angerRaw = Math.max(0, zEnergy) * 0.40 + Math.max(0, zPitchVar) * 0.35 + Math.max(0, zRate) * 0.25;
  const angerProbability = Math.min(100, Math.max(0, angerRaw * 20));

  // Confidence based on sample count
  const confidence = Math.min(100, (baseline.sampleCount / 20) * 100);

  return {
    tensionScore: Math.round(tensionScore * 10) / 10,
    angerProbability: Math.round(angerProbability * 10) / 10,
    confidence: Math.round(confidence),
  };
}
