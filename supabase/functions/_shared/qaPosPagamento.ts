// _shared/qaPosPagamento.ts
//
// Pipeline pós-pagamento canônico do Quero Armas.
// Deve ser chamado em TODO ponto onde uma qa_vendas passa a status='PAGO'
// (webhook Asaas ou cobrança direta via qa-cliente-cobranca-inline).
//
// Sequência obrigatória:
//  1. qa_gerar_protocolo(venda_id)  → protocolo QA{SIGLA}{ANO}{SEQ} (idempotente)
//  2. qa-generate-contract          → qa_contracts status 'generated_pending_company_signature' (idempotente)
//  3. notificações: 'pagamento_confirmado' e 'contrato_gerado'
//
// NÃO cria processo aqui. qa_processos só é criado pela trigger
// qa_contracts_after_validated_release após qa_contracts.status='validated'
// (assinatura do cliente + aprovação da QA), via qa-liberar-servicos-contrato.
//
// Best-effort: qualquer falha é logada mas NÃO derruba o chamador — o
// pagamento já foi confirmado; o pipeline pode ser reexecutado (idempotente).

import { logSistemaBackend } from "./logSistema.ts";

type Supa = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  functions: { invoke: (name: string, opts: { body?: unknown; headers?: Record<string, string> }) => Promise<{ data: unknown; error: { message: string } | null }> };
  from: (table: string) => any;
};

export async function executarPipelinePosPagamento(
  supabase: Supa,
  venda_id: number,
  origem: string,
  notificacao_policy?: unknown,
): Promise<void> {
  // 1) Protocolo oficial (idempotente)
  try {
    const { data: proto, error: pErr } = await supabase.rpc("qa_gerar_protocolo", { p_venda_id: venda_id });
    if (pErr) {
      await logSistemaBackend({
        tipo: "protocolo", status: "error",
        mensagem: `[posPagamento:${origem}] falha gerar_protocolo venda ${venda_id}`,
        payload: { venda_id, error: pErr.message },
      });
    } else {
      await logSistemaBackend({
        tipo: "protocolo", status: "success",
        mensagem: `[posPagamento:${origem}] protocolo ${proto} para venda ${venda_id}`,
        payload: { venda_id, numero_protocolo: proto },
      });
    }
  } catch (e) {
    await logSistemaBackend({
      tipo: "protocolo", status: "error",
      mensagem: `[posPagamento:${origem}] exceção gerar_protocolo venda ${venda_id}`,
      payload: { venda_id, error: String((e as any)?.message || e) },
    });
  }

  // 2) Contrato (idempotente — qa-generate-contract retorna { idempotent: true } se já existir versão atual)
  let contractId: string | null = null;
  try {
    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";
    const { data: genData, error: genErr } = await supabase.functions.invoke("qa-generate-contract", {
      headers: { "x-internal-token": internalToken },
      body: { venda_id, notificacao_policy },
    });
    if (genErr) {
      await logSistemaBackend({
        tipo: "contrato", status: "error",
        mensagem: `[posPagamento:${origem}] qa-generate-contract falhou venda ${venda_id}`,
        payload: { venda_id, error: genErr.message },
      });
    } else {
      const g = genData as any;
      contractId = g?.contract?.id ?? g?.contract_id ?? null;
      await logSistemaBackend({
        tipo: "contrato", status: "success",
        mensagem: `[posPagamento:${origem}] contrato gerado/reutilizado venda ${venda_id}`,
        payload: { venda_id, contract_id: contractId, idempotent: !!g?.idempotent },
      });
    }
  } catch (e) {
    await logSistemaBackend({
      tipo: "contrato", status: "error",
      mensagem: `[posPagamento:${origem}] exceção qa-generate-contract venda ${venda_id}`,
      payload: { venda_id, error: String((e as any)?.message || e) },
    });
  }

  // 3) Notificações (email + WhatsApp) — best-effort; não bloqueia
  //    A função qa-processo-notificar hoje exige processo_id. Como o
  //    processo só nasce após validação do contrato, buscamos processos
  //    existentes desta venda (fluxo legado) e disparamos por eles.
  //    No novo fluxo (sem processo ainda), a notificação 'contrato_gerado'
  //    é enviada pelo próprio qa-generate-contract via send-transactional-email.
  // Se a política pediu para NÃO notificar, não dispara o loop de
  // qa-processo-notificar (o registro fica no qa_notificacao_eventos
  // via aplicarPolicyNotificacao do chamador).
  const nc = (notificacao_policy as any)?.notificar_cliente;
  if (nc === false) return;
  try {
    const { data: procs } = await supabase
      .from("qa_processos")
      .select("id")
      .eq("venda_id", venda_id);
    const lista = (procs as any[]) || [];
    for (const p of lista) {
      await supabase.functions.invoke("qa-processo-notificar", {
        body: { processo_id: p.id, evento: "pagamento_confirmado" },
      }).catch(() => {});
    }
  } catch (e) {
    console.warn(`[posPagamento:${origem}] notificação best-effort falhou:`, e);
  }
}
