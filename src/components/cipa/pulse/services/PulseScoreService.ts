/**
 * CIPA Pulse — Score Calculation Service (Module 1: Backend Scale)
 * Separates score calculation from UI components.
 * Can be used by both local UI and future API endpoints.
 */

import { computeCompositeScore, type CompositeInput } from "../PulseCompositeScore";
import { predictRisk, type PredictionInput, type PredictionResult } from "../PulsePredictionEngine";

/**
 * Calculate the composite stress score from multiple inputs.
 * This wraps the existing PulseCompositeScore for service-layer access.
 */
export function calculateStressScore(input: CompositeInput): number {
  return computeCompositeScore(input);
}

/**
 * Calculate risk prediction from recent readings.
 * This wraps the existing PulsePredictionEngine.
 */
export function calculatePrediction(input: PredictionInput): PredictionResult {
  return predictRisk(input);
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

/**
 * Check if a level triggers a fight detection.
 */
export function isFightLevel(level: number): boolean {
  return level >= 81;
}

/**
 * Check if a level is in the critical zone.
 */
export function isCriticalLevel(level: number): boolean {
  return level >= 61;
}
