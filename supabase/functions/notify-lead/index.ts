import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, company, service_interest, message, source_page } = await req.json();

    const notificationText = `
Novo lead recebido no site WMTi!

Nome: ${name}
Email: ${email}
Telefone: ${phone || "Não informado"}
Empresa: ${company || "Não informada"}
Interesse: ${service_interest || "Não informado"}
Página: ${source_page || "/"}

Mensagem:
${message || "Sem mensagem"}

---
Enviado automaticamente pelo site wmti.com.br
    `.trim();

    console.log("📧 Lead notification:", notificationText);

    // Send email notification to admin via central SMTP
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const adminEmail = "contato@wmti.com.br";

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:30px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<tr><td style="background:#FF5A1F;padding:20px 30px;text-align:center;">
  <h1 style="color:#fff;font-size:18px;margin:0;">📩 Novo Lead — WMTi</h1>
</td></tr>

<tr><td style="padding:30px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:6px 0;font-size:13px;color:#666;">Nome</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;">${name || "N/A"}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#666;border-top:1px solid #eee;">E-mail</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">${email || "N/A"}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#666;border-top:1px solid #eee;">Telefone</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">${phone || "Não informado"}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#666;border-top:1px solid #eee;">Empresa</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">${company || "Não informada"}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#666;border-top:1px solid #eee;">Interesse</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">${service_interest || "Não informado"}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#666;border-top:1px solid #eee;">Página de origem</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">${source_page || "/"}</td></tr>
  </table>

  ${message ? `
  <div style="margin-top:20px;background:#f9fafb;border-radius:6px;padding:14px 16px;">
    <p style="font-size:12px;color:#999;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Mensagem</p>
    <p style="font-size:13px;color:#333;margin:0;line-height:1.5;">${message}</p>
  </div>
  ` : ""}
</td></tr>

<tr><td style="background:#f9fafb;padding:14px 30px;text-align:center;border-top:1px solid #eee;">
  <p style="font-size:11px;color:#999;margin:0;">WMTi Tecnologia da Informação — Notificação automática</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const smtpRes = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: adminEmail,
        subject: `📩 Novo Lead: ${name || email || "Site WMTi"}`,
        html: htmlContent,
        text: notificationText,
        reply_to: email,
      },
    });

    const smtpOk = !smtpRes.error && smtpRes.data?.success;

    if (smtpOk) {
      console.log("[notify-lead] Admin notification sent via SMTP");
      await logSistemaBackend({ tipo: "lead", status: "success", mensagem: `Notificação de lead enviada: ${email}`, payload: { name, email } });
    } else {
      console.warn("[notify-lead] SMTP send failed (non-blocking):", JSON.stringify(smtpRes.error || smtpRes.data));
      await logSistemaBackend({ tipo: "lead", status: "warning", mensagem: `Falha ao notificar lead: ${email}`, payload: smtpRes.error || smtpRes.data });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification processed", email_sent: smtpOk }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[notify-lead] Error:", message);
    return new Response(
      JSON.stringify({ error: "Failed to process notification" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
