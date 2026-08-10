import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * qa-inatividade-cobranca
 *
 * Regra canônica (decidida pelo cliente, 2026-08):
 *   - Cliente sem enviar NENHUM documento por 15 dias → 1ª cobrança.
 *   - Depois disso, cobrança SEMANAL (a cada 7 dias) enquanto ficar parado.
 *   - Qualquer envio de documento zera o contador e para as cobranças.
 *
 * Canais: e-mail (template `processo-parado-cobranca`) + notificação
 * persistente na central do portal (`qa_notificacoes_cliente`).
 *
 * Dedupe: `qa_inatividade_cobrancas` UNIQUE (processo_id, semana_num, canal).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

const PORTAL_LINK = "https://www.euqueroarmas.com.br/area-do-cliente";
const DEFAULT_PRIMEIRA = 15;
const DEFAULT_INTERVALO = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { requireQAStaff, requireCronToken } = await import("../_shared/qaAuth.ts");
  const cronCheck = requireCronToken(req);
  if (!cronCheck.ok) {
    const staffCheck = await requireQAStaff(req);
    if (!staffCheck.ok) return staffCheck.response;
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* GET */ }
  const dryRun: boolean = body?.dry_run === true;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Regras globais (configuráveis em qa_config)
    let primeira = DEFAULT_PRIMEIRA;
    let intervalo = DEFAULT_INTERVALO;
    const { data: cfg } = await sb
      .from("qa_config")
      .select("chave, valor")
      .in("chave", ["inatividade_primeira_cobranca_dias", "inatividade_intervalo_dias"]);
    for (const c of (cfg || []) as any[]) {
      const n = parseInt(String(c.valor), 10);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (c.chave === "inatividade_primeira_cobranca_dias") primeira = n;
      if (c.chave === "inatividade_intervalo_dias") intervalo = n;
    }

    const { data: linhas, error } = await sb.rpc("qa_painel_progresso_clientes");
    if (error) throw error;

    const candidatos = ((linhas || []) as any[]).filter((r) =>
      !r.bloqueado_por_prerequisito &&
      Number(r.dias_parado) >= primeira &&
      Number(r.documentos_pendentes) + Number(r.perguntas_pendentes) > 0
    );

    const previews: any[] = [];
    const notifRows: any[] = [];
    let enviados = 0;
    let pulados = 0;

    for (const r of candidatos) {
      const dias = Number(r.dias_parado);
      const semana = Math.floor((dias - primeira) / intervalo) + 1; // 1 = 15 dias

      // Dedupe pela semana já cobrada
      const { data: jaEnviada } = await sb
        .from("qa_inatividade_cobrancas")
        .select("id")
        .eq("processo_id", r.processo_id)
        .eq("semana_num", semana)
        .eq("canal", "email_cliente")
        .maybeSingle();

      const preview = {
        cliente_id: r.cliente_id,
        cliente: r.cliente_nome,
        destinatario: r.cliente_email,
        servico: r.servico_nome,
        progresso: `${r.entregues}/${r.total_docs}`,
        proximo_doc: r.proximo_doc,
        dias_parado: dias,
        semana_num: semana,
        ja_enviada: Boolean(jaEnviada),
      };
      previews.push(preview);

      // Notificação in-app sempre reflete o estado atual (upsert idempotente)
      notifRows.push({
        cliente_id: r.cliente_id,
        categoria: "inatividade_processo",
        urgencia: dias >= primeira + intervalo * 2 ? "urgente" : "atencao",
        titulo: `Seu processo está parado há ${dias} dias`,
        mensagem: `Faltam ${Number(r.documentos_pendentes)} documento(s) e ${Number(r.perguntas_pendentes)} pergunta(s) para seguir com ${r.servico_nome || "seu processo"}. Próximo: ${r.proximo_doc || "item pendente"}.`,
        link: "/area-do-cliente",
        referencia_tabela: "qa_processos",
        referencia_id: r.processo_id,
        ativa: true,
      });

      if (jaEnviada || !r.cliente_email) { pulados++; continue; }
      if (dryRun) continue;

      try {
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        const res = await sendTransactional({
          templateName: "processo-parado-cobranca",
          recipientEmail: r.cliente_email,
          idempotencyKey: `qa-inativ-${r.processo_id}-s${semana}`,
          templateData: {
            nome: r.cliente_nome || "Cliente",
            servico: r.servico_nome || "Seu processo",
            entregues: String(r.entregues),
            total: String(r.total_docs),
            proximoDoc: r.proximo_doc || "Documento pendente",
            diasParado: String(dias),
            portalUrl: PORTAL_LINK,
          },
        });
        if (!res.ok) throw new Error(res.error);
        enviados++;
        await sb.from("qa_inatividade_cobrancas").insert({
          processo_id: r.processo_id,
          cliente_id: r.cliente_id,
          semana_num: semana,
          dias_parado: dias,
          canal: "email_cliente",
          destinatario: r.cliente_email,
          status: "enviado",
          detalhes: { servico: r.servico_nome, progresso: `${r.entregues}/${r.total_docs}`, proximo_doc: r.proximo_doc },
        });
      } catch (err: any) {
        await sb.from("qa_inatividade_cobrancas").insert({
          processo_id: r.processo_id,
          cliente_id: r.cliente_id,
          semana_num: semana,
          dias_parado: dias,
          canal: "email_cliente",
          destinatario: r.cliente_email,
          status: "erro",
          erro_mensagem: String(err?.message || err),
        });
      }
    }

    // Central de notificações: cria/atualiza os ativos e resolve quem voltou a andar.
    if (notifRows.length > 0) {
      await sb.from("qa_notificacoes_cliente").upsert(notifRows, {
        onConflict: "cliente_id,categoria,referencia_tabela,referencia_id",
      });
    }
    const ativosAgora = new Set(notifRows.map((n) => `${n.cliente_id}_${n.referencia_id}`));
    const { data: ativas } = await sb
      .from("qa_notificacoes_cliente")
      .select("id, cliente_id, referencia_id")
      .eq("categoria", "inatividade_processo")
      .eq("ativa", true);
    const resolver = ((ativas || []) as any[])
      .filter((n) => !ativosAgora.has(`${n.cliente_id}_${n.referencia_id}`))
      .map((n) => n.id);
    if (resolver.length > 0) {
      await sb.from("qa_notificacoes_cliente")
        .update({ ativa: false, resolvida_em: new Date().toISOString() })
        .in("id", resolver);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        regra: { primeira_cobranca_dias: primeira, intervalo_dias: intervalo },
        candidatos: candidatos.length,
        enviados,
        pulados_dedupe_ou_sem_email: pulados,
        notificacoes_ativas: notifRows.length,
        notificacoes_resolvidas: resolver.length,
        previews,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[qa-inatividade-cobranca] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
