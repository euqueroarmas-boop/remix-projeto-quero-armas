// qa-notificar-admin-contratacao
// Avisa o admin (WhatsApp + Email) quando um cliente contrata um novo serviço
// pelo portal logado. Reutiliza Evolution API (instância "queroarmas") e
// send-smtp-email já configurados.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_TOKEN = Deno.env.get("EVOLUTION_API_TOKEN") || "";
const ADMIN_PHONE = "5511978481919";
const ADMIN_EMAIL = "eu@queroarmas.com.br";
const ADMIN_PORTAL = "https://www.euqueroarmas.com.br/contratacoes-pendentes";
const ADMIN_PORTAL_VENDAS = "https://www.euqueroarmas.com.br/operacao/contratacoes";

interface Body {
  processo_id?: string;
  venda_id?: number;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendWhatsApp(phone: string, message: string) {
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
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const traceId = `qa-notif-admin-${crypto.randomUUID()}`;
  try {
    const { processo_id, venda_id } = (await req.json()) as Body;
    if (!processo_id && !venda_id) {
      return new Response(
        JSON.stringify({ error: "processo_id ou venda_id obrigatório", traceId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let nome = "Cliente";
    let cpf = "—";
    let tel = "—";
    let email = "—";
    let servico = "—";
    let data = new Date().toLocaleString("pt-BR");
    let valorInformado: string | null = null;
    let origemRotulo = "Portal logado";
    let portalLink = ADMIN_PORTAL;
    let statusRotulo = "Aguardando pagamento";

    if (venda_id) {
      // Fluxo de venda (Fase 16-E)
      const { data: venda } = await supabase
        .from("qa_vendas")
        .select("id, id_legado, cliente_id, valor_informado_cliente, origem_proposta, created_at")
        .eq("id", venda_id)
        .maybeSingle();
      if (!venda) throw new Error("Venda não encontrada");

      const cliLegado = venda.cliente_id as number;
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("nome_completo, cpf, email, celular")
        .or(`id_legado.eq.${cliLegado},id.eq.${cliLegado}`)
        .limit(1)
        .maybeSingle();
      const { data: item } = await supabase
        .from("qa_itens_venda")
        .select("servico_id")
        .eq("venda_id", venda.id_legado)
        .limit(1)
        .maybeSingle();
      const { data: svc } = item?.servico_id
        ? await supabase.from("qa_servicos").select("nome").eq("id", item.servico_id).maybeSingle()
        : { data: null } as any;
      nome = cli?.nome_completo || "Cliente";
      cpf = cli?.cpf || "—";
      tel = cli?.celular || "—";
      email = cli?.email || "—";
      servico = svc?.nome || "—";
      data = new Date(venda.created_at || Date.now()).toLocaleString("pt-BR");
      valorInformado = venda.valor_informado_cliente
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(venda.valor_informado_cliente))
        : null;
      origemRotulo = venda.origem_proposta === "wizard_publico" ? "Wizard público" : "Portal cliente";
      portalLink = ADMIN_PORTAL_VENDAS;
      statusRotulo = "Aguardando validação de valor";
    } else if (processo_id) {
      const { data: proc } = await supabase
        .from("qa_processos")
        .select("id, cliente_id, servico_nome, status, pagamento_status, data_criacao, observacoes_admin")
        .eq("id", processo_id)
        .maybeSingle();
      if (!proc) throw new Error("Processo não encontrado");
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("nome_completo, cpf, email, celular")
        .eq("id", proc.cliente_id)
        .maybeSingle();
      nome = cli?.nome_completo || "Cliente";
      cpf = cli?.cpf || "—";
      tel = cli?.celular || "—";
      email = cli?.email || "—";
      servico = proc.servico_nome || "—";
      data = new Date(proc.data_criacao || Date.now()).toLocaleString("pt-BR");
    }

    // WhatsApp para admin
    const wppMsg = [
      venda_id ? `🆕 *NOVA CONTRATAÇÃO (VENDA) — QUERO ARMAS*` : `🆕 *NOVA CONTRATAÇÃO — QUERO ARMAS*`,
      ``,
      `👤 *${nome}*`,
      `CPF: ${cpf}`,
      `📱 ${tel}`,
      `✉️ ${email}`,
      ``,
      `🛡️ *Serviço:* ${servico}`,
      `🕒 ${data}`,
      ...(valorInformado ? [`💰 *Valor informado:* ${valorInformado}`] : []),
      `📌 *Origem:* ${origemRotulo}`,
      `🔎 *Status:* ${statusRotulo}`,
      ``,
      `▶️ ${portalLink}`,
    ].join("\n");

    const wpp = await sendWhatsApp(ADMIN_PHONE, wppMsg);

    // Email para admin
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f6f7f9;margin:0;padding:24px;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
<tr><td style="background:#0f172a;padding:22px 28px;color:#fff;">
<div style="font-size:11px;letter-spacing:0.18em;color:#fbbf24;font-weight:700;">QUERO ARMAS · ADMIN</div>
<div style="font-size:20px;font-weight:700;margin-top:6px;">Nova contratação pelo portal</div>
</td></tr>
<tr><td style="padding:24px 28px;">
<p style="margin:0 0 12px;font-size:14px;">O cliente abaixo contratou um novo serviço pelo portal logado. <strong>Validação manual de pagamento</strong> necessária.</p>
<table cellpadding="6" cellspacing="0" style="width:100%;font-size:13px;border-collapse:collapse;margin-top:8px;">
<tr><td style="color:#64748b;width:120px;">Cliente</td><td><strong>${escapeHtml(nome)}</strong></td></tr>
<tr><td style="color:#64748b;">CPF</td><td>${escapeHtml(cpf)}</td></tr>
<tr><td style="color:#64748b;">Telefone</td><td>${escapeHtml(tel)}</td></tr>
<tr><td style="color:#64748b;">E-mail</td><td>${escapeHtml(email)}</td></tr>
<tr><td style="color:#64748b;">Serviço</td><td><strong>${escapeHtml(servico)}</strong></td></tr>
<tr><td style="color:#64748b;">Data</td><td>${escapeHtml(data)}</td></tr>
<tr><td style="color:#64748b;">Status</td><td><span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:6px;font-weight:700;font-size:11px;text-transform:uppercase;">Aguardando pagamento</span></td></tr>
</table>
<p style="text-align:center;margin:24px 0 0;">
<a href="${ADMIN_PORTAL}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">Abrir contratações pendentes</a>
</p>
</td></tr>
<tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} Quero Armas — notificação automática.</td></tr>
</table></td></tr></table></body></html>`;

    const text = `Nova contratação — Quero Armas\n\nCliente: ${nome}\nCPF: ${cpf}\nTelefone: ${tel}\nE-mail: ${email}\nServiço: ${servico}\nData: ${data}\nStatus: aguardando pagamento\n\nAcesse: ${ADMIN_PORTAL}`;

    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") ?? "";
    const emailRes = await supabase.functions.invoke("send-smtp-email", {
      headers: { "x-internal-token": internalToken },
      body: {
        to: ADMIN_EMAIL,
        subject: `🆕 Nova contratação: ${nome} — ${servico}`,
        html,
        text,
        trace_id: traceId,
      },
    });
    const emailOk = !emailRes.error && (emailRes.data as any)?.success;

    return new Response(
      JSON.stringify({
        success: true,
        traceId,
        whatsapp: wpp,
        email: { ok: emailOk },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[qa-notificar-admin-contratacao][${traceId}]`, msg);
    return new Response(
      JSON.stringify({ error: msg, traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});