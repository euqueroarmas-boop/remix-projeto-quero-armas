/**
 * Event tracking system — logs user interactions to backend.
 * Captures page views, CTA clicks, funnel steps, and abandonment.
 */
import { supabase } from "@/integrations/supabase/client";

export type TrackingEvent =
  | "page_view"
  | "cta_click"
  | "whatsapp_click"
  | "form_submit"
  | "form_abandon"
  | "funnel_step"
  | "language_switch"
  | "calculator_use"
  | "blog_read"
  | "lead_captured";

interface TrackPayload {
  event: TrackingEvent;
  page: string;
  label?: string;
  meta?: Record<string, unknown>;
}

const queue: TrackPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);

  // Fire-and-forget — don't block UI
  supabase.functions.invoke("register-log", {
    body: {
      tipo: "tracking",
      status: "info",
      mensagem: `Batch: ${batch.length} events`,
      payload: {
        events: batch.map((e) => ({
          ...e,
          timestamp: new Date().toISOString(),
          language: localStorage.getItem("wmti-lang") || "pt-BR",
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          referrer: document.referrer || null,
        })),
      },
    },
  }).catch(() => {
    // Silently fail — tracking should never break UX
  });
}

/**
 * Track a user event. Events are batched and flushed every 3 seconds.
 */
export function track(event: TrackingEvent, label?: string, meta?: Record<string, unknown>) {
  queue.push({
    event,
    page: window.location.pathname,
    label,
    meta,
  });

  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 3000);
}

/**
 * Track a page view. Call on route changes.
 */
export function trackPageView(path: string) {
  track("page_view", path, {
    title: document.title,
    search: window.location.search || undefined,
    hash: window.location.hash || undefined,
  });
}

/**
 * Track a WhatsApp click with context.
 */
export function trackWhatsApp(page: string, message: string) {
  track("whatsapp_click", page, { message });
}

/**
 * Track a CTA button click.
 */
export function trackCta(buttonLabel: string, destination: string) {
  track("cta_click", buttonLabel, { destination });
}

/**
 * Track funnel step progression.
 */
export function trackFunnelStep(step: string, funnelName: string, meta?: Record<string, unknown>) {
  track("funnel_step", step, { funnel: funnelName, ...meta });
}

/**
 * Flush remaining events (call on page unload).
 */
export function flushTracking() {
  if (flushTimer) clearTimeout(flushTimer);
  flush();
}

// Auto-flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushTracking);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushTracking();
  });
}
