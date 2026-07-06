// Shared auth helpers for Quero Armas edge functions.
// Usage:
//   const guard = await requireQAStaff(req);
//   if (!guard.ok) return guard.response;
//   const { userId, perfil } = guard;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

function jsonResp(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type StaffGuard =
  | { ok: true; userId: string; perfil: string; email: string | null }
  | { ok: false; response: Response };

/**
 * Validates that the caller has a valid Supabase JWT AND an active profile in
 * qa_usuarios_perfis. Optionally restricts to a list of perfis (e.g. ["administrador"]).
 */
export async function requireQAStaff(
  req: Request,
  allowedPerfis?: string[],
): Promise<StaffGuard> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: jsonResp({ error: "Unauthorized" }, 401) };
  }
  const token = authHeader.slice("Bearer ".length).trim();

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Validate the JWT by calling /auth/v1/user directly. This avoids
  //    supabase-js quirks ("Auth session missing!") on the signing-keys
  //    system where the client expects a local session.
  let userId = "";
  let email: string | null = null;
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return {
        ok: false,
        response: jsonResp(
          { error: "Invalid token", detail: detail || `status ${resp.status}` },
          401,
        ),
      };
    }
    const u = await resp.json();
    userId = u?.id || "";
    email = u?.email ?? null;
    if (!userId) {
      return { ok: false, response: jsonResp({ error: "Invalid token", detail: "no user id" }, 401) };
    }
  } catch (e: any) {
    return {
      ok: false,
      response: jsonResp({ error: "Invalid token", detail: e?.message || "fetch failed" }, 401),
    };
  }

  // 2) Check active profile via service role (bypass RLS, single source of truth)
  const adminClient = createClient(url, service);
  const { data: perfilRow, error: perfilErr } = await adminClient
    .from("qa_usuarios_perfis")
    .select("perfil, ativo")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (perfilErr || !perfilRow) {
    return { ok: false, response: jsonResp({ error: "Forbidden: no active QA profile" }, 403) };
  }

  const perfil = String(perfilRow.perfil || "");
  if (allowedPerfis && allowedPerfis.length && !allowedPerfis.includes(perfil)) {
    return { ok: false, response: jsonResp({ error: "Forbidden: insufficient role" }, 403) };
  }

  return { ok: true, userId, perfil, email };
}

/**
 * Validates the cron token header for scheduled jobs.
 * Expects header `x-cron-token` to match secret QA_CRON_TOKEN.
 */
export function requireCronToken(req: Request): { ok: true } | { ok: false; response: Response } {
  const expected = Deno.env.get("QA_CRON_TOKEN") || "";
  const provided = req.headers.get("x-cron-token") || "";
  if (!expected) {
    return { ok: false, response: jsonResp({ error: "QA_CRON_TOKEN not configured" }, 500) };
  }
  if (provided !== expected) {
    return { ok: false, response: jsonResp({ error: "Unauthorized cron call" }, 401) };
  }
  return { ok: true };
}

export const qaAuthCors = corsHeaders;