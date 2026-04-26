import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import {
  qaWelcomeHtml, qaWelcomeText,
  qaOtpHtml, qaOtpText,
  qaPasswordResetHtml, qaPasswordResetText,
  qaPasswordChangedHtml, qaPasswordChangedText,
  qaPaymentPendingHtml, qaPaymentPendingText,
  qaPaymentOverdueHtml, qaPaymentOverdueText,
  qaPaymentConfirmedHtml, qaPaymentConfirmedText,
  qaCaseUpdateHtml, qaCaseUpdateText,
  qaDocumentReadyHtml, qaDocumentReadyText,
  qaGenericHtml, qaGenericText,
} from "../_shared/qaEmailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Template =
  | "welcome"
  | "otp"
  | "password-reset"
  | "password-changed"
  | "payment-pending"
  | "payment-overdue"
  | "payment-confirmed"
  | "case-update"
  | "document-ready"
  | "generic";

interface Payload {
  template: Template;
  to: string;
  data: Record<string, any>;
  trace_id?: string;
}

function build(template: Template, data: Record<string, any>): { subject: string; html: string; text: string } {
  switch (template) {
    case "welcome":
      return {
        subject: "🎯 Bem-vindo ao Quero Armas — seu acesso foi criado",
        html: qaWelcomeHtml(data as any),
        text: qaWelcomeText(data as any),
      };
    case "otp":
      return {
        subject: `Seu código de verificação: ${data.code}`,
        html: qaOtpHtml(data as any),
        text: qaOtpText(data as any),
      };
    case "password-reset":
      return {
        subject: "🔐 Redefinir sua senha — Quero Armas",
        html: qaPasswordResetHtml(data as any),
        text: qaPasswordResetText(data as any),
      };
    case "password-changed":
      return {
        subject: "✅ Senha alterada — Quero Armas",
        html: qaPasswordChangedHtml(data as any),
        text: qaPasswordChangedText(data as any),
      };
    case "payment-pending":
      return {
        subject: `💳 Nova cobrança — ${data.value}`,
        html: qaPaymentPendingHtml(data as any),
        text: qaPaymentPendingText(data as any),
      };
    case "payment-overdue":
      return {
        subject: `⚠️ Cobrança vencida — ${data.value}`,
        html: qaPaymentOverdueHtml(data as any),
        text: qaPaymentOverdueText(data as any),
      };
    case "payment-confirmed":
      return {
        subject: `✅ Pagamento confirmado — ${data.value}`,
        html: qaPaymentConfirmedHtml(data as any),
        text: qaPaymentConfirmedText(data as any),
      };
    case "case-update":
      return {
        subject: `📋 Atualização do caso: ${data.caseTitle}`,
        html: qaCaseUpdateHtml(data as any),
        text: qaCaseUpdateText(data as any),
      };
    case "document-ready":
      return {
        subject: `📄 Documento pronto: ${data.documentName}`,
        html: qaDocumentReadyHtml(data as any),
        text: qaDocumentReadyText(data as any),
      };
    case "generic":
      return {
        subject: data.subject,
        html: qaGenericHtml(data as any),
        text: qaGenericText(data as any),
      };
    default:
      throw new Error(`unknown template: ${template}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = `qa-notify-${crypto.randomUUID()}`;

  try {
    // Auth: accept staff JWT OR cron token
    const { requireQAStaff, requireCronToken } = await import("../_shared/qaAuth.ts");
    const cronCheck = requireCronToken(req);
    if (!cronCheck.ok) {
      const staffCheck = await requireQAStaff(req);
      if (!staffCheck.ok) return staffCheck.response;
    }

    const body = (await req.json()) as Payload;
    const { template, to, data } = body;

    if (!template || !to || !data) {
      return new Response(JSON.stringify({ error: "Missing template, to or data", traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html, text } = build(template, data);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const smtpRes = await supabase.functions.invoke("send-smtp-email", {
      body: { to, subject, html, text, trace_id: body.trace_id || traceId },
    });

    const ok = !smtpRes.error && smtpRes.data?.success;
    console.info(`[qa-notify][${traceId}] template=${template} to=${to} ok=${ok}`);

    if (!ok) {
      await logSistemaBackend({
        tipo: "email",
        status: "error",
        mensagem: `Falha qa-notify ${template}: ${to}`,
        payload: { trace_id: traceId, error: smtpRes.error || smtpRes.data },
      });
    } else {
      await logSistemaBackend({
        tipo: "email",
        status: "success",
        mensagem: `qa-notify enviado: ${template} → ${to}`,
        payload: { trace_id: traceId, subject },
      });
    }

    return new Response(JSON.stringify({ success: ok, traceId }), {
      status: ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[qa-notify][${traceId}] error`, msg);
    return new Response(JSON.stringify({ error: msg, traceId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
