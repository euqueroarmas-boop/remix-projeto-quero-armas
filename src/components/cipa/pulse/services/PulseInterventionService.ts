/**
 * CIPA Pulse — Intervention Service (Module 1: Backend Scale)
 * Generates and logs interventions when emotional levels are critical.
 */

import { supabase } from "@/integrations/supabase/client";

export interface InterventionInput {
  userId?: string;
  triggerEventId?: string;
  interventionType: "suggestion" | "auto" | "partner_alert" | "cooldown_prompt";
  interventionText: string;
  relationshipId?: string;
}

export interface InterventionRecord {
  id: string;
  intervention_type: string;
  intervention_text: string;
  accepted: boolean | null;
  created_at: string;
}

const INTERVENTIONS_BY_LEVEL: Record<string, string[]> = {
  tensao: [
    "Respire fundo 3 vezes. Inspire por 4s, segure 4s, expire por 6s.",
    "Faça uma pausa de 2 minutos. Afaste-se do ambiente se possível.",
    "Beba água e olhe para algo verde (planta, janela).",
  ],
  critico: [
    "ALERTA: Nível crítico detectado. Considere se afastar do ambiente.",
    "Técnica 5-4-3-2-1: Nomeie 5 coisas que vê, 4 que toca, 3 que ouve.",
    "Ligue para alguém de confiança. Não tome decisões agora.",
  ],
  conflito: [
    "CONFLITO DETECTADO. Pare, saia do ambiente imediatamente.",
    "Não responda agora. Volte ao assunto quando estiver abaixo de 40.",
    "Ative modo silêncio. Qualquer palavra agora pode escalar.",
  ],
};

/**
 * Generate an intervention based on the current stress level.
 */
export function generateIntervention(level: number): { type: string; text: string } | null {
  if (level >= 81) {
    const texts = INTERVENTIONS_BY_LEVEL.conflito;
    return { type: "cooldown_prompt", text: texts[Math.floor(Math.random() * texts.length)] };
  }
  if (level >= 61) {
    const texts = INTERVENTIONS_BY_LEVEL.critico;
    return { type: "suggestion", text: texts[Math.floor(Math.random() * texts.length)] };
  }
  if (level >= 41) {
    const texts = INTERVENTIONS_BY_LEVEL.tensao;
    return { type: "suggestion", text: texts[Math.floor(Math.random() * texts.length)] };
  }
  return null;
}

/**
 * Log an intervention to the database.
 */
export async function logIntervention(input: InterventionInput): Promise<{ success: boolean }> {
  try {
    await supabase.from("intervention_logs" as any).insert({
      user_id: input.userId ?? "anonymous",
      trigger_event_id: input.triggerEventId ?? null,
      intervention_type: input.interventionType,
      intervention_text: input.interventionText,
      relationship_id: input.relationshipId ?? null,
    });
    return { success: true };
  } catch (e) {
    console.error("[InterventionService] log failed:", e);
    return { success: false };
  }
}

/**
 * Mark an intervention as accepted/rejected.
 */
export async function respondToIntervention(
  interventionId: string,
  accepted: boolean,
  effectivenessScore?: number
): Promise<void> {
  try {
    await supabase
      .from("intervention_logs" as any)
      .update({
        accepted,
        effectiveness_score: effectivenessScore ?? null,
      })
      .eq("id", interventionId);
  } catch (e) {
    console.error("[InterventionService] respond failed:", e);
  }
}
