import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_TOKEN = Deno.env.get("EVOLUTION_API_TOKEN") || "";
const ADMIN_PHONE = "5511999999999"; // fallback — alerts go to admin

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items } = await req.json() as { items: PendingItem[] };

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build summary message for admin
    const lines = items.map((i) => {
      const emoji = i.dias >= 30 ? "🔴" : i.dias >= 25 ? "🟡" : "⚠️";
      return `${emoji} *${i.clienteNome}*\n   ${i.servico}\n   Status: ${i.status} | ${i.dias} dias`;
    });

    const adminMsg = `📋 *ALERTA — Serviços Pendentes*\n\n${lines.join("\n\n")}\n\n_Total: ${items.length} serviço(s) crítico(s)_`;

    // Send consolidated alert to admin
    const adminResult = await sendWhatsApp(ADMIN_PHONE, adminMsg);

    return new Response(
      JSON.stringify({ success: adminResult.ok, sent: adminResult.ok ? 1 : 0, error: adminResult.error }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
