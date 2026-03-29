import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "https://dell-shine-solutions.lovable.app",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    videoCompression: 32,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    reporter: "mochawesome",
    reporterOptions: {
      reportDir: "cypress/results",
      overwrite: false,
      html: false,
      json: true,
      quiet: true,
    },
    setupNodeEvents(on, config) {
      // Track spec-level progress and report to Supabase
      const supabaseUrl = process.env.SUPABASE_URL || config.env.SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_KEY || config.env.SUPABASE_KEY || "";
      const runId = process.env.RUN_ID || config.env.RUN_ID || "";

      let specsCompleted = 0;
      let totalSpecs = 0;
      let specResults: Array<{ spec: string; status: string; tests: number; passes: number; failures: number; duration: number }> = [];

      on("before:run", (details) => {
        totalSpecs = details.specs?.length || 0;
        specsCompleted = 0;
        specResults = [];

        if (supabaseUrl && supabaseKey && runId) {
          const payload = JSON.stringify({
            total_tests: totalSpecs,
            logs: {
              entries: [
                { ts: new Date().toISOString(), event: "cypress_started", detail: `Cypress iniciado com ${totalSpecs} specs` },
              ],
              current_spec: "Iniciando...",
              current_url: null,
              total_specs: totalSpecs,
              specs_completed: 0,
            },
          });

          fetch(`${supabaseUrl}/rest/v1/test_runs?id=eq.${runId}`, {
            method: "PATCH",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: payload,
          }).catch(() => {});
        }
      });

      on("after:spec", (spec, results) => {
        specsCompleted++;
        const specName = spec.relative || spec.name || "unknown";
        const passes = results.stats?.passes || 0;
        const failures = results.stats?.failures || 0;
        const tests = results.stats?.tests || 0;
        const duration = results.stats?.duration || 0;

        specResults.push({
          spec: specName,
          status: failures > 0 ? "failed" : "passed",
          tests,
          passes,
          failures,
          duration,
        });

        if (supabaseUrl && supabaseKey && runId) {
          const totalPassed = specResults.reduce((s, r) => s + r.passes, 0);
          const totalFailed = specResults.reduce((s, r) => s + r.failures, 0);
          const totalTests = specResults.reduce((s, r) => s + r.tests, 0);

          const entries = specResults.map(r => ({
            ts: new Date().toISOString(),
            event: r.failures > 0 ? "spec_failed" : "spec_passed",
            detail: `${r.spec} — ${r.passes}✓ ${r.failures}✗ (${r.duration}ms)`,
          }));

          const payload = JSON.stringify({
            total_tests: totalTests > 0 ? totalTests : totalSpecs,
            passed_tests: totalPassed,
            failed_tests: totalFailed,
            logs: {
              entries,
              current_spec: specsCompleted < totalSpecs ? `Spec ${specsCompleted + 1} de ${totalSpecs}` : "Finalizando...",
              current_url: null,
              total_specs: totalSpecs,
              specs_completed: specsCompleted,
              spec_results: specResults,
            },
          });

          fetch(`${supabaseUrl}/rest/v1/test_runs?id=eq.${runId}`, {
            method: "PATCH",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: payload,
          }).catch(() => {});
        }
      });

      return config;
    },
  },
});
