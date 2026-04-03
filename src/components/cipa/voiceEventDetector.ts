/**
 * Voice Event Detector
 * Detects voice_escalation, voice_cooldown, and sustained_high_tension events
 */

export interface VoiceLogEntry {
  tension_score: number;
  anger_probability_estimate: number;
  created_at: string;
}

export interface VoiceEvent {
  type: "voice_escalation" | "voice_cooldown" | "sustained_high_tension";
  value: number;
  timestamp: string;
  details: string;
}

export function detectVoiceEvents(logs: VoiceLogEntry[]): VoiceEvent[] {
  if (logs.length < 2) return [];
  const events: VoiceEvent[] = [];
  const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let highTensionStart: number | null = null;

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];
    const delta = curr.tension_score - prev.tension_score;
    const currTime = new Date(curr.created_at).getTime();
    const prevTime = new Date(prev.created_at).getTime();
    const minutesBetween = (currTime - prevTime) / 60000;

    // Voice escalation: tension jumps +15 or more
    if (delta >= 15) {
      events.push({
        type: "voice_escalation",
        value: curr.tension_score,
        timestamp: curr.created_at,
        details: `Tensão vocal subiu +${delta.toFixed(0)} em ${minutesBetween.toFixed(1)}min`,
      });
    }

    // Voice cooldown: tension drops -15 or more from high zone
    if (delta <= -15 && prev.tension_score >= 50) {
      events.push({
        type: "voice_cooldown",
        value: curr.tension_score,
        timestamp: curr.created_at,
        details: `Recuperação vocal: ${prev.tension_score.toFixed(0)} → ${curr.tension_score.toFixed(0)}`,
      });
    }

    // Sustained high tension tracking
    if (curr.tension_score >= 60) {
      if (highTensionStart === null) highTensionStart = currTime;
      const sustainedMin = (currTime - highTensionStart) / 60000;
      if (sustainedMin >= 3) {
        events.push({
          type: "sustained_high_tension",
          value: curr.tension_score,
          timestamp: curr.created_at,
          details: `Tensão vocal alta sustentada por ${sustainedMin.toFixed(0)}min`,
        });
        highTensionStart = currTime; // Reset to avoid duplicate
      }
    } else {
      highTensionStart = null;
    }
  }

  return events;
}
