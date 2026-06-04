import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * qa-gte-alertas
 *
 * Cron diário que verifica GTEs próximas/vencidas e dispara alertas por
 * e-mail (cliente + equipe) usando a infraestrutura existente
 * `send-smtp-email` com remetente `naoresponda@queroarmas.com.br`.
 *
 * Antiduplicidade via `qa_gte_alertas_enviados` (UNIQUE em
 * gte_documento_id + marco_dias + canal).
 *
 * NÃO cria pgmq, nova fila de e-mail, Lovable Emails ou cron paralelo.
 * NÃO substitui rotinas de exames/CR/CRAF — apenas adiciona a GTE.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

// Marcos pré-vencimento + dia do vencimento + pós-vencimento controlado
const MARCOS = [90, 60, 30, 15, 7, 1, 0, -1, -7, -30];
const EQUIPE_MARCOS = new Set([30, 7, 0, -7]);
const EMAIL_EQUIPE = "naoresponda@queroarmas.com.br"; // copia interna usa o mesmo remetente

interface GteRow {
  id: string;
  cliente_id: number;
  numero_gte: string | null;
  data_validade: string | null;
  status_processamento: string;
}

function diasRestantes(validade: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(`${validade}T00:00:00`);
  return Math.floor((v.getTime() - hoje.getTime()) / 86400000);
}

function pickMarco(d: number): number | null {
  // Casamento por valor exato (cron diário garante 1 batida/dia)
  if (MARCOS.includes(d)) return d;
  // Para vencidas, agrupa em -7 (semanal) e -30 (mensal)
  if (d < 0 && d > -7) return null;
  if (d <= -7 && d > -30) return -7;
  if (d <= -30) return -30;
  return null;
}

function htmlAlerta(opts: {
  nome: string;
  numeroGte: string;
  validadeBR: string;
  dias: number;
  marco: number;
}) {
  const { nome, numeroGte, validadeBR, dias, marco } = opts;
  const vencida = dias < 0;
  const titulo = vencida
    ? `🚨 GTE Nº ${numeroGte} VENCIDA`
    : marco === 0
      ? `🚨 GTE Nº ${numeroGte} vence HOJE`
      : `⚠️ GTE Nº ${numeroGte} vence em ${dias} dia(s)`;
  const corHeader = vencida || marco <= 7
    ? "linear-gradient(135deg,#7f1d1d,#dc2626)"
    : "linear-gradient(135deg,#92400e,#f59e0b)";
  const portalLink = "https://www.euqueroarmas.com.br/area-do-cliente";
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:${corHeader};padding:20px 25px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;font-size:18px;margin:0;">${titulo}</h1>
      </div>
      <div style="background:#fff;padding:25px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:14px;color:#334155;">Olá, <strong>${nome}</strong>.</p>
        <p style="font-size:14px;color:#334155;">
          ${vencida
            ? `Sua <strong>Guia de Tráfego Especial Nº ${numeroGte}</strong> está <strong style="color:#dc2626;">VENCIDA</strong> desde <strong>${validadeBR}</strong> (${Math.abs(dias)} dia(s) de atraso).`
            : `Sua <strong>Guia de Tráfego Especial Nº ${numeroGte}</strong> vence em <strong style="color:#dc2626;">${dias} dia(s)</strong> — <strong>${validadeBR}</strong>.`}
        </p>
        <p style="font-size:14px;color:#334155;">
          A GTE é obrigatória para o transporte legal das suas armas. Sem ela, qualquer deslocamento pode resultar em apreensão.
          Solicite a renovação com antecedência ou envie a nova guia pelo Arsenal do seu portal.
        </p>
        <div style="margin:20px 0;text-align:center;">
          <a href="${portalLink}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:bold;font-size:13px;">
            Acessar meu Arsenal
          </a>
        </div>
        <div style="padding:15px;background:#fef3c7;border-radius:8px;border:1px solid #fde68a;">
          <p style="margin:0;font-size:12px;color:#92400e;">
            <strong>📋 Importante:</strong> Mantenha sempre uma GTE válida. A equipe Quero Armas pode auxiliar na renovação.
          </p>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin-top:20px;">
          Quero Armas — Assessoria Jurídica · naoresponda@queroarmas.com.br
        </p>
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: cron token OU staff
  const { requireQAStaff, requireCronToken } = await import("../_shared/qaAuth.ts");
  const cronCheck = requireCronToken(req);
  if (!cronCheck.ok) {
    const staffCheck = await requireQAStaff(req);
    if (!staffCheck.ok) return staffCheck.response;
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) Buscar GTEs concluídas com data_validade
    const { data: gtes, error } = await sb
      .from("qa_gte_documentos")
      .select("id, cliente_id, numero_gte, data_validade, status_processamento")
      .eq("status_processamento", "concluido")
      .not("data_validade", "is", null);
    if (error) throw error;

    interface Cand { gte: GteRow; marco: number; dias: number }
    const cand: Cand[] = [];
    for (const g of (gtes || []) as GteRow[]) {
      if (!g.data_validade) continue;
      const d = diasRestantes(g.data_validade);
      const m = pickMarco(d);
      if (m === null) continue;
      cand.push({ gte: g, marco: m, dias: d });
    }

    if (cand.length === 0) {
      return new Response(JSON.stringify({ success: true, alerts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Já enviados
    const ids = cand.map((c) => c.gte.id);
    const { data: jaEnviados } = await sb
      .from("qa_gte_alertas_enviados")
      .select("gte_documento_id, marco_dias, canal")
      .in("gte_documento_id", ids);
    const enviadoSet = new Set(
      (jaEnviados || []).map((a: any) => `${a.gte_documento_id}_${a.marco_dias}_${a.canal}`),
    );

    // 3) Clientes
    const clienteIds = [...new Set(cand.map((c) => c.gte.cliente_id))];
    const { data: clientes } = await sb
      .from("qa_clientes")
      .select("id, nome_completo, email")
      .in("id", clienteIds);
    const clienteMap = new Map<number, any>(
      (clientes || []).map((c: any) => [c.id, c]),
    );

    let emailsCliente = 0;
    let emailsEquipe = 0;
    const inserts: any[] = [];

    for (const c of cand) {
      const cliente = clienteMap.get(c.gte.cliente_id);
      if (!cliente) continue;
      const numero = c.gte.numero_gte || c.gte.id.slice(0, 8).toUpperCase();
      const validadeBR = c.gte.data_validade!.split("-").reverse().join("/");
      const nome = cliente.nome_completo || "Cliente";

      // E-mail cliente
      const keyCli = `${c.gte.id}_${c.marco}_email_cliente`;
      if (!enviadoSet.has(keyCli) && cliente.email) {
        const html = htmlAlerta({ nome, numeroGte: numero, validadeBR, dias: c.dias, marco: c.marco });
        const subject = c.dias < 0
          ? `🚨 GTE Nº ${numero} VENCIDA há ${Math.abs(c.dias)} dia(s)`
          : c.marco === 0
            ? `🚨 Sua GTE Nº ${numero} vence HOJE`
            : `⚠️ Sua GTE Nº ${numero} vence em ${c.dias} dia(s)`;
        let status = "enviado";
        let erro: string | null = null;
        try {
          const { error: sendErr } = await sb.functions.invoke("send-smtp-email", {
            body: {
              to: cliente.email,
              subject,
              html,
              trace_id: `qa-gte-alert-${c.gte.id}-${c.marco}-cliente`,
            },
          });
          if (sendErr) throw sendErr;
          emailsCliente++;
        } catch (err: any) {
          status = "erro";
          erro = String(err?.message || err);
          console.error(`[qa-gte-alertas] erro cliente ${cliente.email}:`, erro);
        }
        inserts.push({
          cliente_id: c.gte.cliente_id,
          gte_documento_id: c.gte.id,
          marco_dias: c.marco,
          canal: "email_cliente",
          destinatario: cliente.email,
          data_referencia: c.gte.data_validade,
          status,
          erro_mensagem: erro,
          detalhes: { dias_restantes: c.dias, numero_gte: numero },
        });
      }

      // E-mail equipe (apenas marcos relevantes)
      const keyEq = `${c.gte.id}_${c.marco}_email_equipe`;
      if (EQUIPE_MARCOS.has(c.marco) && !enviadoSet.has(keyEq)) {
        const subject = c.dias < 0
          ? `[QA] GTE ${numero} VENCIDA — ${nome}`
          : `[QA] GTE ${numero} vence em ${c.dias}d — ${nome}`;
        const html = `
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;">
            <h3 style="color:#7f1d1d;margin:0 0 8px;">${subject}</h3>
            <p>Cliente: <strong>${nome}</strong> (id ${c.gte.cliente_id})</p>
            <p>GTE Nº <strong>${numero}</strong></p>
            <p>Validade: <strong>${validadeBR}</strong></p>
            <p>Dias restantes: <strong>${c.dias}</strong></p>
            <p>Acesse o Arsenal do cliente no admin para verificar.</p>
          </div>
        `;
        let status = "enviado";
        let erro: string | null = null;
        try {
          const { error: sendErr } = await sb.functions.invoke("send-smtp-email", {
            body: {
              to: EMAIL_EQUIPE,
              subject,
              html,
              trace_id: `qa-gte-alert-${c.gte.id}-${c.marco}-equipe`,
            },
          });
          if (sendErr) throw sendErr;
          emailsEquipe++;
        } catch (err: any) {
          status = "erro";
          erro = String(err?.message || err);
          console.error(`[qa-gte-alertas] erro equipe:`, erro);
        }
        inserts.push({
          cliente_id: c.gte.cliente_id,
          gte_documento_id: c.gte.id,
          marco_dias: c.marco,
          canal: "email_equipe",
          destinatario: EMAIL_EQUIPE,
          data_referencia: c.gte.data_validade,
          status,
          erro_mensagem: erro,
          detalhes: { dias_restantes: c.dias, numero_gte: numero },
        });
      }
    }

    if (inserts.length > 0) {
      // upsert para tolerar reentrância parcial
      await sb.from("qa_gte_alertas_enviados").upsert(inserts, {
        onConflict: "gte_documento_id,marco_dias,canal",
        ignoreDuplicates: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts: inserts.length,
        emailsCliente,
        emailsEquipe,
        candidatesChecked: cand.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[qa-gte-alertas] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});