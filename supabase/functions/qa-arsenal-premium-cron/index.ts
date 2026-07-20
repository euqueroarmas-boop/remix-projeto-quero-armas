// qa-arsenal-premium-cron
// Rotina diária do Arsenal Inteligente Premium. Quatro passos:
//
//   A) Gratuidade automática — clientes com serviço pago e CPF sem histórico
//      de assinatura ganham 3 meses (status 'gratuidade').
//   B) Polling de pagamento — assinaturas 'aguardando_pagamento' têm o payment
//      consultado na Asaas; confirmado → 'ativa' por 365 dias a partir de hoje.
//   C) Avisos de renovação — e-mail nos marcos 45,40,35,30,25,20,15,10..1,0
//      dias antes do fim do período (antidup em qa_arsenal_avisos_enviados).
//   D) Suspensão — 3 dias de carência após periodo_fim; depois 'suspensa'
//      + e-mail de bloqueio.
//
// Usa a infraestrutura existente `send-smtp-email`. NÃO cria fila nova.
// Quando a tokenização de cartão estiver disponível, o passo C passa a
// disparar também a cobrança automática no cartão salvo (chargeWithToken).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireCronToken } from "../_shared/qaAuth.ts";
import { ASAAS_USER_AGENT, getAsaasEnv } from "../_shared/qaAsaas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

const MARCOS = [45, 40, 35, 30, 25, 20, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const CARENCIA_DIAS = 3;
const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente/financeiro";

function hojeZero(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasAte(dateISO: string): number {
  const v = new Date(`${dateISO}T00:00:00`);
  return Math.floor((v.getTime() - hojeZero().getTime()) / 86400000);
}

function addMonthsISO(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function htmlBase(titulo: string, corpo: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#4a1219,#7A1F2B);padding:20px 25px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;font-size:18px;margin:0;">${titulo}</h1>
      </div>
      <div style="background:#fff;padding:25px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        ${corpo}
        <div style="margin:20px 0;text-align:center;">
          <a href="${PORTAL_URL}" style="display:inline-block;background:#7A1F2B;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:bold;font-size:13px;">
            Abrir meu Arsenal Inteligente
          </a>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin-top:20px;">
          Quero Armas · Arsenal Inteligente Premium · naoresponda@queroarmas.com.br
        </p>
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronCheck = requireCronToken(req);
  if (!cronCheck.ok) return cronCheck.response;

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, service);

  const hoje = hojeZero();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const stats = { gratuidades: 0, ativadas: 0, avisos: 0, suspensas: 0, erros: [] as string[] };

  // ── A) Gratuidade automática para clientes com serviço pago ──────────────
  try {
    const { data: vendasPagas } = await sb
      .from("qa_vendas")
      .select("cliente_id")
      .or("status.eq.PAGO,cobranca_status.eq.confirmada")
      .not("cliente_id", "is", null)
      .limit(2000);
    const idsLegado = [...new Set((vendasPagas || []).map((v: any) => Number(v.cliente_id)))];

    if (idsLegado.length > 0) {
      const { data: clientes } = await sb
        .from("qa_clientes")
        .select("id, id_legado, cpf")
        .in("id_legado", idsLegado);

      for (const c of clientes || []) {
        const cpf = String(c.cpf || "").replace(/\D/g, "");
        if (!cpf) continue;
        const { count } = await sb
          .from("qa_arsenal_assinaturas")
          .select("id", { count: "exact", head: true })
          .eq("cpf", cpf);
        if ((count ?? 0) > 0) continue; // gratuidade é 1x por CPF

        const { error } = await sb.from("qa_arsenal_assinaturas").insert({
          cliente_id: c.id,
          cpf,
          status: "gratuidade",
          origem_gratuidade: "servico_contratado",
          periodo_inicio: hojeISO,
          periodo_fim: addMonthsISO(hoje, 3),
          valor_anual: 297,
        });
        if (!error) stats.gratuidades++;
      }
    }
  } catch (e) {
    stats.erros.push(`gratuidade: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ── B) Polling de pagamento na Asaas ─────────────────────────────────────
  try {
    const env = getAsaasEnv();
    if (!("error" in env)) {
      const { data: pendentes } = await sb
        .from("qa_arsenal_assinaturas")
        .select("id, asaas_payment_id")
        .eq("status", "aguardando_pagamento")
        .not("asaas_payment_id", "is", null)
        .limit(200);

      for (const a of pendentes || []) {
        try {
          const r = await fetch(`${env.baseUrl}/payments/${a.asaas_payment_id}`, {
            headers: { access_token: env.key, "User-Agent": ASAAS_USER_AGENT },
          });
          if (!r.ok) continue;
          const p = await r.json();
          const st = String(p?.status || "").toUpperCase();
          if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(st)) {
            await sb
              .from("qa_arsenal_assinaturas")
              .update({
                status: "ativa",
                periodo_inicio: hojeISO,
                periodo_fim: addDaysISO(hoje, 365),
                atualizado_em: new Date().toISOString(),
              })
              .eq("id", a.id);
            stats.ativadas++;
          }
        } catch { /* tenta na próxima rodada */ }
      }
    }
  } catch (e) {
    stats.erros.push(`polling: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ── C) Avisos de renovação (marcos 45..0) ────────────────────────────────
  try {
    const limite = addDaysISO(hoje, 46);
    const { data: vigentes } = await sb
      .from("qa_arsenal_assinaturas")
      .select("id, cliente_id, periodo_fim, status")
      .in("status", ["gratuidade", "ativa"])
      .lte("periodo_fim", limite)
      .gte("periodo_fim", hojeISO)
      .limit(500);

    for (const a of vigentes || []) {
      const dias = diasAte(a.periodo_fim);
      if (!MARCOS.includes(dias)) continue;

      const { data: ja } = await sb
        .from("qa_arsenal_avisos_enviados")
        .select("id")
        .eq("assinatura_id", a.id)
        .eq("periodo_fim", a.periodo_fim)
        .eq("marco", dias)
        .maybeSingle();
      if (ja) continue;

      const { data: cliente } = await sb
        .from("qa_clientes")
        .select("nome_completo, email")
        .eq("id", a.cliente_id)
        .maybeSingle();
      if (!cliente?.email) continue;

      const nome = String(cliente.nome_completo || "cliente").split(/\s+/)[0];
      const fimBR = fmtBR(a.periodo_fim);
      const gratuidade = a.status === "gratuidade";
      const subject = dias === 0
        ? `🚨 Seu Arsenal Inteligente ${gratuidade ? "gratuito " : ""}vence HOJE`
        : `⚠️ Arsenal Inteligente: ${gratuidade ? "período gratuito termina" : "renovação"} em ${dias} dia(s)`;
      const corpo = `
        <p style="font-size:14px;color:#334155;">Olá, <strong>${nome}</strong>.</p>
        <p style="font-size:14px;color:#334155;">
          ${gratuidade
            ? `Seu período gratuito do <strong>Arsenal Inteligente Premium</strong> termina em <strong>${fimBR}</strong>${dias === 0 ? " — <strong>hoje</strong>" : ` (${dias} dia(s))`}.`
            : `Sua assinatura do <strong>Arsenal Inteligente Premium</strong> vence em <strong>${fimBR}</strong>${dias === 0 ? " — <strong>hoje</strong>" : ` (${dias} dia(s))`}.`}
        </p>
        <p style="font-size:14px;color:#334155;">
          Renove por <strong>R$ 297/ano</strong> — em até <strong>12x de R$ 24,75 no cartão</strong>,
          ou à vista por PIX/boleto. Sem renovação, o acesso ao Klal, à gestão de armas e
          munições e aos alertas de documentos é suspenso ${CARENCIA_DIAS} dias após o vencimento.
          O acompanhamento dos seus processos contratados continua garantido.
        </p>`;

      try {
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        const res = await sendTransactional({
          templateName: "arsenal-premium-renovacao",
          recipientEmail: cliente.email,
          idempotencyKey: `arsenal-premium-${a.id}-${dias}`,
          templateData: {
            nome,
            diasRestantes: String(dias),
            dataFim: fimBR,
            gratuidade: Boolean(gratuidade),
            valor: "R$ 297/ano",
            parcelas: "12x de R$ 24,75",
            carenciaDias: String(CARENCIA_DIAS),
            portalUrl: "https://www.euqueroarmas.com.br/area-do-cliente",
          },
        });
        if (!res.ok) throw new Error(res.error);
        await sb.from("qa_arsenal_avisos_enviados").insert({
          assinatura_id: a.id,
          periodo_fim: a.periodo_fim,
          marco: dias,
        });
        stats.avisos++;
      } catch (err) {
        stats.erros.push(`aviso ${a.id}/${dias}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  } catch (e) {
    stats.erros.push(`avisos: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ── D) Suspensão após carência de 3 dias ─────────────────────────────────
  try {
    const corte = addDaysISO(hoje, -CARENCIA_DIAS);
    const { data: vencidas } = await sb
      .from("qa_arsenal_assinaturas")
      .select("id, cliente_id, periodo_fim")
      .in("status", ["gratuidade", "ativa", "aguardando_pagamento"])
      .lt("periodo_fim", corte)
      .limit(500);

    for (const a of vencidas || []) {
      await sb
        .from("qa_arsenal_assinaturas")
        .update({ status: "suspensa", atualizado_em: new Date().toISOString() })
        .eq("id", a.id);
      stats.suspensas++;

      const { data: cliente } = await sb
        .from("qa_clientes")
        .select("nome_completo, email")
        .eq("id", a.cliente_id)
        .maybeSingle();
      if (!cliente?.email) continue;
      const nome = String(cliente.nome_completo || "cliente").split(/\s+/)[0];
      const corpo = `
        <p style="font-size:14px;color:#334155;">Olá, <strong>${nome}</strong>.</p>
        <p style="font-size:14px;color:#334155;">
          Sua assinatura do <strong>Arsenal Inteligente Premium</strong> venceu em
          <strong>${fmtBR(a.periodo_fim)}</strong> e, após ${CARENCIA_DIAS} dias sem
          confirmação do pagamento, o acesso Premium foi <strong>suspenso</strong>.
        </p>
        <p style="font-size:14px;color:#334155;">
          O acompanhamento dos seus processos contratados continua disponível.
          Para reativar o Klal, a gestão de armas e munições e os alertas de
          documentos, renove a assinatura no painel — o acesso volta na hora.
        </p>`;
      try {
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        await sendTransactional({
          templateName: "arsenal-premium-suspenso",
          recipientEmail: cliente.email,
          idempotencyKey: `arsenal-premium-susp-${a.id}`,
          templateData: {
            nome,
            dataFim: fmtBR(a.periodo_fim),
            carenciaDias: String(CARENCIA_DIAS),
            portalUrl: "https://www.euqueroarmas.com.br/area-do-cliente",
          },
        });
      } catch { /* suspensão já aplicada; e-mail tentará de novo em próxima execução */ }
    }
  } catch (e) {
    stats.erros.push(`suspensao: ${e instanceof Error ? e.message : "unknown"}`);
  }

  return new Response(JSON.stringify({ success: true, ...stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
