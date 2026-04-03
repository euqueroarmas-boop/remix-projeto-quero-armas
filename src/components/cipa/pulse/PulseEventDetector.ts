/**
 * CIPA Pulse — Event Detector (Phase 1)
 * Detects emotional events: starts when > 60, ends when < 40
 * Flags conflict when >= 81
 */

export interface PulseEvent {
  started_at: string;
  peak_level: number;
  ended_at?: string;
  duration_minutes?: number;
  conflict_flag: boolean;
}

export interface EventDetectorState {
  active: boolean;
  event: PulseEvent | null;
}

export function createEventDetector(): EventDetectorState {
  return { active: false, event: null };
}

export function processLevel(
  state: EventDetectorState,
  level: number,
  timestamp: string
): { state: EventDetectorState; completedEvent: PulseEvent | null } {
  let completedEvent: PulseEvent | null = null;

  if (!state.active) {
    // Start event when crossing 60
    if (level > 60) {
      return {
        state: {
          active: true,
          event: {
            started_at: timestamp,
            peak_level: level,
            conflict_flag: level >= 81,
          },
        },
        completedEvent: null,
      };
    }
    return { state, completedEvent: null };
  }

  // Event is active
  const event = { ...state.event! };

  // Update peak
  if (level > event.peak_level) {
    event.peak_level = level;
  }

  // Update conflict flag
  if (level >= 81) {
    event.conflict_flag = true;
  }

  // End event when dropping below 40
  if (level < 40) {
    const startMs = new Date(event.started_at).getTime();
    const endMs = new Date(timestamp).getTime();
    const durationMinutes = Math.round((endMs - startMs) / 60000 * 10) / 10;

    completedEvent = {
      ...event,
      ended_at: timestamp,
      duration_minutes: durationMinutes,
    };

    return {
      state: { active: false, event: null },
      completedEvent,
    };
  }

  return {
    state: { active: true, event },
    completedEvent: null,
  };
}
