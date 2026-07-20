import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendTransactional } from "../_shared/sendTransactional.ts";

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
  dias_restantes: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: accept staff JWT OR cron token
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
    const { data: exames, error: exErr } = await sb
      .from("qa_exames_cliente_status")
      .select("id, cliente_id, tipo, data_realizacao, data_vencimento, dias_restantes");
    if (exErr) throw exErr;

    const latestMap = new Map<string, ExameRow>();
    for (const e of (exames || []) as ExameRow[]) {
      const key = `${e.cliente_id}_${e.tipo}`;
      const existing = latestMap.get(key);
      if (!existing || e.data_realizacao > existing.data_realizacao) {
        latestMap.set(key, e);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    interface AlertCandidate {
      exame: ExameRow;
      marco: number;
      diasRestantes: number;
    }

    const candidates: AlertCandidate[] = [];
    for (const e of latestMap.values()) {
      const dias = typeof e.dias_restantes === "number"
        ? e.dias_restantes
        : Math.floor((new Date(`${e.data_vencimento}T00:00:00`).getTime() - today.getTime()) / 86400000);

      for (const marco of MARCOS) {
        if (dias <= marco && dias >= 0) {
          candidates.push({ exame: e, marco, diasRestantes: dias });
          break;
        }
      }
    }

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ success: true, alerts: 0, message: "Nenhum alerta necessário" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exameIds = candidates.map((c) => c.exame.id);
    const { data: jaEnviados } = await sb
      .from("qa_exames_alertas_enviados")
      .select("exame_id, marco_dias, canal")
      .in("exame_id", exameIds);

    const enviadoSet = new Set(
      (jaEnviados || []).map((a: any) => `${a.exame_id}_${a.marco_dias}_${a.canal}`)
    );

    const { data: clientes } = await sb
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, email, celular");

    const clienteAliasMap = new Map<number, any>();
    for (const cliente of (clientes || []) as any[]) {
      if (typeof cliente.id === "number") clienteAliasMap.set(cliente.id, cliente);
      if (typeof cliente.id_legado === "number") clienteAliasMap.set(cliente.id_legado, cliente);
    }

    const salesLookupIds = [...new Set(candidates.flatMap((candidate) => {
      const cliente = clienteAliasMap.get(candidate.exame.cliente_id);
      return cliente ? [candidate.exame.cliente_id, cliente.id] : [candidate.exame.cliente_id];
    }))];

    const { data: vendas } = await sb.from("qa_vendas").select("id, cliente_id").in("cliente_id", salesLookupIds);
    const vendaIds = (vendas || []).map((v: any) => v.id);
    const vendaClienteMap = new Map((vendas || []).map((v: any) => [v.id, clienteAliasMap.get(v.cliente_id)?.id ?? v.cliente_id]));

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

    let emailsSent = 0;
    let dashboardAlerts = 0;
    const insertAlerts: any[] = [];

    const tipoLabel: Record<string, string> = {
      psicologico: "Exame Psicológico",
      tiro: "Exame de Tiro",
    };

    for (const c of candidates) {
      const cliente = clienteAliasMap.get(c.exame.cliente_id);
      if (!cliente) continue;

      const emailKey = `${c.exame.id}_${c.marco}_email`;
      if (!enviadoSet.has(emailKey) && cliente.email) {
        const nome = cliente.nome_completo || "Cliente";
        const tipo = tipoLabel[c.exame.tipo] || c.exame.tipo;
        const vencStr = c.exame.data_vencimento.split("-").reverse().join("/");
        try {
          const res = await sendTransactional({
            templateName: "exame-vencimento",
            recipientEmail: cliente.email,
            idempotencyKey: `qa-exame-alert-${c.exame.id}-${c.marco}`,
            templateData: {
              nome,
              tipoExame: tipo,
              diasRestantes: String(c.diasRestantes),
              vencimento: vencStr,
              portalUrl: "https://www.euqueroarmas.com.br/area-do-cliente",
            },
          });
          if (res.ok) emailsSent++;
          else console.error(`[qa-exames-alertas] email error for ${cliente.email}:`, res.error);
        } catch (err) {
          console.error(`[qa-exames-alertas] email error for ${cliente.email}:`, err);
        }

        insertAlerts.push({
          exame_id: c.exame.id,
          marco_dias: c.marco,
          canal: "email",
          cliente_id: cliente.id,
        });
      }

      const dashKey = `${c.exame.id}_${c.marco}_dashboard`;
      if (!enviadoSet.has(dashKey) && clienteComPendente.has(cliente.id)) {
        insertAlerts.push({
          exame_id: c.exame.id,
          marco_dias: c.marco,
          canal: "dashboard",
          cliente_id: cliente.id,
        });
        dashboardAlerts++;
      }
    }

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