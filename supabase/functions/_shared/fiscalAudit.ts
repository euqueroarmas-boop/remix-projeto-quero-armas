import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = any;

export interface FiscalAuditEvent {
  fiscal_document_id?: string | null;
  asaas_invoice_id?: string | null;
  customer_id?: string | null;
  event_type: string;
  event_source: string;
  event_timestamp?: string;
  payload_snapshot?: Record<string, unknown>;
  normalized_status?: string;
  overwrite_decision?: string;
  decision_reason?: string;
  created_by_process: string;
  correlation_id?: string | null;
}

export async function logFiscalEvent(
  supabase: SupabaseClient,
  ev: FiscalAuditEvent
): Promise<string | null> {
  try {
    const { data } = await supabase.from("fiscal_event_history").insert({
      fiscal_document_id: ev.fiscal_document_id || null,
      asaas_invoice_id: ev.asaas_invoice_id || null,
      customer_id: ev.customer_id || null,
      event_type: ev.event_type,
      event_source: ev.event_source,
      event_timestamp: ev.event_timestamp || new Date().toISOString(),
      received_at: new Date().toISOString(),
      payload_snapshot: ev.payload_snapshot || {},
      normalized_status: ev.normalized_status || null,
      overwrite_decision: ev.overwrite_decision || "accepted",
      decision_reason: ev.decision_reason || null,
      created_by_process: ev.created_by_process,
      correlation_id: ev.correlation_id || null,
    }).select("id").single();
    return data?.id || null;
  } catch (e) {
    console.error("[fiscalAudit] logFiscalEvent failed:", e);
    return null;
  }
}

export interface FiscalFieldChange {
  fiscal_document_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_source: string;
  changed_by_process: string;
  related_event_history_id?: string | null;
}

export async function logFiscalChanges(
  supabase: SupabaseClient,
  changes: FiscalFieldChange[]
): Promise<void> {
  if (!changes.length) return;
  try {
    await supabase.from("fiscal_change_log").insert(
      changes.map(c => ({
        fiscal_document_id: c.fiscal_document_id,
        field_name: c.field_name,
        old_value: c.old_value,
        new_value: c.new_value,
        change_source: c.change_source,
        changed_by_process: c.changed_by_process,
        changed_at: new Date().toISOString(),
        related_event_history_id: c.related_event_history_id || null,
      }))
    );
  } catch (e) {
    console.error("[fiscalAudit] logFiscalChanges failed:", e);
  }
}

// Helper: detect changed sensitive fields between old record and new values
const SENSITIVE_FIELDS = [
  "status", "document_number", "invoice_series", "access_key",
  "issue_date", "customer_id", "is_active", "replaced_by_invoice_id",
  "file_url", "xml_url", "last_event_source", "last_event_at",
];

export function detectSensitiveChanges(
  existingDoc: Record<string, unknown>,
  newValues: Record<string, unknown>,
  source: string,
  process: string,
  docId: string,
  eventHistoryId?: string | null,
): FiscalFieldChange[] {
  const changes: FiscalFieldChange[] = [];
  for (const field of SENSITIVE_FIELDS) {
    if (field in newValues && newValues[field] !== undefined) {
      const oldVal = existingDoc[field];
      const newVal = newValues[field];
      if (String(oldVal ?? "") !== String(newVal ?? "")) {
        changes.push({
          fiscal_document_id: docId,
          field_name: field,
          old_value: oldVal != null ? String(oldVal) : null,
          new_value: newVal != null ? String(newVal) : null,
          change_source: source,
          changed_by_process: process,
          related_event_history_id: eventHistoryId || null,
        });
      }
    }
  }
  return changes;
}
