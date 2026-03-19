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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[send-purchase-confirmation] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      customer_name,
      customer_email,
      service_name,
      hours,
      computers_qty,
      value,
      payment_method,
      contract_ref,
      purchase_date,
      is_recurring,
    } = body;

    if (!customer_email || !customer_name || !service_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentLabel =
      payment_method === "CREDIT_CARD"
        ? "Cartão de Crédito"
        : payment_method === "BOLETO"
        ? "Boleto Bancário"
        : payment_method || "N/A";

    const valueFormatted = `R$ ${Number(value).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- Header -->
<tr><td style="background:#FF5A1F;padding:30px 40px;text-align:center;">
  <h1 style="color:#ffffff;font-size:22px;margin:0;">WMTi Tecnologia da Informação</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding:40px;">
  <div style="text-align:center;margin-bottom:30px;">
    <div style="display:inline-block;background:#e6f9ed;color:#15803d;font-weight:bold;font-size:14px;padding:8px 20px;border-radius:20px;">
      ✓ Pagamento Confirmado
    </div>
  </div>

  <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">Olá, <strong>${customer_name}</strong>!</p>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px;">
    Recebemos seu pagamento com sucesso e sua contratação foi concluída.<br>
    Agradecemos por escolher a WMTi. Segue abaixo o resumo da sua compra.
  </p>

  <!-- Summary -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
    <tr><td style="padding:8px 16px;font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#FF5A1F;font-weight:bold;">Resumo da Compra</td></tr>
    <tr><td style="padding:0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;font-size:13px;color:#666;border-bottom:1px solid #eee;">Serviço</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #eee;">${service_name}</td></tr>
        ${hours ? `<tr><td style="padding:8px 0;font-size:13px;color:#666;border-bottom:1px solid #eee;">Horas</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #eee;">${hours}h</td></tr>` : ""}
        ${computers_qty ? `<tr><td style="padding:8px 0;font-size:13px;color:#666;border-bottom:1px solid #eee;">Computadores</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #eee;">${computers_qty}</td></tr>` : ""}
        <tr><td style="padding:8px 0;font-size:13px;color:#666;border-bottom:1px solid #eee;">${is_recurring ? "Valor Mensal" : "Valor Pago"}</td><td style="padding:8px 0;font-size:14px;font-weight:bold;text-align:right;color:#FF5A1F;border-bottom:1px solid #eee;">${valueFormatted}</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#666;border-bottom:1px solid #eee;">Forma de Pagamento</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #eee;">${paymentLabel}</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#666;border-bottom:1px solid #eee;">Data</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #eee;">${purchase_date || new Date().toLocaleDateString("pt-BR")}</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#666;">Status</td><td style="padding:8px 0;font-size:13px;font-weight:bold;text-align:right;color:#15803d;">Confirmado</td></tr>
        ${contract_ref ? `<tr><td style="padding:8px 0;font-size:13px;color:#666;">Contrato</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;font-family:monospace;">${contract_ref}</td></tr>` : ""}
      </table>
    </td></tr>
  </table>

  <!-- Next steps -->
  <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
    <p style="font-size:13px;font-weight:bold;color:#9A3412;margin:0 0 8px;">Próximos passos:</p>
    <ul style="font-size:13px;color:#9A3412;margin:0;padding:0 0 0 20px;line-height:1.8;">
      <li>Nossa equipe técnica entrará em contato em breve para agendar o atendimento.</li>
      <li>Guarde este e-mail como comprovante da sua contratação.</li>
      <li>Em caso de dúvidas, fale conosco pelo WhatsApp: (11) 96316-6915</li>
    </ul>
  </div>

  <p style="font-size:13px;color:#666;text-align:center;">
    Obrigado por confiar na WMTi! 🧡
  </p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
  <p style="font-size:11px;color:#999;margin:0;">WMTi Tecnologia da Informação LTDA — CNPJ 13.366.668/0001-07</p>
  <p style="font-size:11px;color:#999;margin:4px 0 0;">Rua José Benedito Duarte, 140 — Parque Itamarati — Jacareí/SP</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    console.log(`[send-purchase-confirmation] Sending confirmation to ${customer_email}`);
    console.log(`[send-purchase-confirmation] Service: ${service_name}, Value: ${valueFormatted}`);

    // Send email via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "WMTi Tecnologia <onboarding@resend.dev>",
        to: [customer_email],
        subject: `✅ Pagamento confirmado — ${service_name} — WMTi`,
        html: emailHtml,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("[send-purchase-confirmation] Resend error:", JSON.stringify(resendResult));
      // Log failure but don't throw - still return success to avoid retries
    } else {
      console.log("[send-purchase-confirmation] Email sent successfully:", resendResult.id);
    }

    // Log to integration_logs for audit
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    await supabase.from("integration_logs").insert({
      integration_name: "email",
      operation_name: "purchase_confirmation_sent",
      request_payload: {
        to: customer_email,
        customer_name,
        service_name,
        value,
        payment_method,
        contract_ref,
      },
      response_payload: {
        resend_id: resendResult?.id || null,
        resend_status: resendResponse.ok ? "sent" : "failed",
        resend_error: !resendResponse.ok ? resendResult : null,
      },
      status: resendResponse.ok ? "success" : "error",
      error_message: !resendResponse.ok ? JSON.stringify(resendResult) : null,
    });

    return new Response(
      JSON.stringify({
        success: resendResponse.ok,
        message: resendResponse.ok ? "Email sent successfully" : "Email send failed but logged",
        resend_id: resendResult?.id || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-purchase-confirmation] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
