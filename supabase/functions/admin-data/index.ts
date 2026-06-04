import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyAdminToken(token: string, adminPassword: string): Promise<boolean> {
  try {
    const [ts, sig] = token.split(".");
    const timestamp = parseInt(ts, 10);
    if (Date.now() - timestamp > 8 * 60 * 60 * 1000) return false;
    const expected = await hmacSign(adminPassword, `admin:${ts}`);
    return expected === sig;
  } catch {
    return false;
  }
}

type QueryRequest = {
  table: string;
  select?: string;
  filters?: Array<{ column: string; op: string; value: unknown }>;
  order?: { column: string; ascending: boolean };
  range?: { from: number; to: number };
  count?: boolean;
  limit?: number;
  single?: boolean;
};

const ALLOWED_TABLES = [
  "logs_sistema", "integration_logs", "admin_audit_logs", "security_events",
  "asaas_webhooks", "customers", "payments", "contracts", "leads",
  "proposals", "budget_leads", "contract_signatures", "quotes",
  "fiscal_documents", "invoice_files", "client_events", "service_requests", "contract_equipment",
  "network_diagnostics", "test_runs", "test_run_events", "test_alert_config",
  "blog_posts_ai", "prompt_intelligence", "revenue_intelligence",
  "certificate_config", "signature_logs", "cipa_locations",
  "cms_pages", "cms_blocks", "cms_pricing_rules", "cms_redirects",
  "asaas_customer_map",
  "fiscal_event_history",
  "fiscal_change_log",
  "support_tools",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminPassword = Deno.env.get("ADMIN_PASSWORD");
  if (!adminPassword) {
    return new Response(JSON.stringify({ error: "ADMIN_PASSWORD not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = req.headers.get("x-admin-token");
  if (!token || !(await verifyAdminToken(token, adminPassword))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: { queries: QueryRequest[] } = await req.json();
    if (!body.queries || !Array.isArray(body.queries)) {
      return new Response(JSON.stringify({ error: "queries array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results = await Promise.all(
      body.queries.map(async (q) => {
        if (!ALLOWED_TABLES.includes(q.table)) {
          return { error: `Table '${q.table}' not allowed`, data: null, count: null };
        }

        let query: any = supabase
          .from(q.table)
          .select(q.select || "*", q.count ? { count: "exact" } : undefined);

        if (q.filters) {
          for (const f of q.filters) {
            switch (f.op) {
              case "eq": query = query.eq(f.column, f.value); break;
              case "neq": query = query.neq(f.column, f.value); break;
              case "gt": query = query.gt(f.column, f.value); break;
              case "gte": query = query.gte(f.column, f.value); break;
              case "lt": query = query.lt(f.column, f.value); break;
              case "lte": query = query.lte(f.column, f.value); break;
              case "like": query = query.like(f.column, f.value as string); break;
              case "ilike": query = query.ilike(f.column, f.value as string); break;
              case "in": query = query.in(f.column, f.value as unknown[]); break;
              case "or": query = query.or(f.value as string); break;
              case "head": query = query.select(f.column, { count: "exact", head: true }); break;
            }
          }
        }

        if (q.order) {
          query = query.order(q.order.column, { ascending: q.order.ascending });
        }

        if (q.range) {
          query = query.range(q.range.from, q.range.to);
        }

        if (q.limit) {
          query = query.limit(q.limit);
        }

        if (q.single) {
          const { data, error, count } = await query.maybeSingle();
          return { data, error: error?.message || null, count };
        }

        const { data, error, count } = await query;
        return { data, error: error?.message || null, count };
      })
    );

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
