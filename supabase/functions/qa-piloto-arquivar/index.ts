// qa-piloto-arquivar — Piloto Real
//
// Arquiva/cancela um piloto real SEM APAGAR dados:
//   - venda: status = CANCELADO (constraint chk_qa_vendas_status)
//   - itens da venda: status = CANCELADO
//   - contrato: arquivado_em/arquivado_motivo (colunas oficiais)
//   - processo(s) já criados: status = cancelado + evento processo_arquivado_piloto
// Sempre grava eventos com motivo obrigatório e ator staff.
//
// Auth: requireQAStaff. Idempotente por (venda_id, evento venda_arquivada_piloto).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

const corsHeaders = { ...qaAuthCors, "Access-Control-Allow-Methods": "POST, OPTIONS" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;
  const ator = `staff:${guard.email || guard.userId}`;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const venda_id = Number(body?.venda_id);
  const motivo = String(body?.motivo || "").trim();
  if (!Number.isFinite(venda_id) || venda_id <= 0) return json({ error: "venda_id_required" }, 400);
  if (motivo.length < 20) return json({ error: "motivo_minimo_20_chars" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: venda, error: errVenda } = await admin
    .from("qa_vendas")
    .select("id, id_legado, status, cliente_id")
    .eq("id", venda_id)
    .maybeSingle();
  if (errVenda || !venda) return json({ error: "venda_nao_encontrada" }, 404);

  // Idempotência
  let jaArquivada = false;
  try {
    const { data: ev } = await admin
      .from("qa_venda_eventos")
      .select("id")
      .eq("venda_id", venda_id)
      .eq("tipo_evento", "venda_arquivada_piloto")
      .limit(1)
      .maybeSingle();
    jaArquivada = !!ev;
  } catch { /* ignore */ }

  // Idempotência adicional: evento em qa_piloto_eventos (pré-venda ou paralelo).
  if (!jaArquivada) {
    try {
      const { data: evP } = await admin
        .from("qa_piloto_eventos")
        .select("id")
        .eq("venda_id", venda_id)
        .eq("tipo_evento", "piloto_arquivado")
        .limit(1)
        .maybeSingle();
      jaArquivada = !!evP;
    } catch { /* ignore */ }
  }

  // Idempotência por status: se venda já está CANCELADO, considera arquivada.
  if (!jaArquivada && String((venda as any).status || "").toUpperCase() === "CANCELADO") {
    jaArquivada = true;
  }

  if (jaArquivada) {
    return json({ ok: true, ja_arquivada: true, venda_id });
  }

  const nowIso = new Date().toISOString();
  const resumo: Record<string, unknown> = {
    venda_cancelada: false,
    itens_cancelados: 0,
    contrato_arquivado: false,
    processos_cancelados: 0,
  };

  // 1) Venda + itens → CANCELADO (não apagamos)
  try {
    const { error: e1 } = await admin
      .from("qa_vendas")
      .update({ status: "CANCELADO" })
      .eq("id", venda_id);
    if (!e1) resumo.venda_cancelada = true;
  } catch { /* ignore */ }

  try {
    const { data: itens } = await admin
      .from("qa_itens_venda")
      .update({ status: "CANCELADO" })
      .eq("venda_id", venda_id)
      .select("id");
    resumo.itens_cancelados = itens?.length ?? 0;
  } catch { /* ignore */ }

  // 2) Contrato → arquivado_em/motivo (mantém histórico)
  try {
    const { data: contratos } = await admin
      .from("qa_contracts")
      .update({ arquivado_em: nowIso, arquivado_motivo: `piloto_real_arquivado:${motivo}` })
      .eq("venda_id", venda_id)
      .is("arquivado_em", null)
      .select("id");
    resumo.contrato_arquivado = (contratos?.length ?? 0) > 0;
    for (const c of contratos ?? []) {
      try {
        await admin.from("qa_contract_events").insert({
          contract_id: (c as any).id,
          event_type: "contrato_arquivado_piloto",
          event_payload: { motivo, staff_user_id: guard.userId, staff_email: guard.email, arquivado_em: nowIso },
        });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // 3) Processos vinculados → cancelado + evento
  try {
    const { data: procs } = await admin
      .from("qa_processos")
      .select("id, status")
      .eq("venda_id", venda_id);
    for (const p of procs ?? []) {
      const pid = (p as any).id;
      try {
        await admin.from("qa_processos").update({ status: "cancelado" }).eq("id", pid);
        await admin.from("qa_processo_eventos").insert({
          processo_id: pid,
          tipo_evento: "processo_arquivado_piloto",
          descricao: `Processo arquivado via piloto real. Motivo: ${motivo}`,
          ator,
          user_id: guard.userId,
          dados_json: { motivo, origem: "piloto_real", staff_email: guard.email },
        });
        resumo.processos_cancelados = (resumo.processos_cancelados as number) + 1;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // 4) Evento de arquivamento na venda (fonte de idempotência)
  try {
    await admin.from("qa_venda_eventos").insert({
      venda_id,
      cliente_id: (venda as any).cliente_id ?? null,
      tipo_evento: "venda_arquivada_piloto",
      descricao: `Piloto real arquivado pela equipe. Motivo: ${motivo}`,
      ator,
      user_id: guard.userId,
      dados_json: { motivo, resumo, arquivado_em: nowIso, origem: "piloto_real" },
    });
  } catch { /* ignore */ }

  try {
    await admin.from("qa_pagamento_auditoria").insert({
      venda_id,
      cliente_id: (venda as any).cliente_id ?? null,
      campo: "venda_arquivada_piloto",
      valor_anterior: String((venda as any).status ?? ""),
      valor_novo: "CANCELADO",
      origem: "manual_admin",
      ator,
      contexto: { motivo, fluxo: "piloto_real", resumo },
    });
  } catch { /* ignore */ }

  return json({ ok: true, venda_id, arquivado_em: nowIso, motivo, resumo });
});