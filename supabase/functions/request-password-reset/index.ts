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
  brand: z.enum(["wmti", "quero-armas"]).optional(),
});

const DEFAULT_REDIRECT_TO_WMTI = "https://wmti.com.br/redefinir-senha";
const DEFAULT_REDIRECT_TO_QA = "https://euqueroarmas.com.br/redefinir-senha";

type Brand = "wmti" | "quero-armas";

interface BrandConfig {
  brand: Brand;
  fromName: string;
  subject: string;
  headerTitle: string;
  headerColor: string;
  greetingLine: string;
  ctaLabel: string;
  warningTitle: string;
  warningItems: string[];
  footerLines: string[];
  defaultRedirectTo: string;
  productionHosts: string[]; // hosts permitidos em produção
  textIntro: string;
}

const BRANDS: Record<Brand, BrandConfig> = {
  wmti: {
    brand: "wmti",
    fromName: "WMTi Tecnologia da Informação",
    subject: "🔐 Redefinição de senha — Portal do Cliente WMTi",
    headerTitle: "WMTi Tecnologia da Informação",
    headerColor: "#FF5A1F",
    greetingLine: "Recebemos uma solicitação para redefinir a senha do seu acesso ao portal do cliente WMTi.",
    ctaLabel: "Redefinir minha senha",
    warningTitle: "Importante:",
    warningItems: [
      "Se você não solicitou esta redefinição, ignore este e-mail.",
      "Por segurança, o link possui validade limitada.",
      "Após alterar a senha, use a nova credencial para acessar o portal.",
    ],
    footerLines: [
      "WMTi Tecnologia da Informação LTDA — CNPJ 13.366.668/0001-07",
      "Rua José Benedito Duarte, 140 — Parque Itamarati — Jacareí/SP",
    ],
    defaultRedirectTo: DEFAULT_REDIRECT_TO_WMTI,
    productionHosts: ["wmti.com.br", "www.wmti.com.br"],
    textIntro: "WMTi Tecnologia da Informação",
  },
  "quero-armas": {
    brand: "quero-armas",
    fromName: "Quero Armas",
    subject: "🔐 Redefinição de senha — Portal Quero Armas",
    headerTitle: "Quero Armas",
    headerColor: "#0A0A0A",
    greetingLine: "Recebemos uma solicitação para redefinir a senha do seu acesso ao Portal Quero Armas.",
    ctaLabel: "Redefinir minha senha",
    warningTitle: "Importante:",
    warningItems: [
      "Se você não solicitou esta redefinição, ignore este e-mail.",
      "Por segurança, o link possui validade limitada.",
    ],
    footerLines: [
      "Quero Armas — Acesso seguro e auditado",
    ],
    defaultRedirectTo: DEFAULT_REDIRECT_TO_QA,
    productionHosts: ["euqueroarmas.com.br", "www.euqueroarmas.com.br"],
    textIntro: "Quero Armas",
  },
};

function isPreviewOrDevHost(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname.endsWith(".lovableproject.com")
    || hostname.endsWith(".lovable.app")
    || hostname.endsWith(".lovable.dev");
}

/**
 * Define o ambiente da edge function:
 *   APP_ENV = "production" | "preview" | "development"
 * Padrão: "production" (fail-safe). Em produção, hosts Lovable/localhost
 * NUNCA são aceitos como redirectTo.
 */
function getAppEnv(): "production" | "preview" | "development" {
  const raw = (Deno.env.get("APP_ENV") || "production").toLowerCase();
  if (raw === "preview" || raw === "development") return raw;
  return "production";
}

function isAllowedRedirectForBrand(url: string, cfg: BrandConfig): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (!parsed.pathname.startsWith("/redefinir-senha")) return false;

    // Produção da brand
    if (cfg.productionHosts.includes(hostname)) return true;

    // Preview/dev: permitido apenas quando APP_ENV != production
    if (getAppEnv() !== "production" && isPreviewOrDevHost(hostname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function resolveRedirectTo(req: Request, cfg: BrandConfig, explicitRedirect?: string) {
  // Para Quero Armas, o link enviado por e-mail SEMPRE precisa apontar para o
  // domínio canônico oficial. Ignoramos qualquer redirectTo vindo do frontend
  // (preview/lovable/localhost) para impedir que o link do e-mail saia com
  // host errado. Em ambientes não-produção (APP_ENV=preview|development),
  // permite-se override explícito apenas se passar na allowlist.
  if (cfg.brand === "quero-armas" && getAppEnv() === "production") {
    return cfg.defaultRedirectTo;
  }

  if (explicitRedirect && isAllowedRedirectForBrand(explicitRedirect, cfg)) {
    return explicitRedirect;
  }

  const requestOrigin = req.headers.get("origin");
  if (requestOrigin) {
    const candidate = `${requestOrigin.replace(/\/$/, "")}/redefinir-senha`;
    if (isAllowedRedirectForBrand(candidate, cfg)) {
      return candidate;
    }
  }

  return cfg.defaultRedirectTo;
}

function createTraceId(explicitTraceId?: string) {
  return explicitTraceId || `wmti-reset-${crypto.randomUUID()}`;
}

function buildRecoveryEmailHtml(recoveryLink: string, cfg: BrandConfig) {
  const warningItemsHtml = cfg.warningItems
    .map((item) => `                  <li>${item}</li>`)
    .join("\n");
  const footerLinesHtml = cfg.footerLines
    .map((line, idx) => `              <p style="font-size:11px;color:#999;margin:${idx === 0 ? "0" : "4px 0 0"};">${line}</p>`)
    .join("\n");
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
            <td style="background:${cfg.headerColor};padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;">${cfg.headerTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">Olá!</p>
              <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px;">
                ${cfg.greetingLine}
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                <a href="${recoveryLink}" style="display:inline-block;background:${cfg.headerColor};color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:bold;">${cfg.ctaLabel}</a>
              </div>
              <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="font-size:13px;font-weight:bold;color:#9A3412;margin:0 0 8px;">${cfg.warningTitle}</p>
                <ul style="font-size:13px;color:#9A3412;margin:0;padding:0 0 0 20px;line-height:1.8;">
${warningItemsHtml}
                </ul>
              </div>
              <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
                Se o botão acima não funcionar, copie e cole este link no navegador:<br>
                <span style="word-break:break-all;color:${cfg.headerColor};">${recoveryLink}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
${footerLinesHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildRecoveryEmailText(recoveryLink: string, cfg: BrandConfig) {
  return [
    cfg.textIntro,
    "",
    cfg.greetingLine,
    "",
    `Redefina sua senha: ${recoveryLink}`,
    "",
    cfg.warningItems[0] ?? "Se você não solicitou esta redefinição, ignore este e-mail.",
  ].join("\n");
}

function buildDirectRecoveryLink(redirectTo: string, tokenHash: string) {
  const url = new URL(redirectTo);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "recovery");
  return url.toString();
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

    const { email, redirectTo, brand } = parsedBody.data;
    // Brand inferida pelo redirectTo se não enviada (compat retroativa)
    let inferredBrand: Brand = brand ?? "wmti";
    if (!brand && redirectTo) {
      try {
        const h = new URL(redirectTo).hostname.toLowerCase();
        if (h === "euqueroarmas.com.br" || h.endsWith(".euqueroarmas.com.br")) {
          inferredBrand = "quero-armas";
        }
      } catch { /* ignore */ }
    }
    const cfg = BRANDS[inferredBrand];
    const finalRedirectTo = resolveRedirectTo(req, cfg, redirectTo);

    console.info(`[request-password-reset][${traceId}] received`, JSON.stringify({
      email,
      brand: cfg.brand,
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

    const tokenHash = linkData?.properties?.hashed_token;
    const recoveryLink = cfg.brand === "quero-armas" && tokenHash
      ? buildDirectRecoveryLink(finalRedirectTo, tokenHash)
      : linkData?.properties?.action_link;

    console.info(`[request-password-reset][${traceId}] generate_link_result`, JSON.stringify({
      ok: !linkError && Boolean(recoveryLink),
      error: linkError?.message ?? null,
      hasRecoveryLink: Boolean(recoveryLink),
      linkMode: cfg.brand === "quero-armas" && tokenHash ? "direct_token_hash" : "auth_verify_redirect",
      linkTarget: recoveryLink ? new URL(recoveryLink).origin + new URL(recoveryLink).pathname : null,
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

    const subject = cfg.subject;
    console.info(`[request-password-reset][${traceId}] invoking_send_smtp_email`, JSON.stringify({
      functionName: "send-smtp-email",
      to: email,
      subject,
      brand: cfg.brand,
    }));

    const smtpResponse = await supabase.functions.invoke("send-smtp-email", {
      headers: { "x-internal-token": Deno.env.get("INTERNAL_FUNCTION_TOKEN") ?? "" },
      body: {
        to: email,
        subject,
        from_name: cfg.fromName,
        html: buildRecoveryEmailHtml(recoveryLink, cfg),
        text: buildRecoveryEmailText(recoveryLink, cfg),
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
      mensagem: `Recuperação de senha enviada via SMTP (${cfg.brand})`,
      payload: {
        email,
        brand: cfg.brand,
        subject,
        messageId: smtpResponse.data?.messageId || null,
        redirectTo: finalRedirectTo,
        trace_id: traceId,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Se existir uma conta vinculada a este identificador, o e-mail de recuperação será enviado.",
      provider: cfg.brand === "quero-armas" ? "qa_smtp" : "wmti_smtp",
      brand: cfg.brand,
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