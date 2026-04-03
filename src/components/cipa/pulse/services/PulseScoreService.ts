/**
 * CIPA Pulse — Score Calculation Service (Module 1: Backend Scale)
 * Separates score calculation from UI components.
 */

import { calculateCompositeScore, type BioData } from "../PulseCompositeScore";
import { predictRisk, type PredictionResult } from "../PulsePredictionEngine";

export interface StressScoreInput {
  manualLevel: number;
  bio?: BioData;
  recentLevels?: number[];
}

/**
 * Calculate the composite stress score from multiple inputs.
 */
export function calculateStressScore(input: StressScoreInput): number {
  const result = calculateCompositeScore(input.manualLevel, input.bio, input.recentLevels);
  return result.score;
}

/**
 * Calculate risk prediction from recent readings.
 */
export function calculatePrediction(readings: number[], timestamps?: string[]): PredictionResult {
  return predictRisk(readings, timestamps);
}

/**
 * Classify a raw level into a zone.
 */
export function classifyLevel(level: number): {
  zone: "calmo" | "atencao" | "tensao" | "critico" | "conflito";
  color: string;
  label: string;
} {
  if (level >= 81) return { zone: "conflito", color: "#dc2626", label: "Conflito" };
  if (level >= 61) return { zone: "critico", color: "#ea580c", label: "Crítico" };
  if (level >= 41) return { zone: "tensao", color: "#eab308", label: "Tensão" };
  if (level >= 21) return { zone: "atencao", color: "#3b82f6", label: "Atenção" };
  return { zone: "calmo", color: "#22c55e", label: "Calmo" };
}

export function isFightLevel(level: number): boolean {
  return level >= 81;
}

export function isCriticalLevel(level: number): boolean {
  return level >= 61;
}
