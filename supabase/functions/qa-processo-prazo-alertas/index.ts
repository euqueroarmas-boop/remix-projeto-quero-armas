import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  calcularPrazosProcessuais,
  pickMarcoExato,
  type ItemComPrazo,
  type PrazoProcessual,
} from "../_shared/prazosProcessuais.ts";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { requireQAStaff, requireCronToken } from "../_shared/qaAuth.ts";

/**
 * qa-processo-prazo-alertas (V2 — motor único)
 *
 * Cron diário 07:00 (BRT) que dispara alertas de prazo processual usando o
 * MESMO motor (`calcularPrazosProcessuais`) consumido pelo frontend, evitando
 * divergência entre semáforo do cliente e e-mail enviado.
 *
 * Fonte de dados: qa_itens_venda (onde residem data_notificacao,
 * data_indeferimento, data_recurso_administrativo, data_indeferimento_recurso,
 * numero_processo). Joina com qa_processos (status, pagamento_status,
 * servico_nome, etapa_liberada_ate) via (venda_id, servico_id) e com qa_vendas
 * para obter cliente_id.
 *
 * Marcos: 30 / 15 / 7 / 3 / 0 (exatos) e -1 (qualquer atraso).
 *
 * Dedupe: UNIQUE (processo_id, evento, marco_dias, canal, prazo_data) — se a
 * data limite mudar (ex.: novo evento), abre novo ciclo de alertas.
 *
 * Body opcional: { dry_run: boolean } — quando true, não envia e-mails nem
 * grava na tabela de dedupe; retorna previews.
 *
 * Auth: x-cron-token (cron) OU JWT de staff QA (manual).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

const PORTAL_LINK = "https://www.euqueroarmas.com.br/area-do-cliente";

function fmtBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function buildSubject(p: PrazoProcessual, marco: number): string {
  const ev = p.evento;
  if (marco === -1) return `🚨 ${ev} — prazo VENCIDO há ${Math.abs(p.diasRestantes)} dia(s)`;
  if (marco === 0) return `🚨 ${ev} — prazo vence HOJE`;
  if (ev === "MANDADO DE SEGURANÇA")
    return `⚠️ Mandado de Segurança — faltam ${p.diasRestantes} dia(s) (prazo de 120 dias)`;
  return `⚠️ ${ev} — faltam ${p.diasRestantes} dia(s) para o prazo`;
}

function buildHtml(p: PrazoProcessual, nome: string, subject: string): string {
  const cor = p.diasRestantes <= 3 ? "#7A1F2B" : p.diasRestantes <= 7 ? "#ea580c" : "#0F172A";
  const servico = p.servicoNome || "Processo";
  const numero = p.numeroProcesso ? ` (Nº ${p.numeroProcesso})` : "";
  const eventoTxt =
    p.evento === "MANDADO DE SEGURANÇA"
      ? `Após o INDEFERIMENTO do recurso administrativo (${fmtBR(p.dataEvento)}), corre o prazo decadencial de <strong>120 dias</strong> para impetração de Mandado de Segurança.`
      : `Evento: <strong>${p.evento}</strong> em ${fmtBR(p.dataEvento)} — prazo legal de 10 dias (Lei 9.784/99 art. 59).`;
  const linha =
    p.diasRestantes < 0
      ? `Prazo <strong style="color:${cor}">VENCIDO</strong> em ${fmtBR(p.dataLimite)} (${Math.abs(p.diasRestantes)} dia(s) de atraso).`
      : p.diasRestantes === 0
        ? `Prazo vence <strong style="color:${cor}">HOJE</strong> (${fmtBR(p.dataLimite)}).`
        : `Faltam <strong style="color:${cor}">${p.diasRestantes} dia(s)</strong> — prazo final em ${fmtBR(p.dataLimite)}.`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f6f5f1;">
      <div style="background:${cor};padding:20px 25px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;font-size:18px;margin:0;letter-spacing:0.5px;">${subject}</h1>
      </div>
      <div style="background:#fff;padding:25px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:14px;color:#334155;">Olá, <strong>${nome}</strong>.</p>
        <p style="font-size:14px;color:#334155;">
          Serviço: <strong>${servico}</strong>${numero}.
        </p>
        <p style="font-size:14px;color:#334155;">${eventoTxt}</p>
        <p style="font-size:14px;color:#334155;">${linha}</p>
        <a href="${PORTAL_LINK}"
           style="display:inline-block;margin-top:14px;padding:10px 18px;background:#0F172A;color:#fff;
                  text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;
                  text-transform:uppercase;letter-spacing:0.6px;">
          ABRIR PORTAL DO CLIENTE
        </a>
        <p style="font-size:12px;color:#94a3b8;margin-top:25px;">Arsenal Inteligente — Assessoria Especializada</p>
      </div>
    </div>
  `;
}

interface ProcessoRow {
  id: string;
  cliente_id: number;
  venda_id: number | null;
  servico_id: number | null;
  servico_nome: string | null;
  status: string | null;
  pagamento_status: string | null;
}

interface ItemRow {
  id: number;
  venda_id: number;
  servico_id: number;
  status: string | null;
  numero_processo: string | null;
  data_notificacao: string | null;
  data_indeferimento: string | null;
  data_recurso_administrativo: string | null;
  data_indeferimento_recurso: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: cron-token ou staff QA
  const cronCheck = requireCronToken(req);
  let modo: "cron" | "manual" = "cron";
  if (!cronCheck.ok) {
    const staffCheck = await requireQAStaff(req);
    if (!staffCheck.ok) return staffCheck.response;
    modo = "manual";
  }

  let dryRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true;
    } catch (_) {
      // sem body é ok
    }
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const startedAt = new Date().toISOString();

  try {
    // 1) Carrega processos ativos pagos (filtro de negócio).
    const { data: procsRaw, error: procsErr } = await sb
      .from("qa_processos")
      .select("id, cliente_id, venda_id, servico_id, servico_nome, status, pagamento_status")
      .neq("pagamento_status", "aguardando");
    if (procsErr) throw procsErr;
    const procs = (procsRaw || []) as ProcessoRow[];

    // 2) Para cada processo, buscar item de venda correspondente (carrega datas).
    const vendaIds = [...new Set(procs.map((p) => p.venda_id).filter((v): v is number => !!v))];
    let itens: ItemRow[] = [];
    if (vendaIds.length > 0) {
      const { data: itensRaw, error: itensErr } = await sb
        .from("qa_itens_venda")
        .select(
          "id, venda_id, servico_id, status, numero_processo, data_notificacao, data_indeferimento, data_recurso_administrativo, data_indeferimento_recurso",
        )
        .in("venda_id", vendaIds);
      if (itensErr) throw itensErr;
      itens = (itensRaw || []) as ItemRow[];
    }

    // 3) Indexar item por (venda_id, servico_id).
    const itemKey = (v: number | null, s: number | null) => `${v ?? "x"}_${s ?? "x"}`;
    const itemMap = new Map<string, ItemRow>();
    for (const it of itens) itemMap.set(itemKey(it.venda_id, it.servico_id), it);

    // 4) Construir input do motor — id é processo_id (chave para dedupe).
    const engineInput: (ItemComPrazo & { __processoId: string; __clienteId: number })[] = [];
    for (const p of procs) {
      const it = itemMap.get(itemKey(p.venda_id, p.servico_id));
      if (!it) continue;
      engineInput.push({
        id: p.id,
        servico_id: p.servico_id,
        servico_nome: p.servico_nome,
        status: p.status,
        numero_processo: it.numero_processo,
        data_notificacao: it.data_notificacao,
        data_indeferimento: it.data_indeferimento,
        data_recurso_administrativo: it.data_recurso_administrativo,
        data_indeferimento_recurso: it.data_indeferimento_recurso,
        __processoId: p.id,
        __clienteId: p.cliente_id,
      });
    }

    // 5) Motor único.
    const prazos = calcularPrazosProcessuais(engineInput);

    // 6) Mapa cliente_id por processo_id (para email/log).
    const procClienteMap = new Map<string, number>();
    for (const p of procs) procClienteMap.set(p.id, p.cliente_id);

    // 7) Selecionar candidatos a alerta (marcos exatos).
    interface Candidate {
      prazo: PrazoProcessual;
      marco: number;
      clienteId: number;
    }
    const candidates: Candidate[] = [];
    for (const p of prazos) {
      const marco = pickMarcoExato(p.diasRestantes);
      if (marco === null) continue;
      const clienteId = procClienteMap.get(String(p.itemId));
      if (clienteId == null) continue;
      candidates.push({ prazo: p, marco, clienteId });
    }

    if (candidates.length === 0) {
      const out = {
        success: true,
        modo,
        dry_run: dryRun,
        processos_analisados: procs.length,
        prazos_calculados: prazos.length,
        candidatos: 0,
        emails_enviados: 0,
        pulados_dedupe: 0,
        erros: 0,
      };
      await logSistemaBackend({
        tipo: "email",
        status: "info",
        mensagem: `qa-processo-prazo-alertas (${modo}${dryRun ? "/dry" : ""}): nenhum candidato`,
        payload: { ...out, started_at: startedAt },
      });
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8) Carregar clientes (e-mail/nome) e dedupe existente.
    const cliIds = [...new Set(candidates.map((c) => c.clienteId))];
    const procIds = [...new Set(candidates.map((c) => String(c.prazo.itemId)))];

    const [{ data: clientes }, { data: jaEnviados }] = await Promise.all([
      sb
        .from("qa_clientes")
        .select("id, nome_completo, email, status_cliente")
        .in("id", cliIds),
      sb
        .from("qa_processos_alertas_enviados")
        .select("processo_id, evento, marco_dias, canal, prazo_data")
        .in("processo_id", procIds),
    ]);

    const cliMap = new Map<number, { nome_completo: string | null; email: string | null; status_cliente: string | null }>(
      (clientes || []).map((c: any) => [c.id, c]),
    );
    const dedupeKey = (pid: string, ev: string, m: number, canal: string, pd: string) =>
      `${pid}|${ev}|${m}|${canal}|${pd}`;
    const enviadoSet = new Set(
      (jaEnviados || []).map((a: any) =>
        dedupeKey(a.processo_id, a.evento, a.marco_dias, a.canal, a.prazo_data),
      ),
    );

    let emailsSent = 0;
    let dashboardAlerts = 0;
    let skipped = 0;
    let errors = 0;
    const previews: any[] = [];
    const inserts: any[] = [];

    for (const c of candidates) {
      const cliente = cliMap.get(c.clienteId);
      if (!cliente) {
        skipped++;
        continue;
      }
      if ((cliente.status_cliente || "").toLowerCase().includes("excluido")) {
        // LGPD: nunca alertar clientes excluídos.
        skipped++;
        continue;
      }

      const pid = String(c.prazo.itemId);
      const subject = buildSubject(c.prazo, c.marco);
      const nome = cliente.nome_completo || "Cliente";
      const html = buildHtml(c.prazo, nome, subject);

      const emailKey = dedupeKey(pid, c.prazo.evento, c.marco, "email", c.prazo.dataLimite);
      const dashKey = dedupeKey(pid, c.prazo.evento, c.marco, "dashboard", c.prazo.dataLimite);

      // E-mail
      if (cliente.email && !enviadoSet.has(emailKey)) {
        if (dryRun) {
          previews.push({
            processo_id: pid,
            cliente_id: c.clienteId,
            email: cliente.email,
            evento: c.prazo.evento,
            marco: c.marco,
            dias_restantes: c.prazo.diasRestantes,
            data_evento: c.prazo.dataEvento,
            data_limite: c.prazo.dataLimite,
            subject,
          });
        } else {
          try {
            const { sendTransactional } = await import("../_shared/sendTransactional.ts");
            const isVencido = c.prazo.diasRestantes < 0;
            const templateName = isVencido ? "exigencia-pf-vencida" : "exigencia-pf-prazo";
            const dataLimiteBR = c.prazo.dataLimite.split("-").reverse().join("/");
            const templateData: Record<string, unknown> = isVencido
              ? {
                  nome,
                  processo: c.prazo.servicoNome || c.prazo.evento,
                  venceuEm: dataLimiteBR,
                  portalUrl: PORTAL_LINK,
                }
              : {
                  nome,
                  processo: c.prazo.servicoNome || c.prazo.evento,
                  prazo: dataLimiteBR,
                  diasRestantes: String(c.prazo.diasRestantes),
                  portalUrl: PORTAL_LINK,
                };
            const res = await sendTransactional({
              templateName,
              recipientEmail: cliente.email,
              idempotencyKey: `qa-proc-prazo-${pid}-${c.prazo.evento}-${c.marco}-${c.prazo.dataLimite}`,
              templateData,
            });
            if (!res.ok) throw new Error(res.error);
            emailsSent++;
            inserts.push({
              processo_id: pid,
              evento: c.prazo.evento,
              marco_dias: c.marco,
              canal: "email",
              prazo_data: c.prazo.dataLimite,
              cliente_id: c.clienteId,
            });
          } catch (err) {
            errors++;
            console.error(`[qa-processo-prazo-alertas] email error ${cliente.email}:`, err);
          }
        }
      } else if (enviadoSet.has(emailKey)) {
        skipped++;
      }

      // Dashboard interno
      if (!enviadoSet.has(dashKey)) {
        if (!dryRun) {
          inserts.push({
            processo_id: pid,
            evento: c.prazo.evento,
            marco_dias: c.marco,
            canal: "dashboard",
            prazo_data: c.prazo.dataLimite,
            cliente_id: c.clienteId,
          });
        }
        dashboardAlerts++;
      }
    }

    if (!dryRun && inserts.length > 0) {
      // Idempotente: onConflict no unique (processo_id, evento, marco_dias, canal, prazo_data)
      const { error: upErr } = await sb
        .from("qa_processos_alertas_enviados")
        .upsert(inserts, {
          onConflict: "processo_id,evento,marco_dias,canal,prazo_data",
          ignoreDuplicates: true,
        });
      if (upErr) {
        console.error("[qa-processo-prazo-alertas] upsert error:", upErr);
        errors++;
      }
    }

    const out = {
      success: true,
      modo,
      dry_run: dryRun,
      processos_analisados: procs.length,
      prazos_calculados: prazos.length,
      candidatos: candidates.length,
      emails_enviados: emailsSent,
      dashboard_alerts: dashboardAlerts,
      pulados_dedupe: skipped,
      erros: errors,
      ...(dryRun ? { previews } : {}),
    };

    await logSistemaBackend({
      tipo: "email",
      status: errors > 0 ? "warning" : "success",
      mensagem: `qa-processo-prazo-alertas (${modo}${dryRun ? "/dry" : ""}): ${candidates.length} candidatos / ${emailsSent} envios`,
      payload: { ...out, started_at: startedAt },
    });

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[qa-processo-prazo-alertas] error:", err);
    await logSistemaBackend({
      tipo: "erro",
      status: "error",
      mensagem: `qa-processo-prazo-alertas falhou: ${String(err)}`,
      payload: { started_at: startedAt },
    });
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});