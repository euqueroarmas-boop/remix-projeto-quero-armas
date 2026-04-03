/**
 * CIPA Pulse — First Access Detection (Phase 9, Module 1)
 * Detects if user is accessing the system for the first time
 */

const STORAGE_KEY = "cipa_initialized";
const REAL_COUNT_KEY = "cipa_real_count";

export function isFirstSession(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}

export function markInitialized(): void {
  localStorage.setItem(STORAGE_KEY, "true");
}

export function incrementRealCount(): number {
  const current = parseInt(localStorage.getItem(REAL_COUNT_KEY) || "0", 10);
  const next = current + 1;
  localStorage.setItem(REAL_COUNT_KEY, String(next));
  return next;
}

export function getRealCount(): number {
  return parseInt(localStorage.getItem(REAL_COUNT_KEY) || "0", 10);
}

/** Returns true when user has enough real data to phase out simulated */
export function shouldPhaseOutSimulated(): boolean {
  return getRealCount() >= 5;
}

export function getDataModeLabel(): "simulated" | "real" | "mixed" {
  const count = getRealCount();
  if (count === 0) return "simulated";
  if (count >= 5) return "real";
  return "mixed";
}
