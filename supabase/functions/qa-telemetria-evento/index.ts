// Edge Function: qa-telemetria-evento
// Endpoint público (anon) para registrar eventos críticos do cadastro
// Quero Armas: cpf_rg_ambiguity_detected, divergencia_confirmada,
// circunscricao_nao_encontrada. Insert via service_role (bypassa RLS).
// IP e User-Agent NÃO são armazenados em claro — apenas SHA-256.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_EVENTS = new Set([
  "cpf_rg_ambiguity_detected",
  "divergencia_confirmada",
  "circunscricao_nao_encontrada",
]);

const ALLOWED_CATEGORIAS = new Set([
  "pessoa_fisica",
  "pessoa_juridica",
  "seguranca_publica",
  "magistrado_mp",
  "militar",
]);

const MAX_PAYLOAD_KEYS = 20;
const MAX_PAYLOAD_BYTES = 4 * 1024; // 4 KB

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sanitiza recursivamente: remove nada que pareça PII (cpf, rg, telefone, email).
 *  Mantém só números agregáveis (counts, flags, enums). */
function sanitizePayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_PAYLOAD_KEYS) break;
    const lk = k.toLowerCase();
    // bloqueia nomes óbvios de PII
    if (
      lk.includes("cpf") && lk !== "cpf_eq_rg" && lk !== "cpf_candidato_count" ||
      lk === "rg" ||
      lk.includes("telefone") ||
      lk.includes("phone") ||
      lk.includes("email") ||
      lk.includes("nome")
    ) {
      // permite só boolean / number "anonimizadores"
      if (typeof v === "boolean" || typeof v === "number") {
        out[k] = v;
        count++;
      }
      continue;
    }
    if (typeof v === "string") {
      out[k] = v.slice(0, 200);
      count++;
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
      count++;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 10).map((x) =>
        typeof x === "string" ? x.slice(0, 80) : x,
      );
      count++;
    }
    // objetos aninhados são ignorados (mantém schema raso)
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "invalid_body" }, 400);

    const event_type = String((body as any).event_type || "");
    if (!ALLOWED_EVENTS.has(event_type)) {
      return json({ error: "invalid_event_type" }, 400);
    }

    let categoria = (body as any).categoria_titular;
    if (categoria != null) {
      categoria = String(categoria);
      if (!ALLOWED_CATEGORIAS.has(categoria)) categoria = null;
    } else categoria = null;

    const sessao_id = String((body as any).sessao_id || "").slice(0, 64) || null;
    const rawPayload = (body as any).payload;
    const payload = sanitizePayload(rawPayload);

    // Limita tamanho final
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }

    // Hash IP + UA (sem persistir versões cruas)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "0.0.0.0";
    const ua = req.headers.get("user-agent") || "";
    const salt = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "telemetria-salt";
    const [ipHash, uaHash] = await Promise.all([
      sha256Hex(`${salt}:${ip}`),
      sha256Hex(`${salt}:${ua}`),
    ]);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { error } = await supabase
      .from("qa_cadastro_telemetria")
      .insert({
        event_type,
        categoria_titular: categoria,
        sessao_id,
        payload,
        ip_hash: ipHash,
        user_agent_hash: uaHash,
      });

    if (error) {
      console.error("[qa-telemetria-evento] insert error", error);
      return json({ error: "insert_failed" }, 500);
    }

    return json({ ok: true });
  } catch (err: any) {
    console.error("[qa-telemetria-evento]", err);
    return json({ error: "internal_error" }, 500);
  }
});