// qa-piloto-smoke-test — Piloto Real
//
// Smoke test automatizado com venda descartável. Prova a idempotência
// de ponta-a-ponta ANTES de rodar com cliente real.
//
// Roteiro:
//   1) cria venda de teste via qa-checkout-criar-venda (cliente_id opcional)
//   2) aprova valor via RPC oficial
//   3) chama qa-venda-confirmar-pagamento-manual DUAS vezes
//   4) valida:
//        - qa_vendas.status == 'PAGO' e cobranca_status == 'confirmada'
//        - qa_venda_eventos com tipo_evento='pagamento_manual_confirmado' → 1 registro
//        - qa_contracts contando venda_id → 1
//        - qa_processos ANTES do contrato validated → 0
//   5) chama qa-piloto-arquivar para arquivar sem apagar histórico
//   6) valida evento venda_arquivada_piloto e que a venda ficou CANCELADA
//
// Auth: requireQAStaff (administrador).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

const corsHeaders = { ...qaAuthCors, "Access-Control-Allow-Methods": "POST, OPTIONS" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Step = { step: string; ok: boolean; detail?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireQAStaff(req, ["administrador"]);
  if (!guard.ok) return guard.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* body opcional */ }

  const cliente_id_legado = body?.cliente_id_legado ? Number(body.cliente_id_legado) : null;
  const servico_id: string | null = body?.servico_id || null;
  const authHeader = req.headers.get("Authorization")!;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Cliente com JWT do staff chamador — necessário para RPCs que exigem auth.uid()
  const asStaff = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const steps: Step[] = [];
  const record = (step: string, ok: boolean, detail?: unknown) => steps.push({ step, ok, detail });

  // 0) escolher cliente
  let cliente: any = null;
  if (cliente_id_legado) {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular")
      .eq("id_legado", cliente_id_legado)
      .maybeSingle();
    cliente = data;
  } else {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular")
      .neq("status", "excluido_lgpd")
      .not("cpf", "is", null)
      .not("email", "is", null)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    cliente = data;
  }
  if (!cliente) return json({ ok: false, error: "sem_cliente_para_teste", steps }, 400);
  record("cliente_escolhido", true, { id: cliente.id, nome: cliente.nome_completo });

  // 0b) escolher serviço
  let servico: any = null;
  if (servico_id) {
    const { data } = await admin.from("qa_servicos_catalogo").select("id, slug, nome, preco").eq("id", servico_id).maybeSingle();
    servico = data;
  } else {
    const { data } = await admin
      .from("qa_servicos_catalogo")
      .select("id, slug, nome, preco")
      .eq("ativo", true)
      .not("preco", "is", null)
      .order("preco", { ascending: true })
      .limit(1)
      .maybeSingle();
    servico = data;
  }
  if (!servico) return json({ ok: false, error: "sem_servico_para_teste", steps }, 400);
  record("servico_escolhido", true, { id: servico.id, slug: servico.slug });

  const url = Deno.env.get("SUPABASE_URL")!;
  const invoke = async (fn: string, payload: unknown) => {
    const r = await fetch(`${url}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { status: r.status, data };
  };

  // 1) criar venda
  const created = await invoke("qa-checkout-criar-venda", {
    cart: [{ servico_id: servico.id, slug: servico.slug, quantidade: 1 }],
    identificacao: {
      nome_completo: cliente.nome_completo,
      cpf: cliente.cpf || "",
      email: cliente.email || "",
      celular: cliente.celular || "",
    },
  });
  const venda_id = Number(created.data?.venda_id);
  if (!venda_id) return json({ ok: false, error: "criar_venda_falhou", detail: created, steps }, 500);
  record("venda_criada", true, { venda_id });

  // 2) aprovar valor via RPC oficial
  try {
    const { error } = await asStaff.rpc("qa_venda_aprovar_valor", { p_venda_id: venda_id });
    record("valor_aprovado", !error, error?.message);
  } catch (e: any) {
    record("valor_aprovado", false, e?.message);
  }

  // 3) confirmar pagamento manual DUAS vezes (idempotência)
  const payloadPag = {
    venda_id,
    forma_pagamento: "PIX",
    parcelas: 1,
    observacao: "SMOKE TEST AUTOMATIZADO — CONFIRMACAO MANUAL 1 (IDEMPOTENCIA)",
    comprovante_path: `qa/smoke-tests/${venda_id}/comprovante-fake.txt`,
  };
  const call1 = await invoke("qa-venda-confirmar-pagamento-manual", payloadPag);
  record("pagamento_manual_call_1", call1.status === 200, call1.data);
  const call2 = await invoke("qa-venda-confirmar-pagamento-manual", {
    ...payloadPag,
    observacao: "SMOKE TEST AUTOMATIZADO — CONFIRMACAO MANUAL 2 (DEVE SER IDEMPOTENTE)",
  });
  record("pagamento_manual_call_2", call2.status === 200, call2.data);

  // 4) validar
  const { data: vendaFinal } = await admin
    .from("qa_vendas").select("status, cobranca_status").eq("id", venda_id).maybeSingle();
  const { count: evPagCount } = await admin
    .from("qa_venda_eventos")
    .select("id", { count: "exact", head: true })
    .eq("venda_id", venda_id)
    .eq("tipo_evento", "pagamento_manual_confirmado");
  const { count: contratosCount } = await admin
    .from("qa_contracts")
    .select("id", { count: "exact", head: true })
    .eq("venda_id", venda_id);
  const { count: procsCount } = await admin
    .from("qa_processos")
    .select("id", { count: "exact", head: true })
    .eq("venda_id", venda_id);

  const validated = {
    venda_status: vendaFinal?.status,
    venda_cobranca: vendaFinal?.cobranca_status,
    eventos_pagamento_manual: evPagCount ?? 0,
    contratos: contratosCount ?? 0,
    processos_antes_validated: procsCount ?? 0,
  };
  const okIdempotencia =
    (vendaFinal?.status || "").toUpperCase() === "PAGO" &&
    vendaFinal?.cobranca_status === "confirmada" &&
    (evPagCount ?? 0) === 1 &&
    (contratosCount ?? 0) === 1 &&
    (procsCount ?? 0) === 0;
  record("idempotencia_validada", okIdempotencia, validated);

  // 5) arquivar
  const arq = await invoke("qa-piloto-arquivar", {
    venda_id,
    motivo: "SMOKE TEST AUTOMATIZADO — ARQUIVAMENTO SEM APAGAR HISTORICO",
  });
  record("arquivamento_chamado", arq.status === 200, arq.data);

  const { data: vendaArq } = await admin
    .from("qa_vendas").select("status").eq("id", venda_id).maybeSingle();
  const { count: evArqCount } = await admin
    .from("qa_venda_eventos")
    .select("id", { count: "exact", head: true })
    .eq("venda_id", venda_id)
    .eq("tipo_evento", "venda_arquivada_piloto");
  const okArq =
    (vendaArq?.status || "").toUpperCase() === "CANCELADO" &&
    (evArqCount ?? 0) === 1;
  record("arquivamento_validado", okArq, { venda_status_final: vendaArq?.status, eventos_arquivamento: evArqCount });

  const allOk = steps.every((s) => s.ok);
  return json({ ok: allOk, venda_teste_id: venda_id, steps }, allOk ? 200 : 500);
});