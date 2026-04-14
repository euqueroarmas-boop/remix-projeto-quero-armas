import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/wmti`, {
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

    const rows = items.map(i => {
      const cor = i.dias >= 30 ? "#991b1b" : i.dias >= 25 ? "#dc2626" : i.dias >= 10 ? "#ca8a04" : "#16a34a";
      const badge = i.dias >= 30 ? "VENCIDO" : i.dias >= 25 ? "URGENTE" : i.dias >= 10 ? "ATENÇÃO" : "NO PRAZO";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #222">${i.clienteNome}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #222">${i.servico}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #222">${i.status}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #222;text-align:center;font-weight:bold">${i.dias}d</td>
        <td style="padding:8px 12px;border-bottom:1px solid #222;text-align:center">
          <span style="background:${cor};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${badge}</span>
        </td>
      </tr>`;
    }).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
        <div style="background:#111;padding:20px;border-radius:8px">
          <h2 style="color:#e8a0ad;margin:0 0 4px">⚠️ Alerta — Serviços Pendentes</h2>
          <p style="color:#999;font-size:13px;margin:0 0 16px">${items.length} serviço(s) requerem atenção</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#ccc">
            <thead>
              <tr style="background:#1a1a1a">
                <th style="padding:8px 12px;text-align:left;color:#888;font-size:11px">CLIENTE</th>
                <th style="padding:8px 12px;text-align:left;color:#888;font-size:11px">SERVIÇO</th>
                <th style="padding:8px 12px;text-align:left;color:#888;font-size:11px">STATUS</th>
                <th style="padding:8px 12px;text-align:center;color:#888;font-size:11px">DIAS</th>
                <th style="padding:8px 12px;text-align:center;color:#888;font-size:11px">URGÊNCIA</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#666;font-size:11px;margin:16px 0 0;text-align:center">Relatório gerado automaticamente — Quero Armas</p>
        </div>
      </div>`;

    const res = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        to: ADMIN_EMAIL,
        subject: `⚠️ ${items.length} Serviço(s) Pendente(s) — Quero Armas`,
        html,
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
