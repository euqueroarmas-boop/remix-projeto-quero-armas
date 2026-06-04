/**
 * Telemetria do cadastro público (Quero Armas).
 *
 * Fire-and-forget: nunca bloqueia UI nem propaga erro pro fluxo.
 * Usa AbortController com timeout de 4s (padrão Mobile Resilience).
 * sessao_id é gerado uma única vez por sessionStorage (não persiste entre tabs).
 *
 * Endpoint: edge function pública `qa-telemetria-evento` (anon).
 * O service_role e a sanitização de PII ficam no servidor.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SESSION_KEY = "qa.telemetria.sessao_id";

export type TelemetriaEventType =
  | "cpf_rg_ambiguity_detected"
  | "divergencia_confirmada"
  | "circunscricao_nao_encontrada";

export interface TelemetriaEventInput {
  event_type: TelemetriaEventType;
  categoria_titular?: string | null;
  payload?: Record<string, unknown>;
}

function getSessaoId(): string {
  try {
    if (typeof window === "undefined") return "";
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function trackTelemetria(evt: TelemetriaEventInput): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  if (typeof fetch === "undefined") return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  const body = {
    event_type: evt.event_type,
    categoria_titular: evt.categoria_titular ?? null,
    sessao_id: getSessaoId(),
    payload: evt.payload ?? {},
  };

  fetch(`${SUPABASE_URL}/functions/v1/qa-telemetria-evento`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
    keepalive: true,
  })
    .catch(() => {
      /* fire-and-forget — telemetria nunca quebra UX */
    })
    .finally(() => clearTimeout(timer));
}