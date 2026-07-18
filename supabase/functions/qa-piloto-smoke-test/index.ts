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
  const target_qa_cliente_id = body?.target_qa_cliente_id ? Number(body.target_qa_cliente_id) : null;
  const target_cliente_email: string | null = body?.target_cliente_email
    ? String(body.target_cliente_email).trim().toLowerCase() : null;
  // Smoke test SEMPRE roda em modo_teste — nunca deve poluir fluxo real.
  const modo_teste: boolean = true;
  // Smoke test SEMPRE arquiva ao final — não pode ficar em "pilotos em andamento".
  const arquivar_ao_final: boolean = true;
  const skip_notificacoes: boolean = body?.skip_notificacoes === true || modo_teste;
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

  // ---------- Listas de proibidos ----------
  // Staff/admin nunca pode ser usado como "cliente final" no smoke test.
  const FORBIDDEN_EMAILS = new Set<string>([
    "eu@queroarmas.com.br",
  ]);
  const { data: staffPerfis } = await admin
    .from("qa_usuarios_perfis")
    .select("user_id")
    .eq("ativo", true);
  const forbiddenUserIds = new Set<string>(
    (staffPerfis || []).map((r: any) => String(r.user_id)).filter(Boolean),
  );
  const staffExecutor = {
    user_id: guard.userId,
    email: guard.email,
    perfil: guard.perfil,
  };

  const isStaffCliente = (c: any) => {
    if (!c) return true;
    const email = String(c.email || "").trim().toLowerCase();
    if (email && FORBIDDEN_EMAILS.has(email)) return true;
    if (c.user_id && forbiddenUserIds.has(String(c.user_id))) return true;
    return false;
  };

  // 0) escolher cliente
  let cliente: any = null;
  if (target_qa_cliente_id) {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular, status, user_id")
      .eq("id", target_qa_cliente_id)
      .maybeSingle();
    cliente = data;
  } else if (target_cliente_email) {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular, status, user_id")
      .ilike("email", target_cliente_email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    cliente = data;
  } else if (cliente_id_legado) {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular, status, user_id")
      .eq("id_legado", cliente_id_legado)
      .maybeSingle();
    cliente = data;
  } else {
    // Seleção automática: pega o cliente externo mais recente que:
    //  - não é staff (não tem perfil ativo em qa_usuarios_perfis)
    //  - não é admin institucional (eu@queroarmas.com.br)
    //  - tem CPF/email/id_legado válidos
    //  - não está excluído por LGPD
    let query = admin
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, email, celular, status, user_id")
      .neq("status", "excluido_lgpd")
      .not("cpf", "is", null)
      .not("email", "is", null)
      .not("id_legado", "is", null);
    for (const em of FORBIDDEN_EMAILS) {
      query = query.not("email", "ilike", em);
    }
    const { data: candidatos } = await query
      .order("id", { ascending: false })
      .limit(50);
    cliente = (candidatos || []).find((c: any) => !isStaffCliente(c)) || null;
  }
  if (!cliente) return json({ ok: false, error: "sem_cliente_para_teste", steps }, 400);
  if (String(cliente.status || "").toLowerCase() === "excluido_lgpd") {
    return json({ ok: false, error: "cliente_excluido_lgpd", cliente_id: cliente.id, steps }, 400);
  }
  if (isStaffCliente(cliente)) {
    return json({
      ok: false,
      error: "cliente_alvo_e_staff",
      detail: "Smoke test não pode usar staff/admin como cliente final.",
      cliente_ofensor: { id: cliente.id, email: cliente.email, user_id: cliente.user_id },
      staff_executor: staffExecutor,
      steps,
    }, 400);
  }
  record("cliente_escolhido", true, {
    id: cliente.id, id_legado: cliente.id_legado,
    nome: cliente.nome_completo, email: cliente.email,
    user_id: cliente.user_id,
  });

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
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        ...(skip_notificacoes ? { "x-skip-notificacoes": "true" } : {}),
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { status: r.status, data };
  };

  // Helper: arquiva uma venda "de emergência" quando smoke detecta contaminação.
  const arquivarEmergencia = async (vId: number, motivo: string) => {
    try {
      await invoke("qa-piloto-arquivar", { venda_id: vId, motivo });
    } catch { /* best-effort */ }
  };

  // 1) criar venda
  const created = await invoke("qa-checkout-criar-venda", {
    cart: [{ servico_id: servico.id, slug: servico.slug, quantidade: 1 }],
    target_qa_cliente_id: cliente.id,
    identificacao: {
      nome_completo: cliente.nome_completo,
      cpf: cliente.cpf || "",
      email: cliente.email || "",
      celular: cliente.celular || "",
    },
    modo_teste,
    skip_notificacoes,
  });
  const venda_id = Number(created.data?.venda_id);
  const venda_id_legado = Number(created.data?.id_legado ?? venda_id);
  if (!venda_id) return json({ ok: false, error: "criar_venda_falhou", detail: created, steps }, 500);
  record("venda_criada", true, { venda_id, venda_id_legado });

  // 1b) Guarda anti-contaminação: valida imediatamente que a venda foi criada
  //     em nome do cliente correto (nunca do staff logado).
  const { data: vendaCheck } = await admin
    .from("qa_vendas")
    .select("cliente_id")
    .eq("id", venda_id)
    .maybeSingle();
  const vendaClienteId = Number((vendaCheck as any)?.cliente_id ?? 0);
  const vendaClienteConfere = vendaClienteId === Number(cliente.id_legado);
  if (!vendaClienteConfere) {
    await arquivarEmergencia(venda_id, "SMOKE TEST — VENDA NASCEU EM NOME ERRADO, ARQUIVAMENTO AUTOMÁTICO");
    record("venda_cliente_confere", false, {
      esperado: cliente.id_legado, obtido: vendaClienteId,
    });
    return json({
      ok: false,
      error: "venda_nasceu_em_nome_errado",
      cliente_usado: { id: cliente.id, id_legado: cliente.id_legado, nome: cliente.nome_completo, email: cliente.email },
      staff_executor: staffExecutor,
      venda_id,
      venda_id_legado,
      venda_cliente_id: vendaClienteId,
      contrato_cliente_id: null,
      contrato_cliente_confere: false,
      usou_admin_como_cliente: forbiddenUserIds.has(String(cliente.user_id || "")) || FORBIDDEN_EMAILS.has(String(cliente.email || "").toLowerCase()),
      arquivado: true,
      steps,
    }, 500);
  }
  record("venda_cliente_confere", true, { cliente_id: vendaClienteId });

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
    .eq("venda_id", venda_id_legado);
  const { count: procsCount } = await admin
    .from("qa_processos")
    .select("id", { count: "exact", head: true })
    .eq("venda_id", venda_id_legado);

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

  // 4b) validar cliente do contrato
  const { data: contratoCheck } = await admin
    .from("qa_contracts")
    .select("id, cliente_id")
    .eq("venda_id", venda_id_legado)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const contratoClienteId = Number((contratoCheck as any)?.cliente_id ?? 0);
  const contratoClienteConfere = contratoClienteId === Number(cliente.id_legado);
  record("contrato_cliente_confere", contratoClienteConfere, {
    esperado: cliente.id_legado, obtido: contratoClienteId,
  });
  if (!contratoClienteConfere) {
    await arquivarEmergencia(venda_id, "SMOKE TEST — CONTRATO NASCEU EM NOME ERRADO, ARQUIVAMENTO AUTOMÁTICO");
  }

  // 5) arquivar (obrigatório em modo_teste; default = true)
  const deveArquivar = modo_teste ? true : arquivar_ao_final;
  let arquivadoA = false;
  if (deveArquivar) {
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
    arquivadoA = okArq;
    record("arquivamento_validado", okArq, { venda_status_final: vendaArq?.status, eventos_arquivamento: evArqCount });
  }

  // 6) SMOKE B — pacote fechado com composição (valor total pago != soma dos serviços)
  const precoBase = Number(servico?.preco || 100);
  const extras = [
    { tipo: "gru_taxa_gov", descricao: "GRU EXÉRCITO PF SMOKE", valor: 100, natureza: "repasse_despesa_externa", aparece_no_contrato: true },
    { tipo: "exame_laudo", descricao: "EXAMES PSICO+TOXI SMOKE", valor: 650, natureza: "repasse_despesa_externa", aparece_no_contrato: true },
    { tipo: "custo_financeiro_adquirente", descricao: "JUROS/TARIFA STONE SMOKE", valor: 300, natureza: "custo_financeiro", aparece_no_contrato: true },
  ];
  const composicao = [
    { tipo: "servico_qa", descricao: servico?.nome || "SERVIÇO", valor: precoBase, natureza: "receita_propria", aparece_no_contrato: true },
    ...extras,
  ];
  const totalEsperado = Number(composicao.reduce((s, c) => s + c.valor, 0).toFixed(2));
  const createdB = await invoke("qa-checkout-criar-venda", {
    cart: [{ servico_id: servico.id, slug: servico.slug, quantidade: 1 }],
    target_qa_cliente_id: cliente.id,
    identificacao: {
      nome_completo: cliente.nome_completo, cpf: cliente.cpf || "",
      email: cliente.email || "", celular: cliente.celular || "",
    },
    modo_teste,
    skip_notificacoes,
    exibicao_contrato: {
      modo: "pacote_fechado",
      valor_final_pacote: totalEsperado,
      ocultar_precos_individuais_no_contrato: true,
      motivo: "SMOKE PACOTE FECHADO COM COMPOSIÇÃO ESTRUTURADA",
      tipo_diferenca: "custo_financeiro_adquirente",
      total_catalogo_servicos: precoBase,
      valor_total_pago_cliente: totalEsperado,
      adquirente: "STONE",
      parcelas: 12,
      composicao_valor_final: composicao,
    },
  });
  const vendaB = Number(createdB.data?.venda_id);
  record("smoke_b_venda_criada", !!vendaB, { venda_id: vendaB, total_esperado: totalEsperado });
  if (vendaB) {
    const { data: vB } = await admin
      .from("qa_vendas")
      .select("valor_total_pago_cliente, valor_a_pagar, composicao_valor_final")
      .eq("id", vendaB).maybeSingle();
    const okComp = Math.abs(Number(vB?.valor_total_pago_cliente || 0) - totalEsperado) < 0.01
      && Array.isArray(vB?.composicao_valor_final)
      && (vB?.composicao_valor_final as any[]).length === composicao.length;
    record("smoke_b_composicao_persistida", okComp, vB);
    // arquiva a venda B (obrigatório em modo_teste)
    if (deveArquivar) {
      await invoke("qa-piloto-arquivar", {
        venda_id: vendaB,
        motivo: "SMOKE B AUTOMATIZADO — ARQUIVAR PACOTE FECHADO COM COMPOSICAO ESTRUTURADA",
      });
    }
  }

  // Contrato gerado (id_legado)
  const { data: contratoRow } = await admin
    .from("qa_contracts")
    .select("id, status")
    .eq("venda_id", venda_id_legado)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: vendaStatusFinal } = await admin
    .from("qa_vendas").select("status, cobranca_status").eq("id", venda_id).maybeSingle();

  // Contadores de notificação (auditoria da política notificacao_policy)
  let notificacoesEnviadasCount = 0;
  let notificacoesSuprimidasCount = 0;
  try {
    const { count: envCount } = await admin
      .from("qa_notificacao_eventos")
      .select("id", { count: "exact", head: true })
      .eq("venda_id", venda_id)
      .eq("enviado", true);
    const { count: supCount } = await admin
      .from("qa_notificacao_eventos")
      .select("id", { count: "exact", head: true })
      .eq("venda_id", venda_id)
      .eq("enviado", false);
    notificacoesEnviadasCount = envCount ?? 0;
    notificacoesSuprimidasCount = supCount ?? 0;
  } catch { /* tabela pode não ter esses filtros exatos; ignora */ }

  const usouAdminComoCliente =
    forbiddenUserIds.has(String(cliente.user_id || "")) ||
    FORBIDDEN_EMAILS.has(String(cliente.email || "").toLowerCase());

  const allOk = steps.every((s) => s.ok) && !usouAdminComoCliente && contratoClienteConfere;
  return json({
    ok: allOk,
    cliente_usado: {
      id: cliente.id,
      id_legado: cliente.id_legado,
      nome: cliente.nome_completo,
      email: cliente.email,
      user_id: cliente.user_id,
    },
    staff_executor: staffExecutor,
    venda_id,
    venda_id_legado,
    venda_cliente_id: vendaClienteId,
    contrato_id: contratoRow?.id ?? null,
    contrato_cliente_id: contratoClienteId || null,
    contrato_cliente_confere: contratoClienteConfere,
    usou_admin_como_cliente: usouAdminComoCliente,
    status_final: vendaStatusFinal?.status ?? null,
    cobranca_status_final: vendaStatusFinal?.cobranca_status ?? null,
    arquivado: arquivadoA,
    notificacoes_enviadas_count: notificacoesEnviadasCount,
    notificacoes_suprimidas_count: notificacoesSuprimidasCount,
    modo_teste,
    skip_notificacoes,
    venda_teste_id: venda_id,
    steps,
  }, allOk ? 200 : 500);
});