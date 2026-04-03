import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getStatusLabel(level: number): string {
  if (level <= 20) return "calmo";
  if (level <= 40) return "atento";
  if (level <= 60) return "tenso";
  if (level <= 80) return "critico";
  return "conflito";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/pulse-api\/?/, "");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate user via Bearer token
  const authHeader = req.headers.get("authorization");
  let userId = "anonymous";

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = user.id;
  }

  try {
    // POST /emotion/log
    if (req.method === "POST" && path === "emotion/log") {
      const body = await req.json();
      const level = Number(body.manual_level ?? body.level ?? 0);
      if (level < 0 || level > 100) {
        return jsonResponse({ error: "level must be 0-100" }, 400);
      }

      const { error } = await supabase.from("emotion_logs").insert({
        manual_level: level,
        status_label: getStatusLabel(level),
        session_id: body.session_id || null,
        user_id: userId,
        source_type: body.source_type || "manual",
        device_type: body.device_type || "web",
        device_id: body.device_id || null,
        bio_source: body.bio_source || "none",
        data_mode: body.data_mode || "real",
        heart_rate: body.heart_rate || null,
        hrv: body.hrv || null,
        sleep_score: body.sleep_score || null,
      });

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, level, status: getStatusLabel(level) });
    }

    // POST /bio/ingest
    if (req.method === "POST" && path === "bio/ingest") {
      const body = await req.json();

      // Validate bio data
      if (!body.heart_rate && !body.hrv && !body.sleep_score) {
        return jsonResponse({ error: "At least one bio metric required" }, 400);
      }

      const hr = body.heart_rate ? Number(body.heart_rate) : null;
      const hrv = body.hrv ? Number(body.hrv) : null;
      const sleep = body.sleep_score ? Number(body.sleep_score) : null;

      if (hr !== null && (hr < 30 || hr > 250)) return jsonResponse({ error: "heart_rate out of range (30-250)" }, 400);
      if (hrv !== null && (hrv < 0 || hrv > 300)) return jsonResponse({ error: "hrv out of range (0-300)" }, 400);
      if (sleep !== null && (sleep < 0 || sleep > 100)) return jsonResponse({ error: "sleep_score out of range (0-100)" }, 400);

      const { error } = await supabase.from("emotion_logs").insert({
        manual_level: 0,
        status_label: "bio_only",
        user_id: userId,
        source_type: body.source_type || "ios_watch",
        device_type: body.device_type || "watch",
        device_id: body.device_id || null,
        bio_source: body.bio_source || "ios_watch",
        data_mode: "real",
        heart_rate: hr,
        hrv: hrv,
        sleep_score: sleep,
      });

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, ingested: { heart_rate: hr, hrv, sleep_score: sleep } });
    }

    // GET /bio/latest
    if (req.method === "GET" && path === "bio/latest") {
      const { data, error } = await supabase
        .from("emotion_logs")
        .select("heart_rate,hrv,sleep_score,bio_source,device_type,device_id,created_at")
        .eq("user_id", userId)
        .not("heart_rate", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data: data || null });
    }

    // GET /user/state
    if (req.method === "GET" && path === "user/state") {
      const today = new Date().toISOString().slice(0, 10);

      // Latest emotion
      const { data: latest } = await supabase
        .from("emotion_logs")
        .select("manual_level,status_label,created_at,device_type")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Today's count
      const { data: todayLogs } = await supabase
        .from("emotion_logs")
        .select("manual_level")
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`);

      const count = todayLogs?.length || 0;
      const avg = count > 0
        ? Math.round((todayLogs as any[]).reduce((a, b) => a + b.manual_level, 0) / count)
        : 0;

      // Streak
      const { data: streak } = await supabase
        .from("user_streaks")
        .select("current_streak,longest_streak,consistency_score")
        .eq("user_id", userId)
        .maybeSingle();

      return jsonResponse({
        current: latest || null,
        today: { count, average: avg },
        streak: streak || { current_streak: 0, longest_streak: 0, consistency_score: 0 },
      });
    }

    return jsonResponse({ error: "Not found", routes: ["POST emotion/log", "POST bio/ingest", "GET bio/latest", "GET user/state"] }, 404);

  } catch (e: any) {
    return jsonResponse({ error: e.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
