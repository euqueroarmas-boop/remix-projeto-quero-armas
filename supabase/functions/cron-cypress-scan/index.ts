import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GITHUB_PAT = Deno.env.get("GITHUB_PAT")!;
  const GITHUB_REPO = "euqueroarmas-boop/dell-shine-solutions";
  const SITE_URL = "https://dell-shine-solutions.lovable.app";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check if there's already a run in progress (avoid overlapping)
  const { data: activeRuns } = await supabase
    .from("test_runs")
    .select("id")
    .eq("status", "running")
    .limit(1);

  if (activeRuns && activeRuns.length > 0) {
    console.log("[cron-cypress-scan] Skipping — a test run is already in progress");
    return new Response(JSON.stringify({ skipped: true, reason: "run_in_progress" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[cron-cypress-scan] Starting automated full site scan...");

  const LIGHT_TESTS = ["smoke", "seo", "api", "blog"];
  const CYPRESS_TESTS = ["frontend", "business", "forms", "contracts", "checkout", "portal", "regression"];

  // Generate ingest token
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const ingestToken = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

  // Create the run record
  const { data: run, error: insertErr } = await supabase.from("test_runs").insert({
    suite: "full",
    test_type: "full",
    status: "running",
    started_at: new Date().toISOString(),
    triggered_by: "cron",
    execution_engine: "hybrid",
    base_url: SITE_URL,
    ingest_token: ingestToken,
    progress_percent: 0,
    logs: {
      entries: [{ ts: new Date().toISOString(), event: "execution_started", detail: "Scan automático (cron 6h) iniciado" }],
      current_spec: null,
      current_url: null,
    },
  } as any).select().single();

  if (insertErr) {
    console.error("[cron-cypress-scan] Failed to create run:", insertErr.message);
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const runId = (run as any).id;

  // ── Run light tests inline ──
  interface TestResult {
    name: string;
    status: "passed" | "failed" | "skipped";
    duration_ms: number;
    error?: string;
    url?: string;
  }

  const results: TestResult[] = [];
  const logEntries: Array<{ ts: string; event: string; detail?: string }> = [
    { ts: new Date().toISOString(), event: "execution_started", detail: "Scan automático (cron 6h) iniciado" },
  ];

  // Smoke test all main pages
  const smokePages = [
    { name: "Home", path: "/" },
    { name: "Serviços", path: "/servicos" },
    { name: "Suporte TI", path: "/suporte-de-ti" },
    { name: "Admin Servidores", path: "/administracao-de-servidores" },
    { name: "Locação", path: "/locacao-de-computadores" },
    { name: "Orçamento", path: "/orcamento-ti" },
    { name: "Blog", path: "/blog" },
    { name: "Sobre", path: "/sobre" },
    { name: "Institucional", path: "/institucional" },
    { name: "Infraestrutura", path: "/infraestrutura-corporativa" },
    { name: "Segurança", path: "/seguranca-de-rede" },
    { name: "Terceirização", path: "/terceirizacao-de-ti" },
    { name: "Backup", path: "/backup-corporativo" },
    { name: "Microsoft 365", path: "/microsoft-365" },
    { name: "Firewall", path: "/firewall-pfsense" },
    { name: "Montagem Redes", path: "/montagem-redes-corporativas" },
    { name: "Monitoramento", path: "/monitoramento-de-rede" },
    { name: "Cartórios", path: "/ti-para-cartorios" },
    { name: "Contabilidades", path: "/ti-para-contabilidades" },
    { name: "Escritórios", path: "/ti-para-escritorios-corporativos" },
    { name: "Advocacia", path: "/ti-para-escritorios-advocacia" },
    { name: "Hospitais", path: "/ti-para-hospitais-clinicas" },
    { name: "Área do Cliente", path: "/area-do-cliente" },
  ];

  for (const page of smokePages) {
    const url = `${SITE_URL}${page.path}`;
    const start = Date.now();
    try {
      const res = await fetch(url, { redirect: "follow" });
      const body = await res.text();
      const ok = res.status === 200 && body.length > 500;
      results.push({
        name: `Smoke: ${page.name}`,
        status: ok ? "passed" : "failed",
        duration_ms: Date.now() - start,
        error: !ok ? `HTTP ${res.status}, body ${body.length} bytes` : undefined,
        url,
      });
    } catch (e) {
      results.push({ name: `Smoke: ${page.name}`, status: "failed", duration_ms: Date.now() - start, error: String(e), url });
    }
  }

  // SEO checks
  const seoPages = ["/", "/blog", "/administracao-de-servidores", "/suporte-de-ti", "/locacao-de-computadores"];
  for (const path of seoPages) {
    const url = `${SITE_URL}${path}`;
    const start = Date.now();
    try {
      const res = await fetch(url);
      const html = await res.text();
      const errors: string[] = [];
      if (!/<title[^>]*>.+<\/title>/i.test(html)) errors.push("Sem <title>");
      if (!/meta\s+name=["']description["']/i.test(html)) errors.push("Sem meta description");
      if (!/<h1[\s>]/i.test(html)) errors.push("Sem <h1>");
      results.push({
        name: `SEO: ${path}`,
        status: errors.length === 0 ? "passed" : "failed",
        duration_ms: Date.now() - start,
        error: errors.length > 0 ? errors.join("; ") : undefined,
        url,
      });
    } catch (e) {
      results.push({ name: `SEO: ${path}`, status: "failed", duration_ms: Date.now() - start, error: String(e), url });
    }
  }

  // Sitemap + robots
  for (const file of ["sitemap.xml", "robots.txt"]) {
    const url = `${SITE_URL}/${file}`;
    const start = Date.now();
    try {
      const res = await fetch(url);
      const body = await res.text();
      const valid = file === "sitemap.xml"
        ? body.includes("<sitemapindex") || body.includes("<urlset")
        : body.includes("Sitemap");
      results.push({
        name: `SEO: ${file}`,
        status: res.status === 200 && valid ? "passed" : "failed",
        duration_ms: Date.now() - start,
        error: !valid ? `${file} inválido` : undefined,
        url,
      });
    } catch (e) {
      results.push({ name: `SEO: ${file}`, status: "failed", duration_ms: Date.now() - start, error: String(e), url });
    }
  }

  // API checks
  const apiEndpoints = [
    { name: "submit-lead", path: "/functions/v1/submit-lead" },
    { name: "register-log", path: "/functions/v1/register-log" },
    { name: "blog-prerender", path: "/functions/v1/blog-prerender" },
  ];
  for (const ep of apiEndpoints) {
    const url = `${SUPABASE_URL}${ep.path}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
        body: "{}",
      });
      await res.text();
      // 400 is acceptable (means function is alive but input is invalid)
      const alive = res.status < 500;
      results.push({
        name: `API: ${ep.name}`,
        status: alive ? "passed" : "failed",
        duration_ms: Date.now() - start,
        error: !alive ? `HTTP ${res.status}` : undefined,
        url,
      });
    } catch (e) {
      results.push({ name: `API: ${ep.name}`, status: "failed", duration_ms: Date.now() - start, error: String(e), url });
    }
  }

  const passed = results.filter(r => r.status === "passed").length;
  const failed = results.filter(r => r.status === "failed").length;

  logEntries.push({ ts: new Date().toISOString(), event: "light_tests_completed", detail: `Testes leves: ${passed} OK, ${failed} falhas` });

  // Update run with light results
  await supabase.from("test_runs").update({
    results: results as any,
    total_tests: results.length,
    passed_tests: passed,
    failed_tests: failed,
    status: failed > 0 ? "partial" : "running",
    logs: { entries: logEntries, current_spec: "Disparando Cypress...", current_url: null, light_completed: true } as any,
  } as any).eq("id", runId);

  // ── Dispatch all Cypress workflows (fire-and-forget) ──
  let dispatched = 0;
  for (const ct of CYPRESS_TESTS) {
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
              test_type: ct,
              run_id: runId,
              base_url: SITE_URL,
              supabase_url: SUPABASE_URL,
              supabase_key: SUPABASE_SERVICE_KEY,
              ingest_token: ingestToken,
            },
          }),
        }
      );
      if (res.status === 204) dispatched++;
      else await res.text();
    } catch (e) {
      console.error(`[cron-cypress-scan] Failed to dispatch ${ct}:`, e);
    }
  }

  logEntries.push({
    ts: new Date().toISOString(),
    event: "cypress_dispatched",
    detail: `Cypress: ${dispatched}/${CYPRESS_TESTS.length} workflows disparados`,
  });

  await supabase.from("test_runs").update({
    logs: {
      entries: logEntries,
      current_spec: "Cypress executando no GitHub Actions...",
      current_url: null,
      light_completed: true,
      cypress_dispatched: true,
      cypress_types: CYPRESS_TESTS,
    } as any,
  } as any).eq("id", runId);

  // ── If light tests already failed, dispatch alert immediately ──
  if (failed > 0) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/test-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_alert",
          payload: {
            run_id: runId,
            test_type: "full",
            suite: "full",
            status: "failed",
            error_message: `Scan automático: ${failed} falha(s) detectada(s) em testes leves`,
            total_tests: results.length,
            passed_tests: passed,
            failed_tests: failed,
          },
        }),
      });
    } catch (e) {
      console.error("[cron-cypress-scan] Alert dispatch failed:", e);
    }
  }

  console.log(`[cron-cypress-scan] Completed. Light: ${passed}/${results.length} OK. Cypress: ${dispatched} dispatched.`);

  return new Response(JSON.stringify({
    run_id: runId,
    light: { passed, failed, total: results.length },
    cypress_dispatched: dispatched,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
