import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildPendingServicesAlertHtml, buildPendingServicesAlertText } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_TOKEN = Deno.env.get("EVOLUTION_API_TOKEN") || "";
const ADMIN_PHONE = "5511978481919";
const ADMIN_EMAIL = "eu@queroarmas.com.br";

const FINISHED_STATUSES = ["DEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO", "INDEFERIDO"];

interface PendingItem {
  clienteNome: string;
  celular: string | null;
  servico: string;
  dias: number;
  status: string;
}

function getDaysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

async function fetchPendingItemsFromDB(): Promise<PendingItem[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  const [iRes, vRes, cRes, sRes] = await Promise.all([
    sb.from("qa_itens_venda").select("*"),
    sb.from("qa_vendas").select("id, data_cadastro, status, cliente_id"),
    sb.from("qa_clientes").select("id, nome_completo, celular"),
    sb.from("qa_servicos").select("id, nome_servico"),
  ]);

  const itens = (iRes.data as any[]) || [];
  const vendas = (vRes.data as any[]) || [];
  const clientes = (cRes.data as any[]) || [];
  const servicos = (sRes.data as any[]) || [];

  const vendaMap = new Map(vendas.map((v: any) => [v.id, v]));
  const clienteMap = new Map(clientes.map((c: any) => [c.id, c]));
  const servicoMap = new Map(servicos.map((s: any) => [s.id, s]));

  const pending: PendingItem[] = [];

  for (const item of itens) {
    if (FINISHED_STATUSES.includes((item.status || "").toUpperCase())) continue;
    const venda = vendaMap.get(item.venda_id);
    if (!venda) continue;
    const cliente = clienteMap.get(venda.cliente_id);
    const servico = item.servico_id ? servicoMap.get(item.servico_id) : null;
    const dias = getDaysSince(venda.data_cadastro);

    pending.push({
      clienteNome: cliente?.nome_completo || "—",
      celular: cliente?.celular || null,
      servico: servico?.nome_servico || `Serviço #${item.servico_id || "?"}`,
      dias,
      status: item.status || "Sem status",
    });
  }

  // Ordenar por dias pendentes (mais antigos primeiro)
  pending.sort((a, b) => b.dias - a.dias);
  return pending;
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
    const subject = `Pendências de serviços - Quero Armas (${items.length})`;

    const res = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        to: ADMIN_EMAIL,
        subject,
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
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body from cron */ }

    let items: PendingItem[] = body.items || [];
    const isCron = !body.items || body.source === "cron-daily";

    // Se chamada pelo cron ou sem items, buscar do banco
    if (items.length === 0) {
      items = await fetchPendingItemsFromDB();
    }

    // Default: cron envia ambos; manual respeita o channel
    const sendChannel = isCron ? "both" : (body.channel || "both");

    if (items.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Nenhum serviço pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { whatsapp?: { ok: boolean; error?: string }; email?: { ok: boolean; error?: string } } = {};

    if (sendChannel === "whatsapp" || sendChannel === "both") {
      const lines = items.map((i) => {
        const emoji = i.dias >= 30 ? "🔴" : i.dias >= 25 ? "🟡" : "⚠️";
        return `${emoji} *${i.clienteNome}*\n   ${i.servico}\n   Status: ${i.status} | ${i.dias} dias`;
      });
      const adminMsg = `📋 *ALERTA — Serviços Pendentes*\n\n${lines.join("\n\n")}\n\n_Total: ${items.length} serviço(s) pendente(s)_`;
      results.whatsapp = await sendWhatsApp(ADMIN_PHONE, adminMsg);
    }

    if (sendChannel === "email" || sendChannel === "both") {
      results.email = await sendEmail(items);
    }

    const anyOk = (results.whatsapp?.ok ?? false) || (results.email?.ok ?? false);

    return new Response(
      JSON.stringify({ success: anyOk, results, totalItems: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
