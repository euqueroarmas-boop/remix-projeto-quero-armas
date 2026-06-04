import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * Ingest endpoint for test run events.
 * Auth: ephemeral ingest_token generated per run.
 * 
 * POST /ingest-test-events
 * Body: { run_id, token, events: [...] }
 * 
 * POST /ingest-test-events?action=finalize
 * Body: { run_id, token, status, duration_ms, error_summary, results }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();

  try {
    const body = await req.json();
    const { run_id, token } = body;

    if (!run_id || !token) {
      return new Response(JSON.stringify({ error: "run_id and token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ephemeral token
    const { data: run, error: runErr } = await supabase
      .from("test_runs")
      .select("id, ingest_token, status")
      .eq("id", run_id)
      .single();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (run.ingest_token !== token) {
      return new Response(JSON.stringify({ error: "Invalid ingest token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ─── FINALIZE ───
    if (action === "finalize") {
      const {
        status: finalStatus,
        duration_ms,
        error_summary,
        total_tests,
        passed_tests,
        failed_tests,
        skipped_tests,
        results,
        screenshot_urls,
        video_urls,
        report_url,
      } = body;

      await supabase.from("test_runs").update({
        status: finalStatus || "success",
        finished_at: new Date().toISOString(),
        duration_ms: duration_ms || null,
        error_summary: error_summary || null,
        error_message: error_summary || null,
        total_tests: total_tests || 0,
        passed_tests: passed_tests || 0,
        failed_tests: failed_tests || 0,
        skipped_tests: skipped_tests || 0,
        completed_tests: (passed_tests || 0) + (failed_tests || 0) + (skipped_tests || 0),
        progress_percent: 100,
        current_spec: null,
        current_test: null,
        current_url: null,
        results: results || null,
        screenshot_urls: screenshot_urls || null,
        video_urls: video_urls || null,
        report_url: report_url || null,
        last_event_at: new Date().toISOString(),
        ingest_token: null, // Invalidate token
      } as any).eq("id", run_id);

      // Insert completion event
      await supabase.from("test_run_events").insert({
        run_id,
        event_type: "execution_completed",
        status: finalStatus,
        payload: { total_tests, passed_tests, failed_tests, skipped_tests },
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── INGEST EVENTS ───
    const events = body.events as Array<{
      event_type: string;
      spec_name?: string;
      test_name?: string;
      url?: string;
      status?: string;
      duration_ms?: number;
      error_message?: string;
      stack_trace?: string;
      payload?: any;
    }>;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: "events array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert events
    const eventRows = events.map((e) => ({
      run_id,
      event_type: e.event_type,
      spec_name: e.spec_name || null,
      test_name: e.test_name || null,
      url: e.url || null,
      status: e.status || null,
      duration_ms: e.duration_ms || null,
      error_message: e.error_message || null,
      stack_trace: e.stack_trace || null,
      payload: e.payload || {},
    }));

    await supabase.from("test_run_events").insert(eventRows);

    // Update test_runs with latest state from events
    const lastEvent = events[events.length - 1];
    const updatePayload: Record<string, any> = {
      last_event_at: new Date().toISOString(),
    };

    if (lastEvent.spec_name) updatePayload.current_spec = lastEvent.spec_name;
    if (lastEvent.test_name) updatePayload.current_test = lastEvent.test_name;
    if (lastEvent.url) updatePayload.current_url = lastEvent.url;

    // Aggregate counts from events for this run
    if (body.progress) {
      const p = body.progress;
      if (p.total_tests !== undefined) updatePayload.total_tests = p.total_tests;
      if (p.total_specs !== undefined) updatePayload.total_specs = p.total_specs;
      if (p.completed_specs !== undefined) updatePayload.completed_specs = p.completed_specs;
      if (p.completed_tests !== undefined) updatePayload.completed_tests = p.completed_tests;
      if (p.passed_tests !== undefined) updatePayload.passed_tests = p.passed_tests;
      if (p.failed_tests !== undefined) updatePayload.failed_tests = p.failed_tests;
      if (p.skipped_tests !== undefined) updatePayload.skipped_tests = p.skipped_tests;

      const total = p.total_tests || 1;
      const completed = (p.passed_tests || 0) + (p.failed_tests || 0) + (p.skipped_tests || 0);
      updatePayload.progress_percent = Math.min(100, Math.round((completed / total) * 100));
    }

    if (lastEvent.error_message) {
      updatePayload.error_summary = lastEvent.error_message;
    }

    await supabase.from("test_runs").update(updatePayload as any).eq("id", run_id);

    return new Response(JSON.stringify({ ok: true, ingested: events.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ingest-test-events] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
