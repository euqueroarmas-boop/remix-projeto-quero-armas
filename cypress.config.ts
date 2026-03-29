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
      // ─── Event Bridge: Cypress → Ingest API ───
      // Variables come from process.env (set by GitHub Actions env: block)
      const supabaseUrl = process.env.SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_KEY || "";
      const runId = process.env.RUN_ID || "";
      const ingestToken = process.env.INGEST_TOKEN || "";
      const ingestUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/ingest-test-events` : "";

      // Log bridge status for debugging
      console.log(`[WMTi Bridge] SUPABASE_URL: ${supabaseUrl ? "SET" : "MISSING"}`);
      console.log(`[WMTi Bridge] SUPABASE_KEY: ${supabaseKey ? "SET" : "MISSING"}`);
      console.log(`[WMTi Bridge] RUN_ID: ${runId || "MISSING"}`);
      console.log(`[WMTi Bridge] INGEST_TOKEN: ${ingestToken ? "SET" : "MISSING"}`);
      console.log(`[WMTi Bridge] Ingest URL: ${ingestUrl || "DISABLED"}`);

      let totalSpecs = 0;
      let specsCompleted = 0;
      let totalTests = 0;
      let passedTests = 0;
      let failedTests = 0;
      let skippedTests = 0;

      // Helper to send events to the ingest API
      async function sendEvents(
        events: Array<Record<string, unknown>>,
        progress?: Record<string, unknown>
      ) {
        if (!ingestUrl || !runId || !ingestToken) {
          console.log(`[WMTi Bridge] sendEvents SKIPPED — missing: ${!ingestUrl ? "ingestUrl " : ""}${!runId ? "runId " : ""}${!ingestToken ? "ingestToken" : ""}`);
          return;
        }
        try {
          const res = await fetch(ingestUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              run_id: runId,
              token: ingestToken,
              events,
              progress,
            }),
          });
          console.log(`[WMTi Bridge] sendEvents ${events.length} events → ${res.status}`);
        } catch (err) {
          console.error(`[WMTi Bridge] sendEvents FAILED:`, err);
        }
      }

      // Helper to update test_runs directly (fallback / legacy)
      async function patchRun(payload: Record<string, unknown>) {
        if (!supabaseUrl || !supabaseKey || !runId) {
          console.log(`[WMTi Bridge] patchRun SKIPPED — missing vars`);
          return;
        }
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/test_runs?id=eq.${runId}`, {
            method: "PATCH",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(payload),
          });
          console.log(`[WMTi Bridge] patchRun → ${res.status}`);
        } catch (err) {
          console.error(`[WMTi Bridge] patchRun FAILED:`, err);
        }
      }

      on("before:run", async (details) => {
        totalSpecs = details.specs?.length || 0;
        specsCompleted = 0;
        totalTests = 0;
        passedTests = 0;
        failedTests = 0;
        skippedTests = 0;

        await sendEvents(
          [
            {
              event_type: "execution_started",
              payload: {
                total_specs: totalSpecs,
                browser: details.browser?.name,
                cypress_version: details.cypressVersion,
              },
            },
          ],
          { total_specs: totalSpecs }
        );

        // Also do legacy PATCH for compatibility
        await patchRun({
          total_specs: totalSpecs,
          current_spec: "Iniciando...",
          progress_percent: 0,
          logs: {
            entries: [
              {
                ts: new Date().toISOString(),
                event: "cypress_started",
                detail: `Cypress iniciado com ${totalSpecs} specs`,
              },
            ],
            current_spec: "Iniciando...",
            current_url: null,
            total_specs: totalSpecs,
            specs_completed: 0,
          },
        });
      });

      on("after:spec", async (spec, results) => {
        specsCompleted++;
        const specName = spec.relative || spec.name || "unknown";
        const passes = results.stats?.passes || 0;
        const failures = results.stats?.failures || 0;
        const tests = results.stats?.tests || 0;
        const pending = results.stats?.pending || 0;
        const duration = results.stats?.duration || 0;

        passedTests += passes;
        failedTests += failures;
        skippedTests += pending;
        totalTests += tests;

        // Build events for each test in this spec
        const testEvents: Array<Record<string, unknown>> = [];

        // Add spec_completed event
        testEvents.push({
          event_type: "spec_completed",
          spec_name: specName,
          status: failures > 0 ? "failed" : "passed",
          duration_ms: duration,
          payload: { passes, failures, tests, pending },
        });

        // Extract individual test results from mochawesome if available
        if (results.tests) {
          for (const test of results.tests) {
            const attempts = test.attempts || [];
            const lastAttempt = attempts[attempts.length - 1];
            const testStatus = lastAttempt?.state || "unknown";
            const testError = lastAttempt?.error?.message;
            const testStack = lastAttempt?.error?.stack;

            testEvents.push({
              event_type: testStatus === "passed" ? "test_passed" : testStatus === "failed" ? "test_failed" : "test_skipped",
              spec_name: specName,
              test_name: test.title?.join(" > ") || "unknown",
              status: testStatus,
              duration_ms: lastAttempt?.duration || 0,
              error_message: testError || undefined,
              stack_trace: testStack || undefined,
            });
          }
        }

        await sendEvents(testEvents, {
          total_tests: totalTests,
          total_specs: totalSpecs,
          completed_specs: specsCompleted,
          completed_tests: passedTests + failedTests + skippedTests,
          passed_tests: passedTests,
          failed_tests: failedTests,
          skipped_tests: skippedTests,
        });

        // Legacy PATCH
        const nextSpec =
          specsCompleted < totalSpecs
            ? `Spec ${specsCompleted + 1} de ${totalSpecs}`
            : "Finalizando...";

        await patchRun({
          total_tests: totalTests > 0 ? totalTests : totalSpecs,
          passed_tests: passedTests,
          failed_tests: failedTests,
          skipped_tests: skippedTests,
          completed_tests: passedTests + failedTests + skippedTests,
          completed_specs: specsCompleted,
          total_specs: totalSpecs,
          current_spec: nextSpec,
          progress_percent: Math.min(
            100,
            Math.round(
              ((passedTests + failedTests + skippedTests) /
                Math.max(totalTests, 1)) *
                100
            )
          ),
          last_event_at: new Date().toISOString(),
        });
      });

      return config;
    },
  },
});
