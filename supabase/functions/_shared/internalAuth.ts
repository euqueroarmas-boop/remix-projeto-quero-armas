// Shared auth helper for sensitive Edge Functions.
// Accepts EITHER:
//   1) A valid Supabase JWT whose user has the 'admin' role in user_roles, OR
//   2) A header `x-internal-token` matching INTERNAL_FUNCTION_TOKEN env var
//      (used for function-to-function calls / server-side flows).
//
// Usage:
//   const guard = await requireAdminOrInternal(req);
//   if (!guard.ok) return guard.response;
//   // proceed: guard.via === 'admin' | 'internal'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Constant-time string comparison to prevent timing attacks on token validation.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return timingSafeEqual(expected, signature);
  } catch {
    return false;
  }
}

export type AuthGuard =
  | { ok: true; via: "internal" }
  | { ok: true; via: "admin"; userId: string; email: string | null }
  | { ok: true; via: "legacy-admin" } // x-admin-token (HMAC ADMIN_PASSWORD)
  | { ok: false; response: Response };

/**
 * Validates the caller is either:
 *  - a service-to-service call carrying x-internal-token = INTERNAL_FUNCTION_TOKEN, OR
 *  - a legacy admin call carrying x-admin-token (HMAC of ADMIN_PASSWORD), OR
 *  - an authenticated user with role 'admin' in public.user_roles.
 * Always sets CORS headers in the rejection response.
 */
export async function requireAdminOrInternal(req: Request): Promise<AuthGuard> {
  // 1) Internal service token
  const internalToken = req.headers.get("x-internal-token");
  const expectedInternal = Deno.env.get("INTERNAL_FUNCTION_TOKEN");
  if (internalToken && expectedInternal && timingSafeEqual(internalToken, expectedInternal)) {
    return { ok: true, via: "internal" };
  }

  // 2) Legacy admin HMAC token (used by /admin panel today)
  const adminToken = req.headers.get("x-admin-token");
  const adminPassword = Deno.env.get("ADMIN_PASSWORD");
  if (adminToken && adminPassword) {
    try {
      const [ts, sig] = adminToken.split(".");
      const timestamp = parseInt(ts, 10);
      if (!Number.isNaN(timestamp) && Date.now() - timestamp <= 8 * 60 * 60 * 1000) {
        if (await hmacVerify(adminPassword, `admin:${ts}`, sig)) {
          return { ok: true, via: "legacy-admin" };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Supabase JWT with admin role
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const userClient = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (!claimsErr && claimsData?.claims?.sub) {
        const userId = claimsData.claims.sub as string;
        const email = (claimsData.claims.email as string | undefined) ?? null;

        const adminClient = createClient(url, service);
        const { data: roleRow } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (roleRow) {
          return { ok: true, via: "admin", userId, email };
        }
      }
    } catch {
      /* fall through to reject */
    }
  }

  return {
    ok: false,
    response: jsonResp({ error: "Unauthorized" }, 401),
  };
}

export const internalCorsHeaders = corsHeaders;

/**
 * Helper for edge-function-to-edge-function calls.
 * Returns headers required to authenticate as an internal service caller.
 * Always include these headers when invoking another sensitive function.
 */
export function internalCallHeaders(): Record<string, string> {
  const token = Deno.env.get("INTERNAL_FUNCTION_TOKEN");
  return token ? { "x-internal-token": token } : {};
}

/**
 * Lighter variant: accepts any authenticated user OR an internal/admin caller.
 * Useful for endpoints that may legitimately be triggered by a logged-in
 * customer (not necessarily admin), but should NEVER be reachable anonymously.
 */
export async function requireAuthenticatedOrInternal(req: Request): Promise<AuthGuard> {
  // Try the strict path first (admin / internal / legacy admin token)
  const strict = await requireAdminOrInternal(req);
  if (strict.ok) return strict;

  // Fall back: any valid Supabase JWT
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await userClient.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        return {
          ok: true,
          via: "admin",
          userId: data.claims.sub as string,
          email: (data.claims.email as string | undefined) ?? null,
        };
      }
    } catch {
      /* fall through */
    }
  }

  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  };
}