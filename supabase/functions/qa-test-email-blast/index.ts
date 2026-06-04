import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  qaArsenalWelcomeHtml, qaArsenalWelcomeText,
} from "../_shared/qaEmailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TOKEN = Deno.env.get("INTERNAL_FUNCTION_TOKEN")!;

const PORTAL = "https://www.euqueroarmas.com.br/area-do-cliente";
const ARSENAL = "https://www.euqueroarmas.com.br/arsenal-digital";
const RESET = "https://www.euqueroarmas.com.br/redefinir-senha?token=DEMO";

const SAMPLES = [
  { name: "Welcome (boas-vindas portal)", subject: "[TESTE] Bem-vindo ao Quero Armas",
    html: qaWelcomeHtml({ name: "WILL MASSAROTO", email: "willmassaroto@gmail.com", tempPassword: "TEMP-1234", portalUrl: PORTAL }),
    text: qaWelcomeText({ name: "WILL MASSAROTO", email: "willmassaroto@gmail.com", tempPassword: "TEMP-1234", portalUrl: PORTAL }) },
  { name: "OTP (código de verificação)", subject: "[TESTE] Seu código de verificação",
    html: qaOtpHtml({ name: "WILL", code: "482910", minutes: 10 }),
    text: qaOtpText({ name: "WILL", code: "482910", minutes: 10 }) },
  { name: "Password Reset", subject: "[TESTE] Redefinir senha",
    html: qaPasswordResetHtml({ name: "WILL", resetUrl: RESET, minutes: 30 }),
    text: qaPasswordResetText({ name: "WILL", resetUrl: RESET, minutes: 30 }) },
  { name: "Password Changed", subject: "[TESTE] Sua senha foi alterada",
    html: qaPasswordChangedHtml({ email: "willmassaroto@gmail.com", name: "WILL" }),
    text: qaPasswordChangedText({ email: "willmassaroto@gmail.com" }) },
  { name: "Payment Pending", subject: "[TESTE] Cobrança disponível",
    html: qaPaymentPendingHtml({ name: "WILL", value: "R$ 350,00", dueDate: "10/05/2026", billingType: "PIX", invoiceUrl: "https://exemplo.com/invoice" }),
    text: qaPaymentPendingText({ name: "WILL", value: "R$ 350,00", dueDate: "10/05/2026", billingType: "PIX", invoiceUrl: "https://exemplo.com/invoice" }) },
  { name: "Payment Overdue", subject: "[TESTE] Cobrança em atraso",
    html: qaPaymentOverdueHtml({ name: "WILL", value: "R$ 350,00", dueDate: "01/04/2026", invoiceUrl: "https://exemplo.com/invoice" }),
    text: qaPaymentOverdueText({ name: "WILL", value: "R$ 350,00", dueDate: "01/04/2026", invoiceUrl: "https://exemplo.com/invoice" }) },
  { name: "Payment Confirmed", subject: "[TESTE] Pagamento confirmado",
    html: qaPaymentConfirmedHtml({ name: "WILL", value: "R$ 350,00", paidAt: "01/05/2026", invoiceUrl: "https://exemplo.com/recibo" }),
    text: qaPaymentConfirmedText({ name: "WILL", value: "R$ 350,00", paidAt: "01/05/2026" }) },
  { name: "Case Update", subject: "[TESTE] Atualização do seu processo",
    html: qaCaseUpdateHtml({ name: "WILL", caseTitle: "PORTE DE ARMA — POSSE", status: "EM ANDAMENTO", message: "Documentos protocolados na PF.", portalUrl: PORTAL }),
    text: qaCaseUpdateText({ name: "WILL", caseTitle: "PORTE DE ARMA — POSSE", status: "EM ANDAMENTO", message: "Documentos protocolados na PF." }) },
  { name: "Document Ready", subject: "[TESTE] Documento disponível",
    html: qaDocumentReadyHtml({ name: "WILL", documentName: "CRAF.PDF", portalUrl: PORTAL }),
    text: qaDocumentReadyText({ name: "WILL", documentName: "CRAF.PDF" }) },
  { name: "Generic", subject: "[TESTE] Comunicado",
    html: qaGenericHtml({ name: "WILL", subject: "Comunicado importante", message: "Esta é uma mensagem genérica de teste do sistema Quero Armas.", ctaUrl: PORTAL, ctaLabel: "ACESSAR PORTAL" }),
    text: qaGenericText({ name: "WILL", subject: "Comunicado importante", message: "Esta é uma mensagem genérica de teste do sistema Quero Armas.", ctaUrl: PORTAL, ctaLabel: "ACESSAR PORTAL" }) },
  { name: "Arsenal Welcome", subject: "[TESTE] Bem-vindo ao Arsenal Digital",
    html: qaArsenalWelcomeHtml({ name: "WILL MASSAROTO", email: "willmassaroto@gmail.com", servicoInteresse: "PORTE DE ARMA", arsenalUrl: ARSENAL }),
    text: qaArsenalWelcomeText({ name: "WILL MASSAROTO", email: "willmassaroto@gmail.com", servicoInteresse: "PORTE DE ARMA", arsenalUrl: ARSENAL }) },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { to } = await req.json().catch(() => ({ to: null }));
    const recipient = (to || "willmassaroto@gmail.com").toLowerCase();
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const results: Array<{ template: string; ok: boolean; error?: string }> = [];

    for (const sample of SAMPLES) {
      try {
        const { data, error } = await supabase.functions.invoke("send-smtp-email", {
          body: { to: recipient, subject: sample.subject, html: sample.html, text: sample.text },
          headers: { "x-internal-token": INTERNAL_TOKEN },
        });
        if (error) throw new Error(error.message || JSON.stringify(error));
        if ((data as any)?.error) throw new Error((data as any).error);
        results.push({ template: sample.name, ok: true });
      } catch (e) {
        results.push({ template: sample.name, ok: false, error: String((e as Error)?.message || e) });
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    const sent = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ recipient, total: results.length, sent, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});