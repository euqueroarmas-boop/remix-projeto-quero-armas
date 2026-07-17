// qa-venda-confirmar-pagamento-manual
// Piloto Real — confirmação manual de pagamento off-checkout pela Equipe Quero Armas.
//
// Reusa o pipeline canônico executarPipelinePosPagamento (protocolo + contrato + notificações).
// NÃO cria processo/checklist aqui: isso continua sendo responsabilidade do trigger
// qa_contracts_after_validated_release -> qa-liberar-servicos-contrato após o cliente assinar.
//
// Auth: requireQAStaff (JWT staff ativo). Nunca exposto ao cliente.
// Trilha: qa_pagamento_auditoria + qa_venda_eventos (tipo pagamento_manual_confirmado)
// com comprovante_path e observacao obrigatórios.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";
import { executarPipelinePosPagamento } from "../_shared/qaPosPagamento.ts";

const corsHeaders = { ...qaAuthCors, "Access-Control-Allow-Methods": "POST, OPTIONS" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const FORMAS = new Set([
  "PIX",
  "BOLETO",
  "CARTÃO DE CRÉDITO",
  "CARTÃO DE DÉBITO",
  "DINHEIRO",
  "TRANSFERÊNCIA",
  "OUTRO",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;
  const ator = guard.email || guard.userId;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const venda_id = Number(body?.venda_id);
  const forma_pagamento = String(body?.forma_pagamento || "").toUpperCase().trim();
  const observacao = String(body?.observacao || "").trim();
  const comprovante_path = body?.comprovante_path ? String(body.comprovante_path) : null;
  const parcelas = Number(body?.parcelas) > 0 ? Math.min(24, Number(body.parcelas)) : 1;

  if (!Number.isFinite(venda_id) || venda_id <= 0) return json({ error: "venda_id_required" }, 400);
  if (!FORMAS.has(forma_pagamento)) return json({ error: "forma_pagamento_invalida", allowed: [...FORMAS] }, 400);
  if (observacao.length < 20) return json({ error: "observacao_minima_20_chars" }, 400);
  if (!comprovante_path) return json({ error: "comprovante_obrigatorio" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Busca venda
  const { data: venda, error: errVenda } = await admin
    .from("qa_vendas")
    .select("id, id_legado, status, cobranca_status, cliente_id, forma_pagamento, valor_a_pagar")
    .eq("id", venda_id)
    .maybeSingle();
  if (errVenda || !venda) return json({ error: "venda_nao_encontrada" }, 404);

  const jaPago = String((venda as any).status || "").toUpperCase() === "PAGO"
    && (venda as any).cobranca_status === "confirmada";

  const nowIso = new Date().toISOString();

  // Guarda extra de idempotência: se já existe evento pagamento_manual_confirmado
  // para esta venda, NÃO gravamos update/auditoria/evento de novo — apenas
  // reexecutamos o pipeline canônico (que já é idempotente).
  let eventoJaExiste = false;
  try {
    const { data: evExist } = await admin
      .from("qa_venda_eventos")
      .select("id")
      .eq("venda_id", Number((venda as any).id))
      .eq("tipo_evento", "pagamento_manual_confirmado")
      .limit(1)
      .maybeSingle();
    eventoJaExiste = !!evExist;
  } catch { /* best effort */ }

  if (!jaPago && !eventoJaExiste) {
    const updatePayload: Record<string, unknown> = {
      status: "PAGO",
      cobranca_status: "confirmada",
      cobranca_confirmada_em: nowIso,
      cobranca_origem: "manual_admin",
      forma_pagamento,
      parcelas_cobranca: parcelas,
      valor_cobrado: (venda as any).valor_a_pagar,
    };
    const { error: upErr } = await admin.from("qa_vendas").update(updatePayload).eq("id", venda_id);
    if (upErr) return json({ error: "update_venda_failed", detail: upErr.message }, 500);

    // Auditoria fiscal-payments
    try {
      await admin.from("qa_pagamento_auditoria").insert({
        venda_id: Number((venda as any).id),
        cliente_id: (venda as any).cliente_id ?? null,
        campo: "pagamento_manual_confirmado",
        valor_anterior: (venda as any).forma_pagamento ?? null,
        valor_novo: forma_pagamento,
        origem: "manual_admin",
        ator: `staff:${ator}`,
        contexto: {
          observacao,
          comprovante_path,
          parcelas,
          confirmado_em: nowIso,
          fluxo: "piloto_real",
        },
      });
    } catch { /* best effort */ }

    // Evento imutável na venda
    try {
      await admin.from("qa_venda_eventos").insert({
        venda_id: Number((venda as any).id),
        cliente_id: (venda as any).cliente_id ?? null,
        tipo_evento: "pagamento_manual_confirmado",
        descricao: `Pagamento manual confirmado pela Equipe (${forma_pagamento}).`,
        ator: `staff:${ator}`,
        user_id: guard.userId,
        dados_json: {
          forma_pagamento,
          parcelas,
          observacao,
          comprovante_path,
          fluxo: "piloto_real",
        },
      });
    } catch { /* best effort */ }
  }

  // Pipeline canônico (protocolo + qa-generate-contract + notificações). Idempotente.
  // IMPORTANTE: qa-generate-contract consulta a venda por `id_legado`, portanto
  // o pipeline recebe o id_legado (não o id interno) para bater com o restante
  // do fluxo (webhook Asaas e cobrança inline usam o mesmo identificador).
  try {
    await executarPipelinePosPagamento(
      admin as any,
      Number((venda as any).id_legado),
      "manual_admin",
    );
  } catch (e) {
    console.warn("[piloto-real] pipeline pos-pagamento falhou:", (e as any)?.message || e);
  }

  // Devolve o contrato atual (se já existir)
  const { data: contrato } = await admin
    .from("qa_contracts")
    .select("id, status, cliente_id, venda_id")
    .eq("venda_id", Number((venda as any).id_legado))
    .maybeSingle();

  return json({
    ok: true,
    venda_id: Number((venda as any).id),
    ja_estava_pago: jaPago,
    evento_ja_existia: eventoJaExiste,
    contrato: contrato ?? null,
  });
});