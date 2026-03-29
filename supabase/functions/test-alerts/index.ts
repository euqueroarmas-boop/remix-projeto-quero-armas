import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_TOKEN = Deno.env.get("EVOLUTION_API_TOKEN") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface AlertPayload {
  run_id: string;
  test_type: string;
  suite: string;
  status: string;
  error_message: string | null;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  report_url?: string;
  client_name?: string;
  client_id?: string;
  plan_type?: string;
}

interface AlertConfig {
  channel: string;
  enabled: boolean;
  config: Record<string, string>;
}

// ─── WhatsApp via Evolution API ───
async function sendWhatsApp(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    return { ok: false, error: "Evolution API não configurada" };
  }
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/wmti`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_TOKEN,
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        text: message,
      }),
    });
    const data = await res.json();
    return { ok: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Email via Resend ───
async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "Resend API key não configurada" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "WMTi Testes <noreply@wmti.com.br>",
        to: [to],
        subject,
        html,
      }),
    });
    const data = await res.json();
    return { ok: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Webhook genérico ───
async function sendWebhook(url: string, payload: AlertPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Build messages ───
function buildWhatsAppMessage(payload: AlertPayload): string {
  const lines = [
    `🚨 *TESTE FALHOU* — WMTi`,
    ``,
    `📋 *Tipo:* ${payload.test_type}`,
    `📊 *Suite:* ${payload.suite}`,
    `✅ Passaram: ${payload.passed_tests}`,
    `❌ Falharam: ${payload.failed_tests}`,
    `📊 Total: ${payload.total_tests}`,
  ];
  if (payload.client_name) lines.push(`👤 *Cliente:* ${payload.client_name}`);
  if (payload.plan_type) lines.push(`📦 *Plano:* ${payload.plan_type}`);
  if (payload.error_message) lines.push(``, `⚠️ *Erro:* ${payload.error_message.slice(0, 300)}`);
  if (payload.report_url) lines.push(``, `🔗 ${payload.report_url}`);
  lines.push(``, `⏰ ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  return lines.join("\n");
}

function buildEmailHtml(payload: AlertPayload): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#e53e3e;">🚨 Teste Falhou — WMTi</h2>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Tipo</td><td style="padding:8px;border-bottom:1px solid #eee;">${payload.test_type}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Suite</td><td style="padding:8px;border-bottom:1px solid #eee;">${payload.suite}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Passaram</td><td style="padding:8px;border-bottom:1px solid #eee;color:#38a169;">${payload.passed_tests}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Falharam</td><td style="padding:8px;border-bottom:1px solid #eee;color:#e53e3e;">${payload.failed_tests}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Total</td><td style="padding:8px;border-bottom:1px solid #eee;">${payload.total_tests}</td></tr>
    ${payload.client_name ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Cliente</td><td style="padding:8px;border-bottom:1px solid #eee;">${payload.client_name}</td></tr>` : ""}
    ${payload.plan_type ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Plano</td><td style="padding:8px;border-bottom:1px solid #eee;">${payload.plan_type}</td></tr>` : ""}
  </table>
  ${payload.error_message ? `<div style="background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:12px;margin:16px 0;"><strong>Erro:</strong><br/>${payload.error_message}</div>` : ""}
  ${payload.report_url ? `<p><a href="${payload.report_url}" style="color:#3182ce;">Ver relatório completo →</a></p>` : ""}
  <p style="color:#999;font-size:12px;">Enviado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
</div>`;
}

// ─── Main ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // GET — list/update alert configs
  if (req.method === "GET") {
    const token = req.headers.get("x-admin-token") || "";
    if (token !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data, error } = await supabase.from("test_alert_config").select("*").order("created_at");
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const action = body.action as string;

    // Action: save config
    if (action === "save_config") {
      const token = req.headers.get("x-admin-token") || "";
      if (token !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { id, channel, enabled, config } = body;
      if (id) {
        const { error } = await supabase.from("test_alert_config").update({ enabled, config, updated_at: new Date().toISOString() } as any).eq("id", id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const { error } = await supabase.from("test_alert_config").insert({ channel, enabled, config } as any);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Action: send alert (called by run-tests when status = failed)
    if (action === "send_alert") {
      const payload = body.payload as AlertPayload;
      if (!payload) {
        return new Response(JSON.stringify({ error: "payload required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get active configs
      const { data: configs } = await supabase.from("test_alert_config").select("*").eq("enabled", true);
      const results: { channel: string; ok: boolean; error?: string }[] = [];

      for (const cfg of (configs || []) as AlertConfig[]) {
        if (cfg.channel === "whatsapp" && cfg.config.phone) {
          const msg = buildWhatsAppMessage(payload);
          const r = await sendWhatsApp(cfg.config.phone, msg);
          results.push({ channel: "whatsapp", ...r });
        } else if (cfg.channel === "email" && cfg.config.to) {
          const subject = `🚨 Teste Falhou: ${payload.test_type} — WMTi`;
          const html = buildEmailHtml(payload);
          const r = await sendEmail(cfg.config.to, subject, html);
          results.push({ channel: "email", ...r });
        } else if (cfg.channel === "webhook" && cfg.config.url) {
          const r = await sendWebhook(cfg.config.url, payload);
          results.push({ channel: "webhook", ...r });
        }
      }

      return new Response(JSON.stringify({ sent: results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Action: test alert (send a test notification)
    if (action === "test_alert") {
      const token = req.headers.get("x-admin-token") || "";
      if (token !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const testPayload: AlertPayload = {
        run_id: "test-" + crypto.randomUUID().slice(0, 8),
        test_type: "smoke",
        suite: "test",
        status: "failed",
        error_message: "Este é um alerta de TESTE. Ignore.",
        total_tests: 5,
        passed_tests: 3,
        failed_tests: 2,
      };
      const { channel, config } = body;
      let result: { ok: boolean; error?: string } = { ok: false, error: "Canal inválido" };
      if (channel === "whatsapp" && config?.phone) {
        result = await sendWhatsApp(config.phone, buildWhatsAppMessage(testPayload));
      } else if (channel === "email" && config?.to) {
        result = await sendEmail(config.to, "🧪 Teste de Alerta — WMTi", buildEmailHtml(testPayload));
      } else if (channel === "webhook" && config?.url) {
        result = await sendWebhook(config.url, testPayload);
      }
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
