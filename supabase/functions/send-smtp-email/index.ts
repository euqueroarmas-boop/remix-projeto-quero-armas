import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SMTP_TIMEOUT_MS = 20_000;

type SmtpConnection = Deno.TcpConn | Deno.TlsConn;

interface SmtpSendResult {
  messageId: string;
  traceId: string;
  from: string;
  acceptedBy: string;
}

function createTraceId(explicitTraceId?: string) {
  return explicitTraceId || `smtp-${crypto.randomUUID()}`;
}

function sanitizeHeader(value: unknown) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeEmail(email: unknown) {
  const value = sanitizeHeader(email).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
    throw new Error(`Invalid email address: ${sanitizeHeader(email)}`);
  }
  return value;
}

function toBase64Utf8(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(i, i + 0x8000));
  }
  return btoa(binary);
}

function foldBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function encodeHeader(value: unknown) {
  const clean = sanitizeHeader(value);
  if (!clean) return "";
  if (/^[\x20-\x7E]+$/.test(clean)) return clean;
  return `=?UTF-8?B?${toBase64Utf8(clean)}?=`;
}

function formatAddress(email: string, name?: string) {
  const cleanEmail = sanitizeEmail(email);
  const cleanName = sanitizeHeader(name);
  return cleanName ? `${encodeHeader(cleanName)} <${cleanEmail}>` : `<${cleanEmail}>`;
}

function escapeEnvelope(value: string) {
  return sanitizeEmail(value).replace(/>/g, "");
}

function normalizeNewlines(value: string) {
  return value.replace(/\r?\n/g, "\r\n");
}

function dotStuff(message: string) {
  return normalizeNewlines(message).replace(/^\./gm, "..");
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${SMTP_TIMEOUT_MS}ms`)), SMTP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function getSmtpCode(response: string) {
  const finalLine = response.split(/\r?\n/).reverse().find((line) => /^\d{3}\s/.test(line));
  return finalLine?.slice(0, 3) || "";
}

class SmtpSession {
  constructor(private conn: SmtpConnection, private traceId: string) {}

  async readResponse(expectedCodes?: string[]) {
    let response = "";
    while (true) {
      const buf = new Uint8Array(4096);
      const n = await withTimeout(this.conn.read(buf), `[send-smtp-email][${this.traceId}] SMTP read`);
      if (n === null) break;
      response += decoder.decode(buf.subarray(0, n));
      if (/^\d{3}\s/m.test(response)) break;
    }

    const code = getSmtpCode(response);
    if (expectedCodes?.length && !expectedCodes.includes(code)) {
      throw new Error(`SMTP expected ${expectedCodes.join("/")} but received ${code || "no-code"}: ${response.trim()}`);
    }

    return response.trimEnd();
  }

  async command(command: string, expectedCodes?: string[]) {
    await withTimeout(this.conn.write(encoder.encode(`${command}\r\n`)), `[send-smtp-email][${this.traceId}] SMTP write`);
    return await this.readResponse(expectedCodes);
  }

  async data(message: string) {
    await withTimeout(this.conn.write(encoder.encode(`${dotStuff(message)}\r\n.\r\n`)), `[send-smtp-email][${this.traceId}] SMTP DATA write`);
    return await this.readResponse(["250"]);
  }

  async upgradeToTls(hostname: string) {
    this.conn = await withTimeout(Deno.startTls(this.conn as Deno.TcpConn, { hostname }), `[send-smtp-email][${this.traceId}] SMTP STARTTLS`);
  }

  close() {
    try {
      this.conn.close();
    } catch (_) {
      // Connection may already be closed by the SMTP server.
    }
  }
}

async function connectSmtp(host: string, port: number, secure: boolean, traceId: string) {
  const conn = secure
    ? await withTimeout(Deno.connectTls({ hostname: host, port }), `[send-smtp-email][${traceId}] SMTP TLS connect`)
    : await withTimeout(Deno.connect({ hostname: host, port }), `[send-smtp-email][${traceId}] SMTP TCP connect`);
  return new SmtpSession(conn, traceId);
}

function buildMimeMessage(input: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  traceId: string;
  messageId: string;
}) {
  const boundary = `=_qa_${crypto.randomUUID().replace(/-/g, "")}`;
  const date = new Date().toUTCString();
  const headers = [
    `From: ${formatAddress(input.fromEmail, input.fromName)}`,
    `To: ${formatAddress(input.to)}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${input.messageId}`,
    `MIME-Version: 1.0`,
    `X-QA-Trace-ID: ${sanitizeHeader(input.traceId)}`,
    `Auto-Submitted: auto-generated`,
  ];

  if (input.replyTo) {
    headers.push(`Reply-To: ${formatAddress(input.replyTo)}`);
  }

  if (input.html && input.text) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return `${headers.join("\r\n")}\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset=UTF-8\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${foldBase64(toBase64Utf8(input.text))}\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${foldBase64(toBase64Utf8(input.html))}\r\n\r\n` +
      `--${boundary}--`;
  }

  const content = input.html || input.text || "";
  headers.push(`Content-Type: ${input.html ? "text/html" : "text/plain"}; charset=UTF-8`);
  headers.push("Content-Transfer-Encoding: base64");
  return `${headers.join("\r\n")}\r\n\r\n${foldBase64(toBase64Utf8(content))}`;
}

async function sendViaSmtp(payload: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  trace_id?: string;
}): Promise<SmtpSendResult> {
  const SMTP_HOST = Deno.env.get("SMTP_HOST");
  const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const SMTP_USER = Deno.env.get("SMTP_USER");
  const SMTP_PASS = Deno.env.get("SMTP_PASS");
  const SMTP_SECURE = (Deno.env.get("SMTP_SECURE") || "").toLowerCase() === "true" || SMTP_PORT === 465;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP not configured");
  }

  const traceId = createTraceId(payload.trace_id);
  const to = sanitizeEmail(payload.to);
  const subject = sanitizeHeader(payload.subject);
  const fromName = Deno.env.get("SMTP_FROM_NAME") || "Quero Armas";
  const fromEmail = sanitizeEmail(Deno.env.get("SMTP_FROM_EMAIL") || SMTP_USER);
  const fromDomain = fromEmail.split("@")[1] || "localhost";
  const messageId = `<${Date.now()}.${crypto.randomUUID()}@${fromDomain}>`;

  let session = await connectSmtp(SMTP_HOST, SMTP_PORT, SMTP_SECURE, traceId);

  try {
    await session.readResponse(["220"]);
    const ehloRes = await session.command(`EHLO ${fromDomain}`, ["250"]);

    if (!SMTP_SECURE && ehloRes.includes("STARTTLS")) {
      await session.command("STARTTLS", ["220"]);
      await session.upgradeToTls(SMTP_HOST);
      await session.command(`EHLO ${fromDomain}`, ["250"]);
    }

    await session.command("AUTH LOGIN", ["334"]);
    await session.command(toBase64Utf8(SMTP_USER), ["334"]);
    await session.command(toBase64Utf8(SMTP_PASS), ["235"]);
    await session.command(`MAIL FROM:<${escapeEnvelope(fromEmail)}>`, ["250"]);
    const rcptRes = await session.command(`RCPT TO:<${escapeEnvelope(to)}>`, ["250", "251"]);
    await session.command("DATA", ["354"]);

    const mime = buildMimeMessage({
      fromName,
      fromEmail,
      to,
      subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.reply_to,
      traceId,
      messageId,
    });

    await session.data(mime);
    await session.command("QUIT", ["221"]).catch(() => "");

    return {
      messageId,
      traceId,
      from: `${sanitizeHeader(fromName)} <${fromEmail}>`,
      acceptedBy: rcptRes,
    };
  } finally {
    session.close();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestTraceId = createTraceId();

  try {
    const body = await req.json();
    const { to, subject, html, text, reply_to, trace_id } = body;
    const traceId = createTraceId(trace_id || requestTraceId);

    if (!to || !subject || (!html && !text)) {
      console.warn(`[send-smtp-email][${traceId}] missing_required_fields`);
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html or text", traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
      });
    }

    console.info(`[send-smtp-email][${traceId}] request_received`, JSON.stringify({
      to: sanitizeHeader(to),
      subject: sanitizeHeader(subject),
      hasHtml: Boolean(html),
      hasText: Boolean(text),
      replyTo: reply_to ? sanitizeHeader(reply_to) : null,
    }));

    const result = await sendViaSmtp({ to, subject, html, text, reply_to, trace_id: traceId });

    console.info(`[send-smtp-email][${result.traceId}] email_accepted`, JSON.stringify({
      to: sanitizeHeader(to),
      subject: sanitizeHeader(subject),
      from: result.from,
      messageId: result.messageId,
    }));

    await logSistemaBackend({
      tipo: "email",
      status: "success",
      mensagem: `Email SMTP aceito pelo servidor: ${sanitizeHeader(to)}`,
      payload: { subject: sanitizeHeader(subject), messageId: result.messageId, trace_id: result.traceId },
    });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("integration_logs").insert({
      integration_name: "smtp_email",
      operation_name: "email_accepted",
      request_payload: { to: sanitizeHeader(to), subject: sanitizeHeader(subject), from: result.from, trace_id: result.traceId },
      response_payload: { messageId: result.messageId, status: "accepted", acceptedBy: result.acceptedBy },
      status: "success",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email accepted by SMTP server", messageId: result.messageId, traceId: result.traceId, from: result.from }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": result.traceId } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const traceId = requestTraceId;
    console.error(`[send-smtp-email][${traceId}] error`, message);
    await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Erro SMTP: ${message}`, payload: { trace_id: traceId } }).catch(() => {});

    return new Response(JSON.stringify({ error: message, traceId }), {
      status: message === "SMTP not configured" ? 500 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
    });
  }
});
