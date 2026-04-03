/**
 * CIPA Pulse — Chemical Engine (Phase 4)
 * Simulates stress accumulation and recovery behavior
 * 
 * - Each peak increases stress_acumulado
 * - Absence of peaks reduces it gradually (decay 0.95/hour)
 * - Accumulated stress influences the final score
 */

export interface ChemicalState {
  stressAcumulado: number;
  irritacaoBase: number;
  lastUpdateTime: number; // timestamp ms
  peakCount: number;
}

const DECAY_RATE = 0.95; // per hour
const PEAK_THRESHOLD = 60;
const PEAK_ACCUMULATION = 8; // points added per peak
const IRRITATION_GROWTH = 2; // irritation increase per peak
const IRRITATION_DECAY = 0.98; // slower decay for irritation
const STORAGE_KEY = "cipa-pulse-chemical-state";

export function createChemicalState(): ChemicalState {
  // Try to restore from localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Apply decay since last update
      return applyDecay(parsed, Date.now());
    }
  } catch {}

  return {
    stressAcumulado: 0,
    irritacaoBase: 0,
    lastUpdateTime: Date.now(),
    peakCount: 0,
  };
}

function applyDecay(state: ChemicalState, now: number): ChemicalState {
  const hoursSinceUpdate = (now - state.lastUpdateTime) / 3600000;
  if (hoursSinceUpdate <= 0) return state;

  // Exponential decay
  const decayFactor = Math.pow(DECAY_RATE, hoursSinceUpdate);
  const irritationFactor = Math.pow(IRRITATION_DECAY, hoursSinceUpdate);

  return {
    stressAcumulado: Math.max(0, state.stressAcumulado * decayFactor),
    irritacaoBase: Math.max(0, state.irritacaoBase * irritationFactor),
    lastUpdateTime: now,
    peakCount: state.peakCount,
  };
}

export function processReading(state: ChemicalState, level: number): ChemicalState {
  const now = Date.now();

  // First apply decay
  let newState = applyDecay(state, now);

  // If this reading is a peak, accumulate
  if (level >= PEAK_THRESHOLD) {
    const intensity = (level - PEAK_THRESHOLD) / (100 - PEAK_THRESHOLD); // 0-1 normalized
    const accumulation = PEAK_ACCUMULATION * (1 + intensity); // higher peaks = more accumulation
    
    newState = {
      stressAcumulado: Math.min(100, newState.stressAcumulado + accumulation),
      irritacaoBase: Math.min(50, newState.irritacaoBase + IRRITATION_GROWTH * intensity),
      lastUpdateTime: now,
      peakCount: newState.peakCount + 1,
    };
  } else {
    newState.lastUpdateTime = now;
  }

  // Persist
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  } catch {}

  return newState;
}

/**
 * Calculate the chemical impact on the stress score
 * Returns a bonus (0-30) to add to the base score
 */
export function getChemicalImpact(state: ChemicalState): number {
  const now = Date.now();
  const current = applyDecay(state, now);

  // Weight: accumulated stress contributes up to +20, irritation up to +10
  const stressBonus = (current.stressAcumulado / 100) * 20;
  const irritationBonus = (current.irritacaoBase / 50) * 10;

  return Math.round((stressBonus + irritationBonus) * 10) / 10;
}

/**
 * Get a human-readable summary of the chemical state
 */
export function getChemicalSummary(state: ChemicalState): {
  level: "baixo" | "moderado" | "alto" | "critico";
  label: string;
  acumulado: number;
  irritacao: number;
} {
  const now = Date.now();
  const current = applyDecay(state, now);
  const total = current.stressAcumulado + current.irritacaoBase;

  let level: "baixo" | "moderado" | "alto" | "critico";
  let label: string;

  if (total < 15) { level = "baixo"; label = "Acúmulo Baixo"; }
  else if (total < 40) { level = "moderado"; label = "Acúmulo Moderado"; }
  else if (total < 70) { level = "alto"; label = "Acúmulo Alto"; }
  else { level = "critico"; label = "Acúmulo Crítico"; }

  return {
    level,
    label,
    acumulado: Math.round(current.stressAcumulado * 10) / 10,
    irritacao: Math.round(current.irritacaoBase * 10) / 10,
  };
}

export function resetChemicalState(): ChemicalState {
  const fresh: ChemicalState = {
    stressAcumulado: 0,
    irritacaoBase: 0,
    lastUpdateTime: Date.now(),
    peakCount: 0,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch {}
  return fresh;
}
