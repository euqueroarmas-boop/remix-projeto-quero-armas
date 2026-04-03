/**
 * CIPA Pulse — Service Layer Index (Module 1: Backend Scale)
 * 
 * Centralized exports for all Pulse services.
 * UI components should import from here for data operations.
 * 
 * Architecture:
 * ┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
 * │  UI Layer   │ ──▶ │  Service Layer   │ ──▶ │  Database    │
 * │ (Components)│     │  (This module)   │     │  (Supabase)  │
 * └─────────────┘     └──────────────────┘     └──────────────┘
 *                            │
 *                     ┌──────┴──────┐
 *                     │ Calculation │
 *                     │   Engines   │
 *                     └─────────────┘
 * 
 * Future expansion points:
 * - Authentication middleware (multiuser)
 * - Feature flags
 * - External API ingestion (iOS app, Apple Watch)
 * - Partner/couple sync
 */

// Emotion log ingestion & querying
export {
  ingestEmotionLog,
  ingestBioData,
  getTodayEmotionLogs,
  getRecentEmotionLogs,
  type EmotionLogInput,
  type EmotionLogRecord,
} from "./PulseEmotionService";

// Emotion event management
export {
  saveEmotionEvent,
  savePulseEvent,
  getTodayEvents,
  getConflictEvents,
  type EmotionEventInput,
} from "./PulseEventService";

// Statistics aggregation
export {
  aggregateMonthlyStats,
  saveMonthlyStats,
  getCurrentRisk,
  type MonthlyStatsResult,
} from "./PulseStatsService";

// Intervention generation & logging
export {
  generateIntervention,
  logIntervention,
  respondToIntervention,
  type InterventionInput,
  type InterventionRecord,
} from "./PulseInterventionService";

// Score calculation (pure logic, no DB)
export {
  calculateStressScore,
  calculatePrediction,
  classifyLevel,
  isFightLevel,
  isCriticalLevel,
} from "./PulseScoreService";
