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

const VALID_TEST_TYPES = [
  "smoke", "frontend", "business", "forms", "contracts",
  "checkout", "seo", "blog", "portal", "api", "regression",
] as const;

const VALID_SUITES = ["smoke", "light", "cypress", "full"] as const;

const LIGHT_TESTS: string[] = ["smoke", "seo", "api", "blog"];
const CYPRESS_TESTS: string[] = ["frontend", "business", "forms", "contracts", "checkout", "portal", "regression"];

// ─── Auth ───
async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const token = req.headers.get("x-admin-token") || "";
  if (!token || !token.includes(".")) return false;
  try {
    const [ts, sig] = token.split(".");
    const timestamp = parseInt(ts, 10);
    if (Date.now() - timestamp > 8 * 60 * 60 * 1000) return false;
    return await hmacVerify(ADMIN_PASSWORD, `admin:${ts}`, sig);
  } catch {
    return false;
  }
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ─── Types ───
interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  duration_ms: number;
  error?: string;
  url?: string;
}

interface LogEntry {
  ts: string;
  event: string;
  detail?: string;
}

// ─── Incremental progress helper ───
async function updateRunProgress(
  supabase: ReturnType<typeof getSupabase>,
  runId: string,
  results: TestResult[],
  logEntries: LogEntry[],
  currentSpec?: string,
  currentUrl?: string,
  totalExpected?: number,
) {
  const passed = results.filter(r => r.status === "passed").length;
  const failed = results.filter(r => r.status === "failed").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const total = totalExpected || results.length;

  await supabase.from("test_runs").update({
    total_tests: total,
    passed_tests: passed,
    failed_tests: failed,
    skipped_tests: skipped,
    results: results as any,
    logs: {
      entries: logEntries,
      current_spec: currentSpec || null,
      current_url: currentUrl || null,
      updated_at: new Date().toISOString(),
    } as any,
  } as any).eq("id", runId);
}

// ─── Light tests (run inline with incremental progress) ───
async function runSmokeTests(supabase: ReturnType<typeof getSupabase>, runId: string): Promise<{ results: TestResult[]; logs: LogEntry[] }> {
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
  const logEntries: LogEntry[] = [];

  for (const page of pages) {
    const url = `${SITE_URL}${page.path}`;
    logEntries.push({ ts: new Date().toISOString(), event: "test_started", detail: `Smoke: ${page.name} → ${url}` });
    
    // Update progress BEFORE the test runs
    await updateRunProgress(supabase, runId, results, logEntries, `Smoke: ${page.name}`, url, pages.length);

    const start = Date.now();
    try {
      const res = await fetch(url, { redirect: "follow" });
      const ok = res.status === 200;
      const body = await res.text();
      const hasContent = body.length > 500;
      const status = ok && hasContent ? "passed" : "failed";
      const error = !ok ? `HTTP ${res.status}` : !hasContent ? "Página vazia ou muito curta" : undefined;
      
      results.push({ name: `Smoke: ${page.name} (${page.path})`, status, duration_ms: Date.now() - start, error, url });
      logEntries.push({ ts: new Date().toISOString(), event: status === "passed" ? "test_passed" : "test_failed", detail: `Smoke: ${page.name} — ${status === "passed" ? "OK" : error}` });
    } catch (e) {
      results.push({ name: `Smoke: ${page.name}`, status: "failed", duration_ms: Date.now() - start, error: String(e), url });
      logEntries.push({ ts: new Date().toISOString(), event: "test_failed", detail: `Smoke: ${page.name} — ${String(e)}` });
    }

    // Update progress AFTER each test
    await updateRunProgress(supabase, runId, results, logEntries, `Smoke: ${page.name}`, url, pages.length);
  }
  return { results, logs: logEntries };
}

async function runSeoTests(supabase: ReturnType<typeof getSupabase>, runId: string, existingResults: TestResult[] = [], existingLogs: LogEntry[] = []): Promise<{ results: TestResult[]; logs: LogEntry[] }> {
  const pages = ["/", "/blog", "/administracao-de-servidores", "/suporte-de-ti", "/locacao-de-computadores", "/orcamento-ti"];
  const results: TestResult[] = [...existingResults];
  const logEntries: LogEntry[] = [...existingLogs];
  const totalExpected = existingResults.length + pages.length + 2; // +2 for sitemap and robots

  for (const path of pages) {
    const url = `${SITE_URL}${path}`;
    logEntries.push({ ts: new Date().toISOString(), event: "test_started", detail: `SEO: ${path} → ${url}` });
    await updateRunProgress(supabase, runId, results, logEntries, `SEO: ${path}`, url, totalExpected);

    const start = Date.now();
    try {
      const res = await fetch(url);
      const html = await res.text();
      const hasTitle = /<title[^>]*>.+<\/title>/i.test(html);
      const hasMeta = /meta\s+name=["']description["']/i.test(html);
      const hasH1 = /<h1[\s>]/i.test(html);
      const errors: string[] = [];
      if (!hasTitle) errors.push("Sem <title>");
      if (!hasMeta) errors.push("Sem meta description");
      if (!hasH1) errors.push("Sem <h1>");
      const status = errors.length === 0 ? "passed" : "failed";
      results.push({ name: `SEO: ${path}`, status, duration_ms: Date.now() - start, error: errors.length > 0 ? errors.join("; ") : undefined, url });
      logEntries.push({ ts: new Date().toISOString(), event: status === "passed" ? "test_passed" : "test_failed", detail: `SEO: ${path} — ${status === "passed" ? "OK" : errors.join("; ")}` });
    } catch (e) {
      results.push({ name: `SEO: ${path}`, status: "failed", duration_ms: Date.now() - start, error: String(e), url });
      logEntries.push({ ts: new Date().toISOString(), event: "test_failed", detail: `SEO: ${path} — ${String(e)}` });
    }
    await updateRunProgress(supabase, runId, results, logEntries, `SEO: ${path}`, url, totalExpected);
  }

  // Sitemap
  const sitemapUrl = `${SITE_URL}/sitemap.xml`;
  logEntries.push({ ts: new Date().toISOString(), event: "test_started", detail: `SEO: sitemap.xml → ${sitemapUrl}` });
  await updateRunProgress(supabase, runId, results, logEntries, "SEO: sitemap.xml", sitemapUrl, totalExpected);
  const sStart = Date.now();
  try {
    const res = await fetch(sitemapUrl);
    const body = await res.text();
    const valid = body.includes("<sitemapindex") || body.includes("<urlset");
    const status = res.status === 200 && valid ? "passed" : "failed";
    results.push({ name: "SEO: sitemap.xml", status, duration_ms: Date.now() - sStart, error: !valid ? "Sitemap inválido" : undefined, url: sitemapUrl });
    logEntries.push({ ts: new Date().toISOString(), event: status === "passed" ? "test_passed" : "test_failed", detail: `SEO: sitemap.xml — ${status === "passed" ? "OK" : "Inválido"}` });
  } catch (e) {
    results.push({ name: "SEO: sitemap.xml", status: "failed", duration_ms: Date.now() - sStart, error: String(e), url: sitemapUrl });
    logEntries.push({ ts: new Date().toISOString(), event: "test_failed", detail: `SEO: sitemap.xml — ${String(e)}` });
  }
  await updateRunProgress(supabase, runId, results, logEntries, "SEO: sitemap.xml", sitemapUrl, totalExpected);

  // Robots
  const robotsUrl = `${SITE_URL}/robots.txt`;
  logEntries.push({ ts: new Date().toISOString(), event: "test_started", detail: `SEO: robots.txt → ${robotsUrl}` });
  await updateRunProgress(supabase, runId, results, logEntries, "SEO: robots.txt", robotsUrl, totalExpected);
  const rStart = Date.now();
  try {
    const res = await fetch(robotsUrl);
    const body = await res.text();
    const status = res.status === 200 && body.includes("Sitemap") ? "passed" : "failed";
    results.push({ name: "SEO: robots.txt", status, duration_ms: Date.now() - rStart, error: !body.includes("Sitemap") ? "Sem Sitemap" : undefined, url: robotsUrl });
    logEntries.push({ ts: new Date().toISOString(), event: status === "passed" ? "test_passed" : "test_failed", detail: `SEO: robots.txt — ${status === "passed" ? "OK" : "Sem Sitemap"}` });
  } catch (e) {
    results.push({ name: "SEO: robots.txt", status: "failed", duration_ms: Date.now() - rStart, error: String(e), url: robotsUrl });
    logEntries.push({ ts: new Date().toISOString(), event: "test_failed", detail: `SEO: robots.txt — ${String(e)}` });
  }
  await updateRunProgress(supabase, runId, results, logEntries, "SEO: robots.txt", robotsUrl, totalExpected);

  return { results, logs: logEntries };
}

async function runApiTests(supabase: ReturnType<typeof getSupabase>, runId: string, existingResults: TestResult[] = [], existingLogs: LogEntry[] = []): Promise<{ results: TestResult[]; logs: LogEntry[] }> {
  const results: TestResult[] = [...existingResults];
  const logEntries: LogEntry[] = [...existingLogs];
  const functions = ["submit-lead", "brasil-api-lookup", "sitemap"];
  const totalExpected = existingResults.length + functions.length + 1; // +1 for DB test

  for (const fn of functions) {
    const url = `${SUPABASE_URL}/functions/v1/${fn}`;
    logEntries.push({ ts: new Date().toISOString(), event: "test_started", detail: `API: ${fn} (OPTIONS) → ${url}` });
    await updateRunProgress(supabase, runId, results, logEntries, `API: ${fn}`, url, totalExpected);

    const start = Date.now();
    try {
      const res = await fetch(url, { method: "OPTIONS", headers: { "Content-Type": "application/json" } });
      const status = res.status <= 204 ? "passed" : "failed";
      results.push({ name: `API: ${fn} (OPTIONS)`, status, duration_ms: Date.now() - start, error: res.status > 204 ? `HTTP ${res.status}` : undefined, url });
      logEntries.push({ ts: new Date().toISOString(), event: status === "passed" ? "test_passed" : "test_failed", detail: `API: ${fn} — ${status === "passed" ? "OK" : `HTTP ${res.status}`}` });
      await res.text();
    } catch (e) {
      results.push({ name: `API: ${fn}`, status: "failed", duration_ms: Date.now() - start, error: String(e), url });
      logEntries.push({ ts: new Date().toISOString(), event: "test_failed", detail: `API: ${fn} — ${String(e)}` });
    }
    await updateRunProgress(supabase, runId, results, logEntries, `API: ${fn}`, url, totalExpected);
  }

  // DB connectivity
  logEntries.push({ ts: new Date().toISOString(), event: "test_started", detail: "API: DB connectivity (leads count)" });
  await updateRunProgress(supabase, runId, results, logEntries, "API: DB connectivity", "supabase/leads", totalExpected);
  const dbStart = Date.now();
  try {
    const { count, error } = await supabase.from("leads").select("*", { count: "exact", head: true });
    const status = error ? "failed" : "passed";
    results.push({ name: "API: DB connectivity (leads count)", status, duration_ms: Date.now() - dbStart, error: error?.message });
    logEntries.push({ ts: new Date().toISOString(), event: status === "passed" ? "test_passed" : "test_failed", detail: `API: DB — ${status === "passed" ? "OK" : error?.message}` });
  } catch (e) {
    results.push({ name: "API: DB connectivity", status: "failed", duration_ms: Date.now() - dbStart, error: String(e) });
    logEntries.push({ ts: new Date().toISOString(), event: "test_failed", detail: `API: DB — ${String(e)}` });
  }
  await updateRunProgress(supabase, runId, results, logEntries, "API: DB", "supabase/leads", totalExpected);

  return { results, logs: logEntries };
}

async function runBlogTests(supabase: ReturnType<typeof getSupabase>, runId: string, existingResults: TestResult[] = [], existingLogs: LogEntry[] = []): Promise<{ results: TestResult[]; logs: LogEntry[] }> {
  const results: TestResult[] = [...existingResults];
  const logEntries: LogEntry[] = [...existingLogs];
  const totalExpected = existingResults.length + 2;
  const url = `${SITE_URL}/blog`;

  logEntries.push({ ts: new Date().toISOString(), event: "test_started", detail: `Blog: página carrega → ${url}` });
  await updateRunProgress(supabase, runId, results, logEntries, "Blog: página carrega", url, totalExpected);

  const start = Date.now();
  try {
    const res = await fetch(url);
    const html = await res.text();
    const status = res.status === 200 ? "passed" : "failed";
    results.push({ name: "Blog: página carrega", status, duration_ms: Date.now() - start, error: res.status !== 200 ? `HTTP ${res.status}` : undefined, url });
    logEntries.push({ ts: new Date().toISOString(), event: status === "passed" ? "test_passed" : "test_failed", detail: `Blog: página — ${status === "passed" ? "OK" : `HTTP ${res.status}`}` });

    const articleLinks = (html.match(/href="\/blog\//g) || []).length;
    const linkStatus = articleLinks >= 1 ? "passed" : "failed";
    results.push({ name: "Blog: contém links para artigos", status: linkStatus, duration_ms: 0, error: articleLinks < 1 ? `Encontrados ${articleLinks} links` : undefined, url });
    logEntries.push({ ts: new Date().toISOString(), event: linkStatus === "passed" ? "test_passed" : "test_failed", detail: `Blog: links — ${linkStatus === "passed" ? `${articleLinks} links encontrados` : "Sem links"}` });
  } catch (e) {
    results.push({ name: "Blog: página carrega", status: "failed", duration_ms: Date.now() - start, error: String(e), url });
    logEntries.push({ ts: new Date().toISOString(), event: "test_failed", detail: `Blog — ${String(e)}` });
  }
  await updateRunProgress(supabase, runId, results, logEntries, "Blog: concluído", url, totalExpected);

  return { results, logs: logEntries };
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

  if (!(await verifyAdmin(req))) {
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
        logs: { entries: [{ ts: new Date().toISOString(), event: "execution_started", detail: "Teste completo iniciado" }], current_spec: null, current_url: null } as any,
      } as any).select().single();

      if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const runId = (run as any).id;

      // Run light tests with incremental progress
      const smoke = await runSmokeTests(supabase, runId);
      const seo = await runSeoTests(supabase, runId, smoke.results, smoke.logs);
      const api = await runApiTests(supabase, runId, seo.results, seo.logs);
      const blog = await runBlogTests(supabase, runId, api.results, api.logs);

      const allResults = blog.results;
      const allLogs = blog.logs;
      const passed = allResults.filter(r => r.status === "passed").length;
      const failed = allResults.filter(r => r.status === "failed").length;

      allLogs.push({ ts: new Date().toISOString(), event: "light_tests_completed", detail: `Testes leves concluídos: ${passed} passaram, ${failed} falharam` });

      await supabase.from("test_runs").update({
        results: allResults as any,
        total_tests: allResults.length,
        passed_tests: passed,
        failed_tests: failed,
        status: failed > 0 ? "partial" : "running",
        logs: { entries: allLogs, current_spec: "Aguardando Cypress...", current_url: null, light_completed: true, cypress_dispatched: false } as any,
      } as any).eq("id", runId);

      // Dispatch Cypress
      for (const ct of CYPRESS_TESTS) {
        await triggerGitHubWorkflow(ct, runId);
      }

      allLogs.push({ ts: new Date().toISOString(), event: "cypress_dispatched", detail: `Cypress disparado via GitHub Actions: ${CYPRESS_TESTS.join(", ")}` });
      await supabase.from("test_runs").update({
        logs: { entries: allLogs, current_spec: "Cypress executando no GitHub Actions...", current_url: null, light_completed: true, cypress_dispatched: true, cypress_types: CYPRESS_TESTS } as any,
      } as any).eq("id", runId);

      return new Response(JSON.stringify({ id: runId, status: "running", light_results: { passed, failed, total: allResults.length } }), {
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
      logs: { entries: [{ ts: new Date().toISOString(), event: "execution_started", detail: `Teste ${testType} iniciado` }], current_spec: null, current_url: null } as any,
    } as any).select().single();

    if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const runId = (run as any).id;

    if (isLight) {
      let result: { results: TestResult[]; logs: LogEntry[] };
      switch (testType) {
        case "smoke": result = await runSmokeTests(supabase, runId); break;
        case "seo": result = await runSeoTests(supabase, runId); break;
        case "api": result = await runApiTests(supabase, runId); break;
        case "blog": result = await runBlogTests(supabase, runId); break;
        default: result = { results: [], logs: [] };
      }

      const passed = result.results.filter(r => r.status === "passed").length;
      const failed = result.results.filter(r => r.status === "failed").length;
      const duration = result.results.reduce((sum, r) => sum + r.duration_ms, 0);

      result.logs.push({ ts: new Date().toISOString(), event: "execution_completed", detail: `Concluído: ${passed} passaram, ${failed} falharam` });

      await supabase.from("test_runs").update({
        status: failed > 0 ? "failed" : "success",
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        total_tests: result.results.length,
        passed_tests: passed,
        failed_tests: failed,
        results: result.results as any,
        error_message: failed > 0 ? `${failed} teste(s) falharam` : null,
        logs: { entries: result.logs, current_spec: null, current_url: null, completed: true } as any,
      } as any).eq("id", runId);

      if (failed > 0) {
        await dispatchAlert({ id: runId, test_type: testType, suite: "light", status: "failed", error_message: `${failed} teste(s) falharam`, total_tests: result.results.length, passed_tests: passed, failed_tests: failed });
      }

      return new Response(JSON.stringify({ id: runId, status: failed > 0 ? "failed" : "success", results: result.results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cypress — dispatch to GitHub with estimated spec count
    const specCounts: Record<string, number> = {
      frontend: 4, business: 1, forms: 1, contracts: 1, checkout: 1, portal: 1, regression: 10,
    };
    const estimatedTotal = specCounts[testType] || 5;

    await supabase.from("test_runs").update({
      total_tests: estimatedTotal,
      logs: {
        entries: [
          { ts: new Date().toISOString(), event: "execution_started", detail: `Cypress ${testType} disparado` },
          { ts: new Date().toISOString(), event: "cypress_dispatched", detail: "Aguardando GitHub Actions iniciar..." },
        ],
        current_spec: "Aguardando GitHub Actions...",
        current_url: null,
        estimated_total: estimatedTotal,
      } as any,
    } as any).eq("id", runId);

    const dispatch = await triggerGitHubWorkflow(testType, runId);
    if (!dispatch.success) {
      await supabase.from("test_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: dispatch.error,
        logs: {
          entries: [
            { ts: new Date().toISOString(), event: "execution_started", detail: `Cypress ${testType} disparado` },
            { ts: new Date().toISOString(), event: "dispatch_failed", detail: dispatch.error || "Falha ao disparar GitHub Actions" },
          ],
          current_spec: null,
          current_url: null,
        } as any,
      } as any).eq("id", runId);

      await dispatchAlert({ id: runId, test_type: testType, suite: "cypress", status: "failed", error_message: dispatch.error });

      return new Response(JSON.stringify({ id: runId, status: "failed", error: dispatch.error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: runId, status: "running", engine: "github_actions" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
