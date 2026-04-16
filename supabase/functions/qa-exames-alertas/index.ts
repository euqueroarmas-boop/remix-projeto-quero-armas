import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * qa-exames-alertas
 * 
 * Cron diário que verifica exames a vencer em 45/30/15/7 dias
 * e envia alertas por e-mail ao cliente.
 * Alertas internos (dashboard) são condicionados a serviços pendentes.
 * Controle de deduplicação via tabela qa_exames_alertas_enviados.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MARCOS = [45, 30, 15, 7];
const FINISHED_STATUSES = ["DEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO", "INDEFERIDO"];

interface ExameRow {
  id: string;
  cliente_id: number;
  tipo: string;
  data_realizacao: string;
  data_vencimento: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  try {
    // 1) Buscar todos os exames
    const { data: exames, error: exErr } = await sb.from("qa_exames_cliente").select("*");
    if (exErr) throw exErr;

    // 2) Pegar o exame mais recente por (cliente, tipo)
    const latestMap = new Map<string, ExameRow>();
    for (const e of (exames || []) as ExameRow[]) {
      const key = `${e.cliente_id}_${e.tipo}`;
      const existing = latestMap.get(key);
      if (!existing || e.data_realizacao > existing.data_realizacao) {
        latestMap.set(key, e);
      }
    }

    // 3) Calcular dias restantes
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    interface AlertCandidate {
      exame: ExameRow;
      marco: number;
      diasRestantes: number;
    }

    const candidates: AlertCandidate[] = [];
    for (const e of latestMap.values()) {
      const venc = new Date(e.data_vencimento + "T00:00:00");
      const dias = Math.floor((venc.getTime() - hoje.getTime()) / 86400000);
      
      for (const marco of MARCOS) {
        if (dias <= marco && dias >= 0) {
          candidates.push({ exame: e, marco, diasRestantes: dias });
          break; // Só o marco mais próximo
        }
      }
    }

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ success: true, alerts: 0, message: "Nenhum alerta necessário" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Buscar alertas já enviados para evitar duplicidade
    const exameIds = candidates.map((c) => c.exame.id);
    const { data: jaEnviados } = await sb
      .from("qa_exames_alertas_enviados")
      .select("exame_id, marco_dias, canal")
      .in("exame_id", exameIds);

    const enviadoSet = new Set(
      (jaEnviados || []).map((a: any) => `${a.exame_id}_${a.marco_dias}_${a.canal}`)
    );

    // 5) Buscar clientes para e-mail
    const clienteIds = [...new Set(candidates.map((c) => c.exame.cliente_id))];
    const { data: clientes } = await sb
      .from("qa_clientes")
      .select("id, nome_completo, email, celular")
      .in("id", clienteIds);

    const clienteMap = new Map((clientes || []).map((c: any) => [c.id, c]));

    // 6) Verificar serviços pendentes por cliente
    const { data: vendas } = await sb.from("qa_vendas").select("id, cliente_id").in("cliente_id", clienteIds);
    const vendaIds = (vendas || []).map((v: any) => v.id);
    const vendaClienteMap = new Map((vendas || []).map((v: any) => [v.id, v.cliente_id]));

    const clienteComPendente = new Set<number>();
    if (vendaIds.length > 0) {
      const { data: itens } = await sb.from("qa_itens_venda").select("venda_id, status").in("venda_id", vendaIds);
      for (const item of (itens || []) as any[]) {
        if (!FINISHED_STATUSES.includes((item.status || "").toUpperCase())) {
          const cid = vendaClienteMap.get(item.venda_id);
          if (cid) clienteComPendente.add(cid);
        }
      }
    }

    // 7) Enviar alertas
    let emailsSent = 0;
    let dashboardAlerts = 0;
    const insertAlerts: any[] = [];

    const tipoLabel: Record<string, string> = {
      psicologico: "Exame Psicológico",
      tiro: "Exame de Tiro",
    };

    for (const c of candidates) {
      const cliente = clienteMap.get(c.exame.cliente_id);
      if (!cliente) continue;

      // E-mail ao cliente (sempre, se não duplicado)
      const emailKey = `${c.exame.id}_${c.marco}_email`;
      if (!enviadoSet.has(emailKey) && cliente.email) {
        const nome = cliente.nome_completo || "Cliente";
        const tipo = tipoLabel[c.exame.tipo] || c.exame.tipo;
        const vencStr = c.exame.data_vencimento.split("-").reverse().join("/");

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:20px 25px;border-radius:12px 12px 0 0;">
              <h1 style="color:#fff;font-size:18px;margin:0;">⚠️ Alerta de Vencimento</h1>
            </div>
            <div style="background:#fff;padding:25px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
              <p style="font-size:14px;color:#334155;">Olá, <strong>${nome}</strong>!</p>
              <p style="font-size:14px;color:#334155;">
                Seu <strong>${tipo}</strong> vence em <strong style="color:#dc2626;">${c.diasRestantes} dia(s)</strong> 
                (${vencStr}).
              </p>
              <p style="font-size:14px;color:#334155;">
                Providencie a renovação para não perder prazos em seus processos.
              </p>
              <div style="margin-top:20px;padding:15px;background:#fef3c7;border-radius:8px;border:1px solid #fde68a;">
                <p style="margin:0;font-size:13px;color:#92400e;">
                  <strong>📋 Importante:</strong> Exames vencem 365 dias após a realização. 
                  Após o vencimento, será necessário novo exame.
                </p>
              </div>
              <p style="font-size:12px;color:#94a3b8;margin-top:20px;">
                Quero Armas — Assessoria Jurídica
              </p>
            </div>
          </div>
        `;

        try {
          await sb.functions.invoke("send-smtp-email", {
            body: {
              to: cliente.email,
              subject: `⚠️ Seu ${tipo} vence em ${c.diasRestantes} dia(s)`,
              html,
              trace_id: `qa-exame-alert-${c.exame.id}-${c.marco}`,
            },
          });
          emailsSent++;
        } catch (err) {
          console.error(`[qa-exames-alertas] email error for ${cliente.email}:`, err);
        }

        insertAlerts.push({
          exame_id: c.exame.id,
          marco_dias: c.marco,
          canal: "email",
          cliente_id: c.exame.cliente_id,
        });
      }

      // Alerta dashboard (só se tem serviço pendente)
      const dashKey = `${c.exame.id}_${c.marco}_dashboard`;
      if (!enviadoSet.has(dashKey) && clienteComPendente.has(c.exame.cliente_id)) {
        insertAlerts.push({
          exame_id: c.exame.id,
          marco_dias: c.marco,
          canal: "dashboard",
          cliente_id: c.exame.cliente_id,
        });
        dashboardAlerts++;
      }
    }

    // 8) Registrar alertas enviados
    if (insertAlerts.length > 0) {
      await sb.from("qa_exames_alertas_enviados").insert(insertAlerts);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts: insertAlerts.length,
        emailsSent,
        dashboardAlerts,
        candidatesChecked: candidates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[qa-exames-alertas] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
