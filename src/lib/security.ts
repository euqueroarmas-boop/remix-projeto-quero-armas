import { supabase } from "@/integrations/supabase/client";

export type SecurityEventType =
  | "login_success" | "login_failed" | "logout"
  | "brute_force_block" | "invalid_token" | "unauthorized_access"
  | "forbidden_access" | "webhook_error" | "duplicate_request_blocked"
  | "suspicious_activity" | "password_reset" | "session_created";

export type SecuritySeverity = "info" | "warning" | "high" | "critical";

interface SecurityEventParams {
  event_type: SecurityEventType;
  severity?: SecuritySeverity;
  description: string;
  user_id?: string;
  customer_id?: string;
  ip_address?: string;
  user_agent?: string;
  route?: string;
  request_id?: string;
  payload?: Record<string, unknown>;
}

// Rate limiting store (in-memory for client-side)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function logSecurityEvent(params: SecurityEventParams) {
  try {
    await supabase.from("security_events" as any).insert({
      event_type: params.event_type,
      severity: params.severity || "info",
      description: params.description,
      user_id: params.user_id || null,
      customer_id: params.customer_id || null,
      ip_address: params.ip_address || null,
      user_agent: params.user_agent || navigator.userAgent,
      route: params.route || window.location.pathname,
      request_id: params.request_id || crypto.randomUUID(),
      payload: params.payload || {},
    } as any);
  } catch (e) {
    console.error("[security] Failed to log event:", e);
  }
}

export function checkRateLimit(key: string, maxAttempts: number = 5, windowMs: number = 300000): { allowed: boolean; remaining: number; cooldownMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, cooldownMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    const cooldownMs = entry.resetAt - now;
    return { allowed: false, remaining: 0, cooldownMs };
  }

  entry.count++;
  return { allowed: true, remaining: maxAttempts - entry.count, cooldownMs: 0 };
}

export async function logAdminAudit(params: {
  action: string;
  target_type?: string;
  target_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
}) {
  try {
    await supabase.from("admin_audit_logs" as any).insert({
      admin_id: sessionStorage.getItem("admin_token") ? "admin" : null,
      action: params.action,
      target_type: params.target_type || null,
      target_id: params.target_id || null,
      before_state: params.before_state || null,
      after_state: params.after_state || null,
      ip_address: null,
    } as any);
  } catch (e) {
    console.error("[audit] Failed:", e);
  }
}
