import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD")!;
const GITHUB_PAT = Deno.env.get("GITHUB_PAT")!;
const GITHUB_REPO = "euqueroarmas-boop/dell-shine-solutions";
const SITE_URL = "https://dell-shine-solutions.lovable.app";

// Valid test types (business areas)
const VALID_TEST_TYPES = [
  "smoke", "frontend", "business", "forms", "contracts",
  "checkout", "seo", "blog", "portal", "api", "regression",
] as const;

// Valid suites
const VALID_SUITES = ["smoke", "light", "cypress", "full"] as const;

// Map test_type to execution engine
const LIGHT_TESTS: string[] = ["smoke", "seo", "api", "blog"];
const CYPRESS_TESTS: string[] = ["frontend", "business", "forms", "contracts", "checkout", "portal", "regression"];

// ─── Auth ───
function verifyAdmin(req: Request): boolean {
  const token = req.headers.get("x-admin-token") || "";
  return token === ADMIN_PASSWORD;
}

// ─── Supabase client ───
function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ─── Light tests (run inline) ───
interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  duration_ms: number;
  error?: string;
}

async function runSmokeTests(): Promise<TestResult[]> {
  const pages = [
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: "Orçamento", path: "/orcamento-ti" },
    { name: "Admin Servidores", path: "/administracao-de-servidores" },
    { name: "Suporte TI", path: "/suporte-de-ti" },
    { name: "Locação", path: "/locacao-de-computadores" },
    { name: "Sobre", path: "/sobre" },
    { name: "Serviços", path: "/servicos" },
  ];
  const results: TestResult[] = [];
  for (const page of pages) {
    const start = Date.now();
    try {
      const res = await fetch(`${SITE_URL}${page.path}`, { redirect: "follow" });
      const ok = res.status === 200;
      const body = await res.text();
      const hasContent = body.length > 500;
      results.push({
        name: `Smoke: ${page.name} (${page.path})`,
        status: ok && hasContent ? "passed" : "failed",
        duration_ms: Date.now() - start,
        error: !ok ? `HTTP ${res.status}` : !hasContent ? "Página vazia ou muito curta" : undefined,
      });
    } catch (e) {
      results.push({ name: `Smoke: ${page.name}`, status: "failed", duration_ms: Date.now() - start, error: String(e) });
    }
  }
  return results;
}

async function runSeoTests(): Promise<TestResult[]> {
  const pages = [
    "/", "/blog", "/administracao-de-servidores", "/suporte-de-ti",
    "/locacao-de-computadores", "/orcamento-ti",
  ];
  const results: TestResult[] = [];
  for (const path of pages) {
    const start = Date.now();
    try {
      const res = await fetch(`${SITE_URL}${path}`);
      const html = await res.text();
      const hasTitle = /<title[^>]*>.+<\/title>/i.test(html);
      const hasMeta = /meta\s+name=["']description["']/i.test(html);
      const hasH1 = /<h1[\s>]/i.test(html);
      const errors: string[] = [];
      if (!hasTitle) errors.push("Sem <title>");
      if (!hasMeta) errors.push("Sem meta description");
      if (!hasH1) errors.push("Sem <h1>");
      results.push({
        name: `SEO: ${path}`,
        status: errors.length === 0 ? "passed" : "failed",
        duration_ms: Date.now() - start,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      });
    } catch (e) {
      results.push({ name: `SEO: ${path}`, status: "failed", duration_ms: Date.now() - start, error: String(e) });
    }
  }

  // Sitemap test
  const sitemapStart = Date.now();
  try {
    const res = await fetch(`${SITE_URL}/sitemap.xml`);
    const body = await res.text();
    const hasSitemapIndex = body.includes("<sitemapindex") || body.includes("<urlset");
    results.push({
      name: "SEO: sitemap.xml",
      status: res.status === 200 && hasSitemapIndex ? "passed" : "failed",
      duration_ms: Date.now() - sitemapStart,
      error: res.status !== 200 ? `HTTP ${res.status}` : !hasSitemapIndex ? "Sitemap inválido" : undefined,
    });
  } catch (e) {
    results.push({ name: "SEO: sitemap.xml", status: "failed", duration_ms: Date.now() - sitemapStart, error: String(e) });
  }

  // Robots test
  const robotsStart = Date.now();
  try {
    const res = await fetch(`${SITE_URL}/robots.txt`);
    const body = await res.text();
    results.push({
      name: "SEO: robots.txt",
      status: res.status === 200 && body.includes("Sitemap") ? "passed" : "failed",
      duration_ms: Date.now() - robotsStart,
      error: res.status !== 200 ? `HTTP ${res.status}` : !body.includes("Sitemap") ? "robots.txt sem Sitemap" : undefined,
    });
  } catch (e) {
    results.push({ name: "SEO: robots.txt", status: "failed", duration_ms: Date.now() - robotsStart, error: String(e) });
  }

  return results;
}

async function runApiTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const supabase = getSupabase();

  // Test edge functions are accessible
  const functions = ["submit-lead", "brasil-api-lookup", "sitemap"];
  for (const fn of functions) {
    const start = Date.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "OPTIONS",
        headers: { "Content-Type": "application/json" },
      });
      // OPTIONS should return 200 or 204
      results.push({
        name: `API: ${fn} (OPTIONS)`,
        status: res.status <= 204 ? "passed" : "failed",
        duration_ms: Date.now() - start,
        error: res.status > 204 ? `HTTP ${res.status}` : undefined,
      });
      await res.text();
    } catch (e) {
      results.push({ name: `API: ${fn}`, status: "failed", duration_ms: Date.now() - start, error: String(e) });
    }
  }

  // Test DB connectivity
  const dbStart = Date.now();
  try {
    const { count, error } = await supabase.from("leads").select("*", { count: "exact", head: true });
    results.push({
      name: "API: DB connectivity (leads count)",
      status: error ? "failed" : "passed",
      duration_ms: Date.now() - dbStart,
      error: error?.message,
    });
  } catch (e) {
    results.push({ name: "API: DB connectivity", status: "failed", duration_ms: Date.now() - dbStart, error: String(e) });
  }

  return results;
}

async function runBlogTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();
  try {
    const res = await fetch(`${SITE_URL}/blog`);
    const html = await res.text();
    results.push({
      name: "Blog: página carrega",
      status: res.status === 200 ? "passed" : "failed",
      duration_ms: Date.now() - start,
      error: res.status !== 200 ? `HTTP ${res.status}` : undefined,
    });

    // Check for article links
    const articleLinks = (html.match(/href="\/blog\//g) || []).length;
    results.push({
      name: "Blog: contém links para artigos",
      status: articleLinks >= 1 ? "passed" : "failed",
      duration_ms: 0,
      error: articleLinks < 1 ? `Encontrados ${articleLinks} links para artigos` : undefined,
    });
  } catch (e) {
    results.push({ name: "Blog: página carrega", status: "failed", duration_ms: Date.now() - start, error: String(e) });
  }
  return results;
}

// ─── GitHub Actions dispatch ───
async function triggerGitHubWorkflow(testType: string, runId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/cypress-tests.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_PAT}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            test_type: testType,
            run_id: runId,
            base_url: SITE_URL,
            supabase_url: SUPABASE_URL,
            supabase_key: SUPABASE_SERVICE_KEY,
          },
        }),
      }
    );
    if (res.status === 204) return { success: true };
    const body = await res.text();
    return { success: false, error: `GitHub API ${res.status}: ${body}` };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Alert dispatch on failure ───
async function dispatchAlert(run: any) {
  if (run.status !== "failed" && run.status !== "partial") return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/test-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_alert",
        payload: {
          run_id: run.id,
          test_type: run.test_type || run.suite,
          suite: run.suite,
          status: run.status,
          error_message: run.error_message,
          total_tests: run.total_tests || 0,
          passed_tests: run.passed_tests || 0,
          failed_tests: run.failed_tests || 0,
          client_name: run.client_name,
          client_id: run.client_id,
          plan_type: run.plan_type,
        },
      }),
    });
  } catch (e) {
    console.error("[WMTi] Alert dispatch failed:", e);
  }
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!verifyAdmin(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const url = new URL(req.url);
  const supabase = getSupabase();

  // GET /run-tests?action=list → list runs
  if (req.method === "GET") {
    const action = url.searchParams.get("action");

    if (action === "detail") {
      const id = url.searchParams.get("id");
      if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data, error } = await supabase.from("test_runs").select("*").eq("id", id).single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default: list
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const suiteFilter = url.searchParams.get("suite");
    const typeFilter = url.searchParams.get("test_type");
    const statusFilter = url.searchParams.get("status");

    let query = supabase.from("test_runs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (suiteFilter) query = query.eq("suite", suiteFilter);
    if (typeFilter) query = query.eq("test_type", typeFilter);
    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // POST → run tests
  if (req.method === "POST") {
    const body = await req.json();
    const testType = body.test_type as string;
    const suite = body.suite as string || "light";

    if (!testType || (!VALID_TEST_TYPES.includes(testType as any) && testType !== "full")) {
      return new Response(
        JSON.stringify({ error: `Invalid test_type. Valid: ${VALID_TEST_TYPES.join(", ")}, full` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For "full", run all light tests inline + dispatch all cypress tests
    if (testType === "full") {
      const { data: run, error: insertErr } = await supabase.from("test_runs").insert({
        suite: "full",
        test_type: "full",
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: "admin",
        execution_engine: "hybrid",
        base_url: SITE_URL,
      } as any).select().single();

      if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Run light tests
      const lightResults: TestResult[] = [];
      lightResults.push(...await runSmokeTests());
      lightResults.push(...await runSeoTests());
      lightResults.push(...await runApiTests());
      lightResults.push(...await runBlogTests());

      const passed = lightResults.filter(r => r.status === "passed").length;
      const failed = lightResults.filter(r => r.status === "failed").length;

      // Update with light results (Cypress will update later via callback)
      await supabase.from("test_runs").update({
        results: lightResults as any,
        total_tests: lightResults.length,
        passed_tests: passed,
        failed_tests: failed,
        status: failed > 0 ? "partial" : "running",
        logs: { light_completed: true, cypress_dispatched: false } as any,
      } as any).eq("id", (run as any).id);

      // Dispatch Cypress for heavy tests
      for (const ct of CYPRESS_TESTS) {
        await triggerGitHubWorkflow(ct, (run as any).id);
      }

      await supabase.from("test_runs").update({
        logs: { light_completed: true, cypress_dispatched: true, cypress_types: CYPRESS_TESTS } as any,
      } as any).eq("id", (run as any).id);

      return new Response(JSON.stringify({ id: (run as any).id, status: "running", light_results: { passed, failed, total: lightResults.length } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single test type
    const isLight = LIGHT_TESTS.includes(testType);
    const engine = isLight ? "edge_function" : "github_actions";

    const { data: run, error: insertErr } = await supabase.from("test_runs").insert({
      suite: isLight ? "light" : "cypress",
      test_type: testType,
      status: "running",
      started_at: new Date().toISOString(),
      triggered_by: "admin",
      execution_engine: engine,
      base_url: SITE_URL,
    } as any).select().single();

    if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (isLight) {
      let results: TestResult[] = [];
      switch (testType) {
        case "smoke": results = await runSmokeTests(); break;
        case "seo": results = await runSeoTests(); break;
        case "api": results = await runApiTests(); break;
        case "blog": results = await runBlogTests(); break;
      }

      const passed = results.filter(r => r.status === "passed").length;
      const failed = results.filter(r => r.status === "failed").length;
      const duration = results.reduce((sum, r) => sum + r.duration_ms, 0);

      await supabase.from("test_runs").update({
        status: failed > 0 ? "failed" : "success",
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        total_tests: results.length,
        passed_tests: passed,
        failed_tests: failed,
        results: results as any,
        error_message: failed > 0 ? `${failed} teste(s) falharam` : null,
      } as any).eq("id", (run as any).id);

      return new Response(JSON.stringify({ id: (run as any).id, status: failed > 0 ? "failed" : "success", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cypress — dispatch to GitHub
    const dispatch = await triggerGitHubWorkflow(testType, (run as any).id);
    if (!dispatch.success) {
      await supabase.from("test_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: dispatch.error,
      } as any).eq("id", (run as any).id);
    }

    return new Response(JSON.stringify({ id: (run as any).id, status: dispatch.success ? "running" : "failed", engine: "github_actions", error: dispatch.error }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
