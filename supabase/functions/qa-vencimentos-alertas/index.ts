import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * qa-vencimentos-alertas (BLOCO 5 — Etapas A+B+D)
 *
 * Rotina UNIFICADA para cobrir LACUNAS de alertas de vencimento:
 *   - CR (qa_cadastro_cr.validade_cr)
 *   - CRAF (qa_crafs.data_validade)
 *   - DOCUMENTOS com validade (qa_documentos_cliente.data_validade)
 *   - AUTORIZAÇÕES de compra (qa_documentos_cliente, tipo_documento ILIKE 'autoriza%')
 *
 * NÃO substitui ainda:
 *   - qa-gte-alertas
 *   - qa-exames-alertas
 *   - qa-processo-prazo-alertas
 *
 * MODO PADRÃO: dry_run=true (NUNCA envia e-mail real nesta etapa).
 * Só retorna preview de candidatos + assunto + corpo resumido.
 *
 * Dedupe: tabela `qa_vencimentos_alertas_enviados` com UNIQUE
 *   (fonte, ref_id, marco_dias, canal, data_referencia).
 *   Se data_referencia mudar (renovação), permite reenvio no novo ciclo.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

const MARCOS = [180, 90, 60, 30, 15, 7, 0, -1];
const PORTAL_LINK = "https://www.euqueroarmas.com.br/area-do-cliente";
const REMETENTE = "naoresponda@queroarmas.com.br";

type Fonte = "CR" | "CRAF" | "DOCUMENTO" | "AUTORIZACAO";

interface Candidato {
  fonte: Fonte;
  ref_id: string;
  cliente_id: number;
  titulo: string;
  data_validade: string;
  dias: number;
  marco: number;
}

function diasRestantes(validade: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(`${validade}T00:00:00`);
  return Math.floor((v.getTime() - hoje.getTime()) / 86400000);
}

function pickMarco(d: number): number | null {
  if (MARCOS.includes(d)) return d;
  if (d < -1) return -1; // agrupa vencidos pós dia 1
  return null;
}

function brDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function buildSubject(fonte: Fonte, titulo: string, dias: number, marco: number): string {
  if (dias < 0) return `🚨 ${fonte} ${titulo} VENCIDA há ${Math.abs(dias)} dia(s)`;
  if (marco === 0) return `🚨 ${fonte} ${titulo} vence HOJE`;
  return `⚠️ ${fonte} ${titulo} vence em ${dias} dia(s)`;
}

function buildResumo(c: Candidato, nome: string): string {
  const v = brDate(c.data_validade);
  if (c.dias < 0) {
    return `Olá ${nome}, sua ${c.fonte} (${c.titulo}) está VENCIDA desde ${v} (${Math.abs(c.dias)} dia(s) de atraso).`;
  }
  if (c.marco === 0) {
    return `Olá ${nome}, sua ${c.fonte} (${c.titulo}) vence HOJE (${v}).`;
  }
  return `Olá ${nome}, sua ${c.fonte} (${c.titulo}) vence em ${c.dias} dia(s) — ${v}.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { requireQAStaff, requireCronToken } = await import("../_shared/qaAuth.ts");
  const cronCheck = requireCronToken(req);
  if (!cronCheck.ok) {
    const staffCheck = await requireQAStaff(req);
    if (!staffCheck.ok) return staffCheck.response;
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* GET ou body vazio */ }

  // SEGURANÇA: dry_run é true por padrão. Para envio real, precisa explicit false.
  const dryRun: boolean = body?.dry_run !== false;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const candidatos: Candidato[] = [];

    // 1) CR
    {
      const { data, error } = await sb
        .from("qa_cadastro_cr")
        .select("id, cliente_id, numero_cr, validade_cr, consolidado_em")
        .is("consolidado_em", null)
        .not("validade_cr", "is", null);
      if (error) throw error;
      for (const r of data || []) {
        if (!r.cliente_id || !r.validade_cr) continue;
        const d = diasRestantes(r.validade_cr);
        const m = pickMarco(d);
        if (m === null) continue;
        candidatos.push({
          fonte: "CR",
          ref_id: `cr:${r.id}`,
          cliente_id: r.cliente_id,
          titulo: r.numero_cr || `CR #${r.id}`,
          data_validade: r.validade_cr,
          dias: d,
          marco: m,
        });
      }
    }

    // 2) CRAF
    {
      const { data, error } = await sb
        .from("qa_crafs")
        .select("id, cliente_id, nome_craf, numero_arma, numero_sigma, data_validade")
        .not("data_validade", "is", null);
      if (error) throw error;
      for (const r of data || []) {
        if (!r.cliente_id || !r.data_validade) continue;
        const d = diasRestantes(r.data_validade);
        const m = pickMarco(d);
        if (m === null) continue;
        const titulo = `${r.nome_craf || "CRAF"} ${r.numero_sigma || r.numero_arma || `#${r.id}`}`;
        candidatos.push({
          fonte: "CRAF",
          ref_id: `craf:${r.id}`,
          cliente_id: r.cliente_id,
          titulo,
          data_validade: r.data_validade,
          dias: d,
          marco: m,
        });
      }
    }

    // 3) DOCUMENTOS com validade + 4) AUTORIZAÇÕES (mesma tabela, fonte distinta)
    {
      const { data, error } = await sb
        .from("qa_documentos_cliente")
        .select("id, qa_cliente_id, tipo_documento, numero_documento, data_validade")
        .not("data_validade", "is", null);
      if (error) throw error;
      for (const r of data || []) {
        if (!r.qa_cliente_id || !r.data_validade) continue;
        const tipo = String(r.tipo_documento || "").toLowerCase();
        // Pular o que já é tratado por outras rotinas
        if (tipo.includes("gte") || tipo.includes("exame") || tipo.includes("laudo")) continue;
        const ehAutorizacao = tipo.includes("autoriza") || tipo.includes("aquisi");
        const d = diasRestantes(r.data_validade);
        const m = pickMarco(d);
        if (m === null) continue;
        candidatos.push({
          fonte: ehAutorizacao ? "AUTORIZACAO" : "DOCUMENTO",
          ref_id: `${ehAutorizacao ? "auth" : "doc"}:${r.id}`,
          cliente_id: r.qa_cliente_id,
          titulo: `${r.tipo_documento}${r.numero_documento ? ` ${r.numero_documento}` : ""}`,
          data_validade: r.data_validade,
          dias: d,
          marco: m,
        });
      }
    }

    // 5) Filtrar contra dedupe table
    const refIds = candidatos.map((c) => c.ref_id);
    const { data: jaEnviados } = refIds.length
      ? await sb
          .from("qa_vencimentos_alertas_enviados")
          .select("fonte, ref_id, marco_dias, canal, data_referencia")
          .in("ref_id", refIds)
      : { data: [] as any[] };
    const dedupeSet = new Set(
      (jaEnviados || []).map(
        (r: any) => `${r.fonte}|${r.ref_id}|${r.marco_dias}|${r.canal}|${r.data_referencia}`,
      ),
    );

    // 6) Carregar dados de clientes
    const clienteIds = [...new Set(candidatos.map((c) => c.cliente_id))];
    const { data: clientes } = clienteIds.length
      ? await sb
          .from("qa_clientes")
          .select("id, nome_completo, email")
          .in("id", clienteIds)
      : { data: [] as any[] };
    const clienteMap = new Map<number, any>(
      (clientes || []).map((c: any) => [c.id, c]),
    );

    // 7) Montar preview / executar envio
    const previews: any[] = [];
    let pulados = 0;
    let enviados = 0;
    const inserts: any[] = [];

    for (const c of candidatos) {
      const cliente = clienteMap.get(c.cliente_id);
      if (!cliente?.email) {
        pulados++;
        continue;
      }
      const canal = "email_cliente";
      const dedupeKey = `${c.fonte}|${c.ref_id}|${c.marco}|${canal}|${c.data_validade}`;
      if (dedupeSet.has(dedupeKey)) {
        pulados++;
        continue;
      }

      const nome = cliente.nome_completo || "Cliente";
      const subject = buildSubject(c.fonte, c.titulo, c.dias, c.marco);
      const resumo = buildResumo(c, nome);

      previews.push({
        destinatario: cliente.email,
        remetente: REMETENTE,
        assunto: subject,
        fonte: c.fonte,
        item: c.titulo,
        data_vencimento: c.data_validade,
        marco_dias: c.marco,
        dias_restantes: c.dias,
        mensagem: resumo,
        portal: PORTAL_LINK,
      });

      if (!dryRun) {
        // ENVIO REAL — bloqueado por hora pelo modo dry_run.
        // Mantemos o esqueleto pronto para a próxima etapa.
        try {
          const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#7f1d1d;">${subject}</h2>
            <p style="font-size:14px;color:#334155;">${resumo}</p>
            <p style="margin:20px 0;"><a href="${PORTAL_LINK}" style="background:#1e40af;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar meu Arsenal</a></p>
            <p style="font-size:12px;color:#94a3b8;">Quero Armas — ${REMETENTE}</p>
          </div>`;
          const { error: sendErr } = await sb.functions.invoke("send-smtp-email", {
            body: {
              to: cliente.email,
              subject,
              html,
              trace_id: `qa-venc-${c.fonte}-${c.ref_id}-${c.marco}`,
            },
          });
          if (sendErr) throw sendErr;
          enviados++;
          inserts.push({
            cliente_id: c.cliente_id,
            fonte: c.fonte,
            ref_id: c.ref_id,
            marco_dias: c.marco,
            canal,
            destinatario: cliente.email,
            data_referencia: c.data_validade,
            status: "enviado",
            detalhes: { dias_restantes: c.dias, titulo: c.titulo },
          });
        } catch (err: any) {
          inserts.push({
            cliente_id: c.cliente_id,
            fonte: c.fonte,
            ref_id: c.ref_id,
            marco_dias: c.marco,
            canal,
            destinatario: cliente.email,
            data_referencia: c.data_validade,
            status: "erro",
            erro_mensagem: String(err?.message || err),
          });
        }
      }
    }

    if (!dryRun && inserts.length) {
      await sb.from("qa_vencimentos_alertas_enviados").upsert(inserts, {
        onConflict: "fonte,ref_id,marco_dias,canal,data_referencia",
        ignoreDuplicates: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        candidatos_total: candidatos.length,
        previews_count: previews.length,
        pulados_dedupe_ou_sem_email: pulados,
        enviados_reais: enviados,
        previews,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[qa-vencimentos-alertas] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});