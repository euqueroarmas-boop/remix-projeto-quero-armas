import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "https://dell-shine-solutions.lovable.app",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    videoCompression: true,
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
      const supabaseUrl = process.env.SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_KEY || "";
      const runId = process.env.RUN_ID || "";
      const ingestToken = process.env.INGEST_TOKEN || "";
      const ingestUrl = supabaseUrl
        ? `${supabaseUrl}/functions/v1/ingest-test-events`
        : "";

      console.log(`[WMTi Bridge] ── CONFIG ──`);
      console.log(`[WMTi Bridge] SUPABASE_URL: ${supabaseUrl ? "SET (" + supabaseUrl.substring(0, 30) + "...)" : "MISSING"}`);
      console.log(`[WMTi Bridge] SUPABASE_KEY: ${supabaseKey ? "SET (" + supabaseKey.length + " chars)" : "MISSING"}`);
      console.log(`[WMTi Bridge] RUN_ID: ${runId || "MISSING"}`);
      console.log(`[WMTi Bridge] INGEST_TOKEN: ${ingestToken ? "SET (" + ingestToken.length + " chars)" : "MISSING"}`);
      console.log(`[WMTi Bridge] Ingest URL: ${ingestUrl || "DISABLED"}`);

      let totalSpecs = 0;
      let specsCompleted = 0;
      let totalTests = 0;
      let passedTests = 0;
      let failedTests = 0;
      let skippedTests = 0;

      // Helper: send events to ingest API with full error logging
      async function sendEvents(
        events: Array<Record<string, unknown>>,
        progress?: Record<string, unknown>
      ) {
        if (!ingestUrl || !runId || !ingestToken) {
          console.log(
            `[WMTi Bridge] sendEvents SKIPPED — missing: ${!ingestUrl ? "ingestUrl " : ""}${!runId ? "runId " : ""}${!ingestToken ? "ingestToken" : ""}`
          );
          return;
        }
        try {
          const payload = JSON.stringify({
            run_id: runId,
            token: ingestToken,
            events,
            progress,
          });
          console.log(`[WMTi Bridge] sendEvents → ${events.length} events, payload ${payload.length} bytes`);
          const res = await fetch(ingestUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });
          const resBody = await res.text();
          console.log(`[WMTi Bridge] sendEvents response: ${res.status} ${resBody.substring(0, 200)}`);
        } catch (err) {
          console.error(`[WMTi Bridge] sendEvents FAILED:`, err);
        }
      }

      // Helper: direct PATCH to test_runs (always works if key is valid)
      async function patchRun(payload: Record<string, unknown>) {
        if (!supabaseUrl || !supabaseKey || !runId) {
          console.log(`[WMTi Bridge] patchRun SKIPPED — missing: ${!supabaseUrl ? "url " : ""}${!supabaseKey ? "key " : ""}${!runId ? "runId" : ""}`);
          return;
        }
        try {
          const body = JSON.stringify(payload);
          console.log(`[WMTi Bridge] patchRun → ${body.length} bytes`);
          const res = await fetch(
            `${supabaseUrl}/rest/v1/test_runs?id=eq.${runId}`,
            {
              method: "PATCH",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body,
            }
          );
          console.log(`[WMTi Bridge] patchRun response: ${res.status}`);
          await res.text(); // consume body
        } catch (err) {
          console.error(`[WMTi Bridge] patchRun FAILED:`, err);
        }
      }

      // ─── BEFORE:RUN ───
      on("before:run", async (details) => {
        totalSpecs = details.specs?.length || 0;
        console.log(`[WMTi Bridge] ══ before:run ══ specs=${totalSpecs} browser=${details.browser?.name}`);

        await sendEvents(
          [{ event_type: "execution_started", payload: { total_specs: totalSpecs, browser: details.browser?.name } }],
          { total_specs: totalSpecs }
        );

        await patchRun({
          total_specs: totalSpecs,
          current_spec: "Iniciando specs...",
          progress_percent: 2,
        });
      });

      // ─── AFTER:SPEC ───
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

        console.log(`[WMTi Bridge] ══ after:spec ══ ${specName} — tests=${tests} passed=${passes} failed=${failures} pending=${pending} duration=${duration}ms`);

        const testEvents: Array<Record<string, unknown>> = [];

        testEvents.push({
          event_type: "spec_completed",
          spec_name: specName,
          status: failures > 0 ? "failed" : "passed",
          duration_ms: duration,
          payload: { passes, failures, tests, pending },
        });

        // Emit individual test results
        if (results.tests) {
          for (const test of results.tests) {
            const attempts = test.attempts || [];
            const lastAttempt = attempts[attempts.length - 1];
            const testStatus = lastAttempt?.state || "unknown";
            const testError = lastAttempt?.error?.message || lastAttempt?.error?.name;
            const testStack = lastAttempt?.error?.stack || lastAttempt?.error?.codeFrame?.frame;

            testEvents.push({
              event_type: testStatus === "passed" ? "test_passed" : testStatus === "failed" ? "test_failed" : "test_skipped",
              spec_name: specName,
              test_name: Array.isArray(test.title) ? test.title.join(" > ") : test.title || "unknown",
              status: testStatus,
              duration_ms: lastAttempt?.duration || 0,
              error_message: testError || undefined,
              stack_trace: testStack || undefined,
            });
          }
        }

        console.log(`[WMTi Bridge] Sending ${testEvents.length} events for spec ${specName}`);

        await sendEvents(testEvents, {
          total_tests: totalTests,
          total_specs: totalSpecs,
          completed_specs: specsCompleted,
          completed_tests: passedTests + failedTests + skippedTests,
          passed_tests: passedTests,
          failed_tests: failedTests,
          skipped_tests: skippedTests,
        });

        const progressPercent = Math.min(95, Math.round((specsCompleted / Math.max(totalSpecs, 1)) * 100));
        const nextSpec = specsCompleted < totalSpecs
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
          progress_percent: progressPercent,
          last_event_at: new Date().toISOString(),
        });

        console.log(`[WMTi Bridge] after:spec done — progress=${progressPercent}%`);
      });

      // ─── AFTER:RUN ───
      on("after:run", async (results) => {
        const finalTotalTests = results?.totalTests || totalTests;
        const finalPassed = results?.totalPassed || passedTests;
        const finalFailed = results?.totalFailed || failedTests;
        const finalSkipped = results?.totalSkipped || skippedTests;
        const finalDuration = results?.totalDuration || 0;
        const finalStatus = (finalFailed || 0) > 0 ? "failed" : "success";

        console.log(`[WMTi Bridge] ══ after:run ══ status=${finalStatus} total=${finalTotalTests} passed=${finalPassed} failed=${finalFailed} skipped=${finalSkipped} duration=${finalDuration}ms`);

        // Build error summary
        let errorSummary: string | null = null;
        if (finalFailed > 0 && results?.runs) {
          const errors: string[] = [];
          for (const run of results.runs) {
            if (run.tests) {
              for (const test of run.tests) {
                const lastAttempt = test.attempts?.[test.attempts.length - 1];
                if (lastAttempt?.state === "failed" && lastAttempt?.error?.message) {
                  const testName = Array.isArray(test.title) ? test.title.join(" > ") : test.title;
                  errors.push(`${testName}: ${lastAttempt.error.message.substring(0, 200)}`);
                }
              }
            }
          }
          errorSummary = errors.length > 0 ? errors.join(" | ").substring(0, 1000) : `${finalFailed} test(s) failed`;
        }

        // Finalize via ingest API
        await sendEvents(
          [{ event_type: "execution_completed", status: finalStatus, payload: { total_tests: finalTotalTests, passed_tests: finalPassed, failed_tests: finalFailed, skipped_tests: finalSkipped } }]
        );

        // Direct PATCH (definitive)
        await patchRun({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          duration_ms: finalDuration,
          total_tests: finalTotalTests,
          passed_tests: finalPassed,
          failed_tests: finalFailed,
          skipped_tests: finalSkipped,
          completed_tests: finalPassed + finalFailed + finalSkipped,
          progress_percent: 100,
          current_spec: null,
          current_test: null,
          current_url: null,
          error_message: errorSummary,
          error_summary: errorSummary,
          last_event_at: new Date().toISOString(),
        });

        console.log(`[WMTi Bridge] after:run COMPLETE`);
      });

      return config;
    },
  },
});
