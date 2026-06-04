import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  email: z.string().trim().email("E-mail inválido").transform((value) => value.toLowerCase()),
  redirectTo: z.string().url("URL de redirecionamento inválida").optional(),
  trace_id: z.string().trim().min(8).max(200).optional(),
});

const DEFAULT_REDIRECT_TO = "https://dell-shine-solutions.lovable.app/redefinir-senha";

function isAllowedRedirect(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const allowedHost = hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "wmti.com.br"
      || hostname.endsWith(".wmti.com.br")
      || hostname.endsWith(".lovable.app")
      || hostname.endsWith(".lovable.dev");

    return allowedHost && parsed.pathname.startsWith("/redefinir-senha");
  } catch {
    return false;
  }
}

function resolveRedirectTo(req: Request, explicitRedirect?: string) {
  if (explicitRedirect && isAllowedRedirect(explicitRedirect)) {
    return explicitRedirect;
  }

  const requestOrigin = req.headers.get("origin");
  if (requestOrigin) {
    const candidate = `${requestOrigin.replace(/\/$/, "")}/redefinir-senha`;
    if (isAllowedRedirect(candidate)) {
      return candidate;
    }
  }

  return DEFAULT_REDIRECT_TO;
}

function createTraceId(explicitTraceId?: string) {
  return explicitTraceId || `wmti-reset-${crypto.randomUUID()}`;
}

function buildRecoveryEmailHtml(recoveryLink: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#FF5A1F;padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;">WMTi Tecnologia da Informação</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">Olá!</p>
              <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px;">
                Recebemos uma solicitação para redefinir a senha do seu acesso ao portal do cliente WMTi.
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                <a href="${recoveryLink}" style="display:inline-block;background:#FF5A1F;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:bold;">Redefinir minha senha</a>
              </div>
              <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="font-size:13px;font-weight:bold;color:#9A3412;margin:0 0 8px;">Importante:</p>
                <ul style="font-size:13px;color:#9A3412;margin:0;padding:0 0 0 20px;line-height:1.8;">
                  <li>Se você não solicitou esta redefinição, ignore este e-mail.</li>
                  <li>Por segurança, o link possui validade limitada.</li>
                  <li>Após alterar a senha, use a nova credencial para acessar o portal.</li>
                </ul>
              </div>
              <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
                Se o botão acima não funcionar, copie e cole este link no navegador:<br>
                <span style="word-break:break-all;color:#FF5A1F;">${recoveryLink}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="font-size:11px;color:#999;margin:0;">WMTi Tecnologia da Informação LTDA — CNPJ 13.366.668/0001-07</p>
              <p style="font-size:11px;color:#999;margin:4px 0 0;">Rua José Benedito Duarte, 140 — Parque Itamarati — Jacareí/SP</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildRecoveryEmailText(recoveryLink: string) {
  return [
    "WMTi Tecnologia da Informação",
    "",
    "Recebemos uma solicitação para redefinir a senha do seu acesso ao portal do cliente.",
    "",
    `Redefina sua senha: ${recoveryLink}`,
    "",
    "Se você não solicitou esta redefinição, ignore este e-mail.",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsedBody = BodySchema.safeParse(body);
    const traceId = createTraceId(body?.trace_id);

    if (!parsedBody.success) {
      console.warn(`[request-password-reset][${traceId}] validation_failed`, JSON.stringify(parsedBody.error.flatten().fieldErrors));
      return new Response(JSON.stringify({ error: parsedBody.error.flatten().fieldErrors, traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
      });
    }

    const { email, redirectTo } = parsedBody.data;
    const finalRedirectTo = resolveRedirectTo(req, redirectTo);

    console.info(`[request-password-reset][${traceId}] received`, JSON.stringify({
      email,
      origin: req.headers.get("origin"),
      redirectTo: finalRedirectTo,
    }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: finalRedirectTo,
      },
    });

    const recoveryLink = linkData?.properties?.action_link;

    console.info(`[request-password-reset][${traceId}] generate_link_result`, JSON.stringify({
      ok: !linkError && Boolean(recoveryLink),
      error: linkError?.message ?? null,
      hasRecoveryLink: Boolean(recoveryLink),
    }));

    if (linkError || !recoveryLink) {
      await logSistemaBackend({
        tipo: "auth",
        status: "warning",
        mensagem: "Solicitação de recuperação sem link emitido",
        payload: { email, error: linkError?.message || "recovery_link_unavailable", trace_id: traceId },
      });

      return new Response(JSON.stringify({
        success: true,
        message: "Se existir uma conta vinculada a este identificador, o e-mail de recuperação será enviado.",
        traceId,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
      });
    }

    const subject = "🔐 Redefinição de senha — Portal do Cliente WMTi";
    console.info(`[request-password-reset][${traceId}] invoking_send_smtp_email`, JSON.stringify({
      functionName: "send-smtp-email",
      to: email,
      subject,
    }));

    const smtpResponse = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: email,
        subject,
        html: buildRecoveryEmailHtml(recoveryLink),
        text: buildRecoveryEmailText(recoveryLink),
        trace_id: traceId,
      },
    });

    const smtpOk = !smtpResponse.error && smtpResponse.data?.success;

    console.info(`[request-password-reset][${traceId}] send_smtp_email_result`, JSON.stringify({
      ok: smtpOk,
      error: smtpResponse.error?.message ?? null,
      data: smtpResponse.data ?? null,
    }));

    if (!smtpOk) {
      await logSistemaBackend({
        tipo: "auth",
        status: "error",
        mensagem: "Falha ao enviar recuperação de senha via SMTP",
        payload: { email, error: smtpResponse.error || smtpResponse.data, trace_id: traceId },
      });

      return new Response(JSON.stringify({ error: "Falha ao enviar o e-mail de recuperação.", traceId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
      });
    }

    await logSistemaBackend({
      tipo: "auth",
      status: "success",
      mensagem: "Recuperação de senha enviada via SMTP WMTi",
      payload: {
        email,
        subject,
        messageId: smtpResponse.data?.messageId || null,
        redirectTo: finalRedirectTo,
        trace_id: traceId,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Se existir uma conta vinculada a este identificador, o e-mail de recuperação será enviado.",
      provider: "wmti_smtp",
      subject,
      messageId: smtpResponse.data?.messageId || null,
      traceId,
      mailFunction: "send-smtp-email",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const traceId = `wmti-reset-${crypto.randomUUID()}`;
    console.error(`[request-password-reset][${traceId}] error`, message);
    await logSistemaBackend({
      tipo: "auth",
      status: "error",
      mensagem: `Erro na recuperação de senha: ${message}`,
      payload: { trace_id: traceId },
    }).catch(() => {});

    return new Response(JSON.stringify({ error: "Erro interno ao processar a recuperação.", traceId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-WMTi-Trace-Id": traceId },
    });
  }
});