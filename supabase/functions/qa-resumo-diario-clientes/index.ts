import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * qa-resumo-diario-clientes
 *
 * Cron diário (07h BRT / 10h UTC) que envia 1 e-mail CONSOLIDADO para o
 * destinatário interno (eu@queroarmas.com.br) contendo o status de TODOS
 * os clientes / processos ativos do Quero Armas.
 *
 * Inclui:
 *  - Total de clientes / processos por status
 *  - Lista de processos ativos (não finalizados) com cliente, serviço,
 *    status atual, dias desde último update
 *  - Alertas de exames a vencer em 45/30/15/7 dias
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINISHED_STATUSES = ["DEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO", "INDEFERIDO", "CANCELADO"];

const DESTINATARIOS_PADRAO = ["eu@queroarmas.com.br"];

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const s = d.split("T")[0];
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function diasDesde(d: string | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(`${d.split("T")[0]}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - t) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const destinatarios: string[] = Array.isArray(body?.to) && body.to.length > 0 ? body.to : DESTINATARIOS_PADRAO;

    // 1) Carregar clientes (não excluídos)
    const { data: clientesRaw, error: clientesErr } = await sb
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular, excluido")
      .or("excluido.is.null,excluido.eq.false");
    if (clientesErr) throw clientesErr;
    const clientes = clientesRaw || [];

    const clienteById = new Map<number, any>();
    for (const c of clientes) {
      if (typeof c.id === "number") clienteById.set(c.id, c);
      if (typeof c.id_legado === "number" && !clienteById.has(c.id_legado)) clienteById.set(c.id_legado, c);
    }

    // 2) Vendas + itens
    const { data: vendas } = await sb.from("qa_vendas").select("id, cliente_id, data_cadastro");
    const vendaToCliente = new Map<number, number>();
    for (const v of (vendas || []) as any[]) vendaToCliente.set(v.id, v.cliente_id);

    const { data: itens } = await sb
      .from("qa_itens_venda")
      .select("id, venda_id, servico_id, status, data_protocolo, data_ultima_atualizacao, data_deferimento, numero_processo");

    const { data: servicos } = await sb.from("qa_servicos").select("id, nome_servico");
    const servicoNome = new Map<number, string>();
    for (const s of (servicos || []) as any[]) servicoNome.set(s.id, s.nome_servico);

    // 3) Construir linhas por item
    type Row = {
      cliente: any;
      servico: string;
      status: string;
      protocolo: string | null;
      ultAtt: string | null;
      diasParado: number | null;
      numProc: string | null;
    };
    const ativos: Row[] = [];
    const concluidos: Row[] = [];
    const statusCount: Record<string, number> = {};

    for (const it of (itens || []) as any[]) {
      const cliId = vendaToCliente.get(it.venda_id);
      if (!cliId) continue;
      const cliente = clienteById.get(cliId);
      if (!cliente) continue;

      const status = (it.status || "—").toString();
      statusCount[status] = (statusCount[status] || 0) + 1;

      const ultAtt = it.data_ultima_atualizacao || it.data_protocolo;
      const row: Row = {
        cliente,
        servico: servicoNome.get(it.servico_id) || `Serviço #${it.servico_id}`,
        status,
        protocolo: it.data_protocolo,
        ultAtt,
        diasParado: diasDesde(ultAtt),
        numProc: it.numero_processo,
      };

      if (FINISHED_STATUSES.includes(status.toUpperCase())) concluidos.push(row);
      else ativos.push(row);
    }

    // Ordenar ativos por dias parado desc
    ativos.sort((a, b) => (b.diasParado ?? -1) - (a.diasParado ?? -1));

    // 4) Exames a vencer
    const { data: exames } = await sb
      .from("qa_exames_cliente_status")
      .select("cliente_id, tipo, data_vencimento, dias_restantes, data_realizacao");
    const examesAlerta: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const e of (exames || []) as any[]) {
      const dias = typeof e.dias_restantes === "number"
        ? e.dias_restantes
        : Math.floor((new Date(`${e.data_vencimento}T00:00:00`).getTime() - today.getTime()) / 86400000);
      if (dias <= 45 && dias >= -7) {
        const cli = clienteById.get(e.cliente_id);
        if (cli) examesAlerta.push({ cliente: cli, tipo: e.tipo, venc: e.data_vencimento, dias });
      }
    }
    examesAlerta.sort((a, b) => a.dias - b.dias);

    // 5) Montar HTML
    const totalClientes = clientes.length;
    const totalAtivos = ativos.length;
    const totalConcluidos = concluidos.length;

    const statusRows = Object.entries(statusCount)
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${s}</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${n}</td></tr>`)
      .join("");

    const ativosRows = ativos.slice(0, 200).map((r) => {
      const flag = r.diasParado != null && r.diasParado > 30 ? "color:#dc2626;font-weight:700;" : r.diasParado != null && r.diasParado > 14 ? "color:#d97706;font-weight:600;" : "color:#475569;";
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;">${r.cliente.nome_completo || "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;">${r.servico}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;">${r.status}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;">${fmtDate(r.protocolo)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;${flag}">${r.diasParado ?? "—"}</td>
      </tr>`;
    }).join("");

    const examesRows = examesAlerta.slice(0, 100).map((e) => {
      const cor = e.dias < 0 ? "#dc2626" : e.dias <= 7 ? "#dc2626" : e.dias <= 15 ? "#d97706" : "#0369a1";
      const tipo = e.tipo === "psicologico" ? "Exame Psicológico" : e.tipo === "tiro" ? "Exame de Tiro" : e.tipo;
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;">${e.cliente.nome_completo || "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;">${tipo}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;">${fmtDate(e.venc)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;color:${cor};font-weight:700;">${e.dias} dia(s)</td>
      </tr>`;
    }).join("");

    const dataHoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;background:#f8fafc;">
        <div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);padding:24px 28px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;font-size:20px;margin:0;letter-spacing:.3px;">📊 RESUMO DIÁRIO — QUERO ARMAS</h1>
          <p style="color:#cbd5e1;font-size:13px;margin:6px 0 0;">${dataHoje}</p>
        </div>
        <div style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;">

          <div style="display:flex;gap:12px;margin-bottom:20px;">
            <div style="flex:1;background:#f1f5f9;padding:14px;border-radius:10px;text-align:center;">
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Clientes</div>
              <div style="font-size:24px;font-weight:700;color:#0f172a;margin-top:4px;">${totalClientes}</div>
            </div>
            <div style="flex:1;background:#fef3c7;padding:14px;border-radius:10px;text-align:center;">
              <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.5px;">Em Andamento</div>
              <div style="font-size:24px;font-weight:700;color:#78350f;margin-top:4px;">${totalAtivos}</div>
            </div>
            <div style="flex:1;background:#dcfce7;padding:14px;border-radius:10px;text-align:center;">
              <div style="font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:.5px;">Finalizados</div>
              <div style="font-size:24px;font-weight:700;color:#14532d;margin-top:4px;">${totalConcluidos}</div>
            </div>
          </div>

          <h2 style="font-size:14px;color:#0f172a;margin:24px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">DISTRIBUIÇÃO POR STATUS</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">${statusRows || '<tr><td style="padding:8px;color:#94a3b8;">Sem dados.</td></tr>'}</table>

          <h2 style="font-size:14px;color:#0f172a;margin:28px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">PROCESSOS ATIVOS (${ativos.length})</h2>
          ${ativos.length === 0 ? '<p style="color:#94a3b8;font-size:13px;">Nenhum processo ativo.</p>' : `
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Cliente</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Serviço</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Status</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Protocolo</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Dias parado</th>
              </tr>
            </thead>
            <tbody>${ativosRows}</tbody>
          </table>
          ${ativos.length > 200 ? `<p style="color:#94a3b8;font-size:11px;margin-top:8px;">Mostrando 200 de ${ativos.length}. Acesse o painel para ver todos.</p>` : ""}
          `}

          <h2 style="font-size:14px;color:#0f172a;margin:28px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">⚠️ EXAMES A VENCER (${examesAlerta.length})</h2>
          ${examesAlerta.length === 0 ? '<p style="color:#94a3b8;font-size:13px;">Nenhum exame vencendo nos próximos 45 dias.</p>' : `
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Cliente</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Tipo</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Vencimento</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Faltam</th>
              </tr>
            </thead>
            <tbody>${examesRows}</tbody>
          </table>
          `}

          <p style="font-size:11px;color:#94a3b8;margin-top:30px;border-top:1px solid #e2e8f0;padding-top:12px;">
            Quero Armas — Resumo diário gerado automaticamente às 07h (BRT).
          </p>
        </div>
      </div>
    `;

    // 6) Enviar para cada destinatário
    const results: any[] = [];
    for (const to of destinatarios) {
      try {
        const { data, error } = await sb.functions.invoke("send-smtp-email", {
          body: {
            to,
            subject: `📊 Resumo diário Quero Armas — ${dataHoje} — ${totalAtivos} ativos / ${examesAlerta.length} alertas`,
            html,
            trace_id: `qa-resumo-${new Date().toISOString().slice(0, 10)}`,
          },
        });
        if (error) throw error;
        results.push({ to, ok: true, data });
      } catch (err) {
        console.error(`[qa-resumo-diario-clientes] erro envio ${to}:`, err);
        results.push({ to, ok: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalClientes,
        totalAtivos,
        totalConcluidos,
        examesAlerta: examesAlerta.length,
        statusCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[qa-resumo-diario-clientes] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
