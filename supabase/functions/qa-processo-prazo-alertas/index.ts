import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * qa-processo-prazo-alertas
 *
 * Cron diário (default 07:00) que olha qa_processos.prazo_critico_data e dispara
 * alertas por e-mail ao cliente em marcos pré-definidos: 30, 15, 7, 3, 0 e -1
 * (vencido). Dedup por (processo_id, marco_dias, canal, prazo_data) na tabela
 * qa_processos_alertas_enviados.
 *
 * Auth: aceita token de cron (x-cron-token) OU JWT de staff QA para invocação manual.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

const MARCOS = [30, 15, 7, 3, 0, -1];

const ETAPA_LABEL: Record<number, string> = {
  1: "Comprovante de Endereço",
  2: "Antecedentes Criminais",
  3: "Declarações Assinadas",
  4: "Laudos Técnicos",
};

interface ProcessoRow {
  id: string;
  cliente_id: number;
  servico_nome: string | null;
  status: string | null;
  pagamento_status: string | null;
  prazo_critico_data: string | null;
  etapa_liberada_ate: number | null;
}

function diasAte(d: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${d}T00:00:00`);
  return Math.floor((target.getTime() - today.getTime()) / 86400000);
}

function fmtBR(d: string): string {
  return d.split("-").reverse().join("/");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { requireQAStaff, requireCronToken } = await import("../_shared/qaAuth.ts");
  const cronCheck = requireCronToken(req);
  if (!cronCheck.ok) {
    const staffCheck = await requireQAStaff(req);
    if (!staffCheck.ok) return staffCheck.response;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  try {
    // 1) Carrega processos ativos com prazo definido.
    const { data: procs, error } = await sb
      .from("qa_processos")
      .select("id, cliente_id, servico_nome, status, pagamento_status, prazo_critico_data, etapa_liberada_ate")
      .not("prazo_critico_data", "is", null)
      .not("status", "in", "(concluido,cancelado)")
      .neq("pagamento_status", "aguardando");

    if (error) throw error;

    interface Candidate {
      processo: ProcessoRow;
      marco: number;
      dias: number;
    }

    const candidates: Candidate[] = [];
    for (const p of (procs || []) as ProcessoRow[]) {
      if (!p.prazo_critico_data) continue;
      const dias = diasAte(p.prazo_critico_data);
      // Atrasado: marco -1 (qualquer atraso)
      if (dias < 0) {
        candidates.push({ processo: p, marco: -1, dias });
        continue;
      }
      // Marco mais próximo (>= dias). Ex.: dias=5 → marco 7.
      const marco = MARCOS.filter((m) => m >= 0).find((m) => dias <= m);
      if (marco !== undefined) candidates.push({ processo: p, marco, dias });
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, alerts: 0, message: "Nenhum alerta necessário" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Carrega alertas já enviados (dedup por marco + prazo_data).
    const procIds = candidates.map((c) => c.processo.id);
    const { data: jaEnviados } = await sb
      .from("qa_processos_alertas_enviados")
      .select("processo_id, marco_dias, canal, prazo_data")
      .in("processo_id", procIds);

    const enviadoSet = new Set(
      (jaEnviados || []).map(
        (a: any) => `${a.processo_id}_${a.marco_dias}_${a.canal}_${a.prazo_data}`,
      ),
    );

    // 3) Carrega dados do cliente (e-mail/nome).
    const cliIds = [...new Set(candidates.map((c) => c.processo.cliente_id))];
    const { data: clientes } = await sb
      .from("qa_clientes")
      .select("id, nome_completo, email, celular, status_cliente")
      .in("id", cliIds);
    const cliMap = new Map<number, any>((clientes || []).map((c: any) => [c.id, c]));

    let emailsSent = 0;
    let dashboardAlerts = 0;
    const inserts: any[] = [];

    for (const c of candidates) {
      const cliente = cliMap.get(c.processo.cliente_id);
      if (!cliente) continue;
      // LGPD: nunca alertar clientes excluídos.
      if ((cliente.status_cliente || "").toLowerCase().includes("excluido")) continue;

      const prazoData = c.processo.prazo_critico_data!;
      const emailKey = `${c.processo.id}_${c.marco}_email_${prazoData}`;
      const dashKey = `${c.processo.id}_${c.marco}_dashboard_${prazoData}`;

      // E-mail ao cliente
      if (!enviadoSet.has(emailKey) && cliente.email) {
        const nome = cliente.nome_completo || "Cliente";
        const servico = c.processo.servico_nome || "Processo";
        const etapa = c.processo.etapa_liberada_ate
          ? ETAPA_LABEL[Math.max(1, Math.min(4, c.processo.etapa_liberada_ate))]
          : "Documentação";
        const prazoStr = fmtBR(prazoData);

        const titulo =
          c.dias < 0
            ? `🚨 ATENÇÃO — sua documentação está VENCIDA há ${Math.abs(c.dias)} dia(s)`
            : c.dias === 0
              ? `🚨 Sua documentação vence HOJE (${prazoStr})`
              : c.dias <= 3
                ? `🚨 Faltam ${c.dias} dia(s) para sua documentação vencer`
                : `⚠️ Faltam ${c.dias} dias para entregar sua documentação`;

        const corBox = c.dias <= 3 ? "#dc2626" : c.dias <= 7 ? "#ea580c" : "#0F172A";

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f6f5f1;">
            <div style="background:${corBox};padding:20px 25px;border-radius:12px 12px 0 0;">
              <h1 style="color:#fff;font-size:18px;margin:0;letter-spacing:0.5px;">${titulo}</h1>
            </div>
            <div style="background:#fff;padding:25px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
              <p style="font-size:14px;color:#334155;">Olá, <strong>${nome}</strong>.</p>
              <p style="font-size:14px;color:#334155;">
                Identificamos no seu processo <strong>${servico}</strong> que algum
                documento começará a perder validade em <strong style="color:${corBox};">${prazoStr}</strong>.
              </p>
              <p style="font-size:14px;color:#334155;">
                Etapa atual liberada para envio: <strong>${etapa}</strong>.
              </p>
              <div style="margin-top:18px;padding:14px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;">
                <p style="margin:0;font-size:13px;color:#92400e;">
                  <strong>⚠️ Importante:</strong> se um documento vencer antes do protocolo na Polícia Federal,
                  você precisará emitir uma versão atualizada e reenviar para nossa equipe.
                </p>
              </div>
              <p style="font-size:13px;color:#334155;margin-top:20px;">
                Acesse o portal do cliente para enviar ou conferir o que está pendente:
              </p>
              <a href="https://www.euqueroarmas.com.br/area-do-cliente"
                 style="display:inline-block;margin-top:6px;padding:10px 18px;background:#0F172A;color:#fff;
                        text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;
                        text-transform:uppercase;letter-spacing:0.6px;">
                ABRIR PORTAL DO CLIENTE
              </a>
              <p style="font-size:12px;color:#94a3b8;margin-top:25px;">
                Quero Armas — Assessoria Especializada
              </p>
            </div>
          </div>
        `;

        try {
          await sb.functions.invoke("send-smtp-email", {
            body: {
              to: cliente.email,
              subject: titulo,
              html,
              trace_id: `qa-proc-prazo-${c.processo.id}-${c.marco}-${prazoData}`,
            },
          });
          emailsSent++;
          inserts.push({
            processo_id: c.processo.id,
            marco_dias: c.marco,
            canal: "email",
            prazo_data: prazoData,
            cliente_id: cliente.id,
          });
        } catch (err) {
          console.error(
            `[qa-processo-prazo-alertas] email error for ${cliente.email}:`,
            err,
          );
        }
      }

      // Dashboard interno (sempre marca para a equipe ver na matriz)
      if (!enviadoSet.has(dashKey)) {
        inserts.push({
          processo_id: c.processo.id,
          marco_dias: c.marco,
          canal: "dashboard",
          prazo_data: prazoData,
          cliente_id: cliente.id,
        });
        dashboardAlerts++;
      }
    }

    if (inserts.length > 0) {
      await sb.from("qa_processos_alertas_enviados").insert(inserts);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts: inserts.length,
        emailsSent,
        dashboardAlerts,
        candidatesChecked: candidates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[qa-processo-prazo-alertas] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});