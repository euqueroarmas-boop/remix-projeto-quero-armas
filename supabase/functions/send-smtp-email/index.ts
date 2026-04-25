import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function createTraceId(explicitTraceId?: string) {
  return explicitTraceId || `smtp-${crypto.randomUUID()}`;
}

/**
 * Central SMTP email sender for Quero Armas.
 * All transactional/operational emails go through this function.
 * Sender: Quero Armas <naoresponda@euqueroarmas.com.br>
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.error("[send-smtp-email] SMTP credentials not configured");
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { to, subject, html, text, reply_to, trace_id } = body;
    const traceId = createTraceId(trace_id);

    if (!to || !subject || (!html && !text)) {
      console.warn(`[send-smtp-email][${traceId}] missing_required_fields`);
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html or text", traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
      });
    }

    const fromName = Deno.env.get("SMTP_FROM_NAME") || "Quero Armas";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") || SMTP_USER;
    const fromDomain = (fromEmail.split("@")[1] || "euqueroarmas.com.br").trim();

    console.info(`[send-smtp-email][${traceId}] request_received`, JSON.stringify({
      to,
      subject,
      from: `${fromName} <${fromEmail}>`,
      hasHtml: Boolean(html),
      hasText: Boolean(text),
      replyTo: reply_to ?? null,
    }));

    let conn: Deno.TlsConn | Deno.TcpConn = SMTP_PORT === 465
      ? await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT })
      : await Deno.connect({ hostname: SMTP_HOST, port: SMTP_PORT });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      if (n === null) return "";
      return decoder.decode(buf.subarray(0, n));
    }

    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      return await readResponse();
    }

    await readResponse();
    const ehloRes = await sendCommand(`EHLO ${fromDomain}`);

    if (SMTP_PORT === 587 && ehloRes.includes("STARTTLS")) {
      await sendCommand("STARTTLS");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: SMTP_HOST });
      // Re-EHLO over TLS (required by RFC 3207)
      await sendCommand(`EHLO ${fromDomain}`);
    }

    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(SMTP_USER));
    const authRes = await sendCommand(btoa(SMTP_PASS));

    if (!authRes.includes("235") && !authRes.includes("Authentication successful")) {
      console.error(`[send-smtp-email][${traceId}] smtp_auth_failed`, authRes);
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `SMTP auth failed for ${to}`, payload: { error: authRes, trace_id: traceId } });
      conn.close();
      return new Response(JSON.stringify({ error: "SMTP authentication failed", traceId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
      });
    }

    await sendCommand(`MAIL FROM:<${fromEmail}>`);
    const rcptRes = await sendCommand(`RCPT TO:<${to}>`);
    if (!rcptRes.startsWith("2")) {
      console.error(`[send-smtp-email][${traceId}] rcpt_to_failed`, rcptRes);
      conn.close();
      return new Response(JSON.stringify({ error: "Recipient rejected", detail: rcptRes, traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
      });
    }

    await sendCommand("DATA");

    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const date = new Date().toUTCString();
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${fromDomain}>`;

    let emailContent = `From: ${fromName} <${fromEmail}>\r\n`;
    emailContent += `To: ${to}\r\n`;
    emailContent += `Subject: ${subject}\r\n`;
    emailContent += `Date: ${date}\r\n`;
    emailContent += `Message-ID: ${messageId}\r\n`;
    emailContent += `MIME-Version: 1.0\r\n`;
    if (reply_to) {
      emailContent += `Reply-To: ${reply_to}\r\n`;
    }

    if (html && text) {
      emailContent += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
      emailContent += `--${boundary}\r\n`;
      emailContent += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
      emailContent += `${text}\r\n\r\n`;
      emailContent += `--${boundary}\r\n`;
      emailContent += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      emailContent += `${html}\r\n\r\n`;
      emailContent += `--${boundary}--\r\n`;
    } else if (html) {
      emailContent += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      emailContent += `${html}\r\n`;
    } else {
      emailContent += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
      emailContent += `${text}\r\n`;
    }

    const dataRes = await sendCommand(emailContent + "\r\n.");

    if (!dataRes.startsWith("2")) {
      console.error(`[send-smtp-email][${traceId}] data_send_failed`, dataRes);
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha envio SMTP: ${to}`, payload: { error: dataRes, trace_id: traceId } });
      conn.close();
      return new Response(JSON.stringify({ error: "Email delivery failed", detail: dataRes, traceId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
      });
    }

    await sendCommand("QUIT");
    conn.close();

    console.info(`[send-smtp-email][${traceId}] email_sent`, JSON.stringify({
      to,
      subject,
      from: `${fromName} <${fromEmail}>`,
      messageId,
    }));
    await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Email SMTP enviado: ${to}`, payload: { subject, messageId, trace_id: traceId } });

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    await supabase.from("integration_logs").insert({
      integration_name: "smtp_email",
      operation_name: "email_sent",
      request_payload: { to, subject, from: `${fromName} <${fromEmail}>`, trace_id: traceId },
      response_payload: { messageId, status: "sent" },
      status: "success",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email sent via SMTP", messageId, traceId, from: `${fromName} <${fromEmail}>` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const traceId = `smtp-${crypto.randomUUID()}`;
    console.error(`[send-smtp-email][${traceId}] error`, message);
    await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Erro SMTP: ${message}`, payload: { trace_id: traceId } }).catch(() => {});
    return new Response(JSON.stringify({ error: message, traceId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
    });
  }
});