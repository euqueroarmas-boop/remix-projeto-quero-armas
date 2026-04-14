import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildPendingServicesAlertHtml, buildPendingServicesAlertText } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_TOKEN = Deno.env.get("EVOLUTION_API_TOKEN") || "";
const ADMIN_PHONE = "5511978481919";
const ADMIN_EMAIL = "eu@queroarmas.com.br";

interface PendingItem {
  clienteNome: string;
  celular: string | null;
  servico: string;
  dias: number;
  status: string;
}

async function sendWhatsApp(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    return { ok: false, error: "Evolution API não configurada" };
  }
  try {
    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/message/sendText/queroarmas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN },
      body: JSON.stringify({ number: phone.replace(/\D/g, ""), text: message }),
    });
    const data = await res.json();
    return { ok: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendEmail(items: PendingItem[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const html = buildPendingServicesAlertHtml({ items });
    const text = buildPendingServicesAlertText({ items });

    const res = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        to: ADMIN_EMAIL,
        subject: `Alerta de serviços pendentes — Quero Armas (${items.length})`,
        html,
        text,
        trace_id: `qa-alert-${crypto.randomUUID()}`,
      }),
    });

    const data = await res.json();
    return { ok: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, channel } = await req.json() as { items: PendingItem[]; channel?: "whatsapp" | "email" | "both" };
    const sendChannel = channel || "whatsapp";

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { whatsapp?: { ok: boolean; error?: string }; email?: { ok: boolean; error?: string } } = {};

    if (sendChannel === "whatsapp" || sendChannel === "both") {
      const lines = items.map((i) => {
        const emoji = i.dias >= 30 ? "🔴" : i.dias >= 25 ? "🟡" : "⚠️";
        return `${emoji} *${i.clienteNome}*\n   ${i.servico}\n   Status: ${i.status} | ${i.dias} dias`;
      });
      const adminMsg = `📋 *ALERTA — Serviços Pendentes*\n\n${lines.join("\n\n")}\n\n_Total: ${items.length} serviço(s) crítico(s)_`;
      results.whatsapp = await sendWhatsApp(ADMIN_PHONE, adminMsg);
    }

    if (sendChannel === "email" || sendChannel === "both") {
      results.email = await sendEmail(items);
    }

    const anyOk = (results.whatsapp?.ok ?? false) || (results.email?.ok ?? false);

    return new Response(
      JSON.stringify({ success: anyOk, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
