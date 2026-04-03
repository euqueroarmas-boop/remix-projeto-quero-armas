/**
 * CIPA Pulse — Relationship Service (Module 3: Couple Mode)
 * Manages relationships between users, invites, and relational scores.
 */

import { supabase } from "@/integrations/supabase/client";

export interface RelationshipInfo {
  id: string;
  status: string;
  createdBy: string;
  partnerId: string | null;
  inviteCode: string;
  createdAt: string;
}

export interface RelationalScoreInput {
  scoreA: number;
  scoreB: number;
  peaksA: number[];
  peaksB: number[];
  timestamps?: string[];
}

export interface RelationalScoreResult {
  combinedRisk: number; // 0-100
  riskLevel: "baixo" | "moderado" | "alto" | "critico";
  simultaneousTension: boolean;
  overlappingPeaks: number;
  trend: "melhorando" | "estavel" | "piorando";
}

/**
 * Create a new relationship invite.
 */
export async function createRelationshipInvite(userId: string): Promise<{ inviteCode: string; relationshipId: string } | null> {
  try {
    const { data, error } = await supabase
      .from("relationships" as any)
      .insert({ created_by: userId, status: "pending" })
      .select("id, invite_code")
      .single();

    if (error || !data) return null;
    const row = data as any;

    // Add creator as member
    await supabase.from("relationship_members" as any).insert({
      relationship_id: row.id,
      user_id: userId,
      role: "creator",
      consent_given: true,
      consent_at: new Date().toISOString(),
    });

    return { inviteCode: row.invite_code, relationshipId: row.id };
  } catch (e) {
    console.error("[RelationshipService] create failed:", e);
    return null;
  }
}

/**
 * Accept a relationship invite by code.
 */
export async function acceptRelationshipInvite(
  inviteCode: string,
  userId: string
): Promise<{ success: boolean; relationshipId?: string; error?: string }> {
  try {
    const { data: rel, error: findError } = await supabase
      .from("relationships" as any)
      .select("id, created_by, status")
      .eq("invite_code", inviteCode)
      .eq("status", "pending")
      .single();

    if (findError || !rel) return { success: false, error: "Convite não encontrado ou já utilizado" };

    const row = rel as any;
    if (row.created_by === userId) return { success: false, error: "Você não pode aceitar seu próprio convite" };

    // Update relationship
    await supabase
      .from("relationships" as any)
      .update({ partner_id: userId, status: "active", updated_at: new Date().toISOString() })
      .eq("id", row.id);

    // Add partner as member
    await supabase.from("relationship_members" as any).insert({
      relationship_id: row.id,
      user_id: userId,
      role: "partner",
      consent_given: true,
      consent_at: new Date().toISOString(),
    });

    return { success: true, relationshipId: row.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Get active relationship for a user.
 */
export async function getActiveRelationship(userId: string): Promise<RelationshipInfo | null> {
  try {
    const { data } = await supabase
      .from("relationship_members" as any)
      .select("relationship_id")
      .eq("user_id", userId);

    if (!data || data.length === 0) return null;

    const relIds = (data as any[]).map((d) => d.relationship_id);
    const { data: rels } = await supabase
      .from("relationships" as any)
      .select("*")
      .in("id", relIds)
      .eq("status", "active")
      .limit(1);

    if (!rels || rels.length === 0) return null;

    const r = rels[0] as any;
    return {
      id: r.id,
      status: r.status,
      createdBy: r.created_by,
      partnerId: r.partner_id,
      inviteCode: r.invite_code,
      createdAt: r.created_at,
    };
  } catch (e) {
    console.error("[RelationshipService] get failed:", e);
    return null;
  }
}

/**
 * Calculate relational risk score between two partners.
 * Considers simultaneous tension, overlapping peaks, and time patterns.
 */
export function calculateRelationalScore(input: RelationalScoreInput): RelationalScoreResult {
  const { scoreA, scoreB, peaksA, peaksB } = input;

  // Simultaneous tension: both above 41
  const simultaneousTension = scoreA >= 41 && scoreB >= 41;

  // Overlapping peaks within close timestamps
  let overlappingPeaks = 0;
  const peakWindowMs = 30 * 60 * 1000; // 30 minutes
  for (const pA of peaksA) {
    for (const pB of peaksB) {
      if (Math.abs(pA - pB) < peakWindowMs) overlappingPeaks++;
    }
  }

  // Combined risk formula
  const avgTension = (scoreA + scoreB) / 2;
  const tensionMultiplier = simultaneousTension ? 1.5 : 1.0;
  const peakBonus = Math.min(overlappingPeaks * 10, 30);
  const combinedRisk = Math.min(100, Math.round(avgTension * tensionMultiplier + peakBonus));

  // Determine risk level
  let riskLevel: RelationalScoreResult["riskLevel"] = "baixo";
  if (combinedRisk >= 81) riskLevel = "critico";
  else if (combinedRisk >= 61) riskLevel = "alto";
  else if (combinedRisk >= 41) riskLevel = "moderado";

  return {
    combinedRisk,
    riskLevel,
    simultaneousTension,
    overlappingPeaks,
    trend: "estavel", // TODO: calculate from historical data
  };
}

/**
 * Check if a user has given consent in their relationship.
 */
export async function hasConsent(userId: string, relationshipId: string): Promise<boolean> {
  const { data } = await supabase
    .from("relationship_members" as any)
    .select("consent_given")
    .eq("user_id", userId)
    .eq("relationship_id", relationshipId)
    .single();

  return (data as any)?.consent_given === true;
}
