// =====================================================================
// qa-liberar-servicos-contrato — FASE 2C-7 (QA puro)
// ---------------------------------------------------------------------
// Libera operacionalmente os serviços contratados após o contrato do
// cliente ser VALIDATED. Cria/ativa qa_solicitacoes_servico, qa_processos
// e checklist específico por serviço (via RPC canônica
// qa_confirmar_pagamento_processo → qa_explodir_checklist_processo).
//
// REGRAS ABSOLUTAS:
//   - Arsenal Inteligente é GRATUITO. Nunca bloqueado, nunca premium.
//   - NAO toca WMTi (customers / payments / quotes).
//   - NAO importa rotinas legadas de provisionamento.
//   - Só libera quando contract.status='validated'
//     E venda.status='PAGO' E venda.cobranca_status='confirmada'.
//   - Idempotente: replay não duplica solicitação/processo/checklist.
//   - Item sem servico_id NÃO cria processo (registra evento).
//   - Catálogo (qa_servicos_catalogo.gera_processo) decide se cria
//     qa_processos. Curso/serviço sem processo só recebe solicitação.
//
// Auth aceita APENAS:
//   - x-internal-token = QA_CONTRACT_RELEASE_TOKEN (preferencial, usado pela
//     trigger qa_contracts_after_validated_release via pg_net + vault), OU
//   - x-internal-token = INTERNAL_FUNCTION_TOKEN (fallback admin/manual), OU
//   - JWT válido de membro ativo da Equipe Quero Armas (qa_usuarios_perfis.ativo).
//
// O header `x-trigger-source` é APENAS metadado de auditoria — sozinho NUNCA
// autoriza a chamada (FASE 2C-7.2 — endurecimento de segurança).
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireQAStaff } from "../_shared/qaAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-trigger-source",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRIGGER_SOURCE = "qa_contract_validated";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Autorização endurecida (FASE 2C-7.2):
 *  - x-internal-token deve casar QA_CONTRACT_RELEASE_TOKEN OU
 *    INTERNAL_FUNCTION_TOKEN (constant-time compare); OU
 *  - JWT válido de staff QA ativo.
 * O header x-trigger-source é apenas metadado e NUNCA autoriza sozinho.
 */
async function authorize(
  req: Request,
): Promise<
  | { ok: true; via: "release_token" | "internal_token" | "qa_staff"; userId?: string }
  | { ok: false; reason: string; status: number }
> {
  const internalToken = req.headers.get("x-internal-token") || "";
  const releaseExpected = Deno.env.get("QA_CONTRACT_RELEASE_TOKEN") || "";
  if (
    internalToken && releaseExpected &&
    timingSafeEqual(internalToken, releaseExpected)
  ) {
    return { ok: true, via: "release_token" };
  }
  const fallbackExpected = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";
  if (
    internalToken && fallbackExpected &&
    timingSafeEqual(internalToken, fallbackExpected)
  ) {
    return { ok: true, via: "internal_token" };
  }

  // Permitir chamada manual SOMENTE com JWT de staff QA ativo.
  if ((req.headers.get("Authorization") || "").startsWith("Bearer ")) {
    const guard = await requireQAStaff(req);
    if (guard.ok) return { ok: true, via: "qa_staff", userId: guard.userId };
  }

  return { ok: false, reason: "unauthorized", status: 401 };
}

async function recordContractEvent(
  admin: any,
  contractId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  try {
    await admin.from("qa_contract_events").insert({
      contract_id: contractId,
      event_type: eventType,
      event_payload: payload,
    });
  } catch (e) {
    console.warn("[liberar] falha ao registrar evento", eventType, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authorize(req);
  if (!auth.ok) return json({ error: auth.reason }, auth.status);
  const triggerSourceMeta = req.headers.get("x-trigger-source") || null;

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const contractId: string | undefined = body?.contract_id;
  const origem: string = body?.origem_trigger || "manual";
  if (!contractId || typeof contractId !== "string") {
    return json({ error: "contract_id_required" }, 400);
  }
  // Apenas auditoria — não influencia decisão.
  void triggerSourceMeta; void TRIGGER_SOURCE;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1) Carrega contrato
  const { data: contract, error: cErr } = await admin
    .from("qa_contracts")
    .select("id, status, venda_id, cliente_id")
    .eq("id", contractId)
    .maybeSingle();
  if (cErr) return json({ error: "contract_lookup_failed", detail: cErr.message }, 500);
  if (!contract) return json({ error: "contract_not_found" }, 404);

  if (contract.status !== "validated") {
    await recordContractEvent(admin, contractId, "liberacao_recusada_status_invalido", {
      contract_status: contract.status, origem,
    });
    return json({ ok: false, skipped: "contract_not_validated", status: contract.status }, 200);
  }

  // 2) Carrega venda e checa pagamento
  const { data: venda, error: vErr } = await admin
    .from("qa_vendas")
    .select("id, status, cobranca_status, cliente_id")
    .or(`id_legado.eq.${contract.venda_id},id.eq.${contract.venda_id}`)
    .limit(1)
    .maybeSingle();
  if (vErr) return json({ error: "venda_lookup_failed", detail: vErr.message }, 500);
  if (!venda) {
    await recordContractEvent(admin, contractId, "liberacao_falhou", {
      motivo: "venda_inexistente",
      contract_venda_id: contract.venda_id,
    });
    return json({ ok: false, error: "venda_not_found" }, 404);
  }
  if (String(venda.status).toUpperCase() !== "PAGO" || venda.cobranca_status !== "confirmada") {
    await recordContractEvent(admin, contractId, "liberacao_recusada_pagamento_invalido", {
      venda_status: venda.status, cobranca_status: venda.cobranca_status,
    });
    return json({ ok: false, skipped: "payment_not_confirmed" }, 200);
  }

  // Resolve o cliente canônico (qa_clientes.id REAL). Contratos/vendas legados
  // podem carregar id_legado, mas processos, documentos, solicitações e o
  // ChecklistGuiado devem gravar/consultar sempre o id real usado pela RLS.
  const clienteCandidates = Array.from(
    new Set([contract.cliente_id, venda.cliente_id].filter((v) => v != null).map((v) => Number(v))),
  ).filter((v) => Number.isFinite(v));
  const clienteOr = clienteCandidates
    .flatMap((id) => [`id.eq.${id}`, `id_legado.eq.${id}`])
    .join(",");
  let clienteCanonicoId = Number(contract.cliente_id);
  if (clienteOr) {
    const { data: clienteCanonico, error: cliErr } = await admin
      .from("qa_clientes")
      .select("id, id_legado")
      .or(clienteOr)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (cliErr) return json({ error: "cliente_lookup_failed", detail: cliErr.message }, 500);
    if (clienteCanonico?.id) clienteCanonicoId = Number(clienteCanonico.id);
  }

  // 3) Idempotência: já liberado?
  const { data: prevEvents } = await admin
    .from("qa_contract_events")
    .select("id")
    .eq("contract_id", contractId)
    .eq("event_type", "contrato_validado_liberacao_concluida")
    .limit(1);
  if (prevEvents && prevEvents.length > 0) {
    await recordContractEvent(admin, contractId, "liberacao_idempotente_ignorada", { origem });
    return json({ ok: true, skipped: "already_released" }, 200);
  }

  await recordContractEvent(admin, contractId, "contrato_validado_liberacao_iniciada", { origem });

  // 4) Itens do contrato
  const { data: items, error: iErr } = await admin
    .from("qa_contract_items")
    .select("id, contract_id, venda_id, item_venda_id, service_id_snapshot, service_slug_snapshot, service_name_snapshot")
    .eq("contract_id", contractId);
  if (iErr) return json({ error: "items_lookup_failed", detail: iErr.message }, 500);
  if (!items || items.length === 0) {
    await recordContractEvent(admin, contractId, "liberacao_falhou", { motivo: "sem_itens" });
    return json({ ok: false, error: "no_items" }, 422);
  }

  const result: any = {
    contract_id: contractId,
    venda_id: venda.id,
    cliente_id: clienteCanonicoId,
    items_processados: 0,
    solicitacoes: [] as any[],
    processos: [] as any[],
    erros: [] as any[],
  };

  for (const it of items) {
    const servicoId = it.service_id_snapshot;
    const slug = it.service_slug_snapshot;
    const nome = it.service_name_snapshot;

    if (!servicoId || !slug) {
      await recordContractEvent(admin, contractId, "liberacao_falhou", {
        motivo: "item_sem_servico_id", contract_item_id: it.id,
      });
      result.erros.push({ contract_item_id: it.id, motivo: "item_sem_servico_id" });
      continue;
    }

    // Catálogo: gera processo?
    const { data: catalogo } = await admin
      .from("qa_servicos_catalogo")
      .select("slug, gera_processo, tipo")
      .eq("servico_id", servicoId)
      .maybeSingle();
    const geraProcesso = catalogo?.gera_processo !== false; // default true

    // 4a) Resolve solicitação operacional respeitando idempotência por venda/item.
    //     Lookup primário: item_venda_id (uq_qa_solicitacoes_item_venda).
    //     Fallback:        (venda_id, servico_id) c/ cadastro_publico_id IS NULL
    //                      (uq_qa_solicitacoes_venda_servico).
    //     NUNCA reaproveita por (cliente_id, service_slug) quando há venda nova:
    //     uma solicitação manual antiga (venda_id NULL) ou de OUTRA venda fica
    //     intocada — recompra cria nova solicitação.
    let solicitacaoId: string | null = null;
    {
      let existSol: { id: string; status_servico: string | null; venda_id: string | null; item_venda_id: string | null } | null = null;
      let matchOrigin: "item_venda" | "venda_servico" | null = null;

      if (it.item_venda_id) {
        const { data } = await admin
          .from("qa_solicitacoes_servico")
          .select("id, status_servico, venda_id, item_venda_id")
          .eq("item_venda_id", it.item_venda_id)
          .maybeSingle();
        if (data) { existSol = data as any; matchOrigin = "item_venda"; }
      }
      if (!existSol) {
        const { data } = await admin
          .from("qa_solicitacoes_servico")
          .select("id, status_servico, venda_id, item_venda_id")
          .eq("venda_id", venda.id)
          .eq("servico_id", servicoId)
          .is("cadastro_publico_id", null)
          .maybeSingle();
        if (data) { existSol = data as any; matchOrigin = "venda_servico"; }
      }

      if (existSol) {
        solicitacaoId = existSol.id;
        // Reuso seguro: NÃO sobrescreve venda_id/item_venda_id/servico_id/service_name
        // de uma solicitação de outra venda. Apenas avança status mínimo se ainda
        // está em estágio inicial e a solicitação pertence a esta venda.
        const mesmaVenda = existSol.venda_id === venda.id;
        if (
          mesmaVenda &&
          (existSol.status_servico === "aguardando_contratacao" ||
            existSol.status_servico === "montando_pasta")
        ) {
          await admin
            .from("qa_solicitacoes_servico")
            .update({
              status_servico: "aguardando_documentacao",
              status_financeiro: "pago",
            })
            .eq("id", existSol.id);
        }
        await recordContractEvent(
          admin,
          contractId,
          matchOrigin === "item_venda"
            ? "solicitacao_servico_reutilizada_por_item_venda"
            : "solicitacao_servico_reutilizada_por_venda_servico",
          { solicitacao_id: solicitacaoId, servico_id: servicoId, slug, contract_item_id: it.id },
        );
      } else {
        // Detecta recompra: solicitação anterior do mesmo cliente+slug em outra venda
        // (ou manual sem venda). Apenas auditoria — não bloqueia, não sobrescreve.
        const { data: anterior } = await admin
          .from("qa_solicitacoes_servico")
          .select("id, venda_id")
          .eq("cliente_id", clienteCanonicoId)
          .eq("service_slug", slug)
          .is("cadastro_publico_id", null)
          .limit(1)
          .maybeSingle();
        if (anterior) {
          await recordContractEvent(admin, contractId, "liberacao_recompra_mesmo_servico_detectada", {
            slug, servico_id: servicoId, solicitacao_anterior_id: anterior.id,
            venda_anterior_id: anterior.venda_id, venda_atual_id: venda.id,
          });
          if (!anterior.venda_id) {
            await recordContractEvent(admin, contractId, "solicitacao_manual_slug_cliente_ignorada_por_venda_diferente", {
              slug, solicitacao_anterior_id: anterior.id,
            });
          }
        }

        const { data: novaSol, error: nsErr } = await admin
          .from("qa_solicitacoes_servico")
          .insert({
            cliente_id: clienteCanonicoId,
            servico_id: servicoId,
            service_slug: slug,
            service_name: nome,
            origem: "contrato_validado",
            status_servico: "aguardando_documentacao",
            status_financeiro: "pago",
            status_processo: "processo_nao_aberto",
            venda_id: venda.id,
            item_venda_id: it.item_venda_id,
          })
          .select("id")
          .single();
        if (nsErr) {
          result.erros.push({ contract_item_id: it.id, etapa: "solicitacao", erro: nsErr.message });
          continue;
        }
        solicitacaoId = novaSol.id;
        await recordContractEvent(admin, contractId, "solicitacao_servico_criada", {
          solicitacao_id: solicitacaoId, servico_id: servicoId, slug,
          item_venda_id: it.item_venda_id, venda_id: venda.id,
        });
        if (it.item_venda_id) {
          await recordContractEvent(admin, contractId, "solicitacao_servico_criada_por_item_venda", {
            solicitacao_id: solicitacaoId, item_venda_id: it.item_venda_id,
          });
        }
      }
      result.solicitacoes.push({ id: solicitacaoId, servico_id: servicoId, slug });
    }

    // 4b) Processo (apenas se catálogo exigir)
    if (!geraProcesso) {
      await recordContractEvent(admin, contractId, "servico_liberado_por_contrato_validado", {
        servico_id: servicoId, slug, gera_processo: false,
      });
      result.items_processados++;
      continue;
    }

    // Idempotência por (venda_id, servico_id)
    const { data: existProc } = await admin
      .from("qa_processos")
      .select("id, pagamento_status, status")
      .eq("venda_id", venda.id)
      .eq("servico_id", servicoId)
      .maybeSingle();

    let processoId: string | null = existProc?.id ?? null;
    if (!processoId) {
      const { data: novoProc, error: npErr } = await admin
        .from("qa_processos")
        .insert({
          cliente_id: clienteCanonicoId,
          servico_id: servicoId,
          servico_nome: nome,
          venda_id: venda.id,
          status: "aguardando_pagamento",
          pagamento_status: "aguardando",
          solicitacao_id: solicitacaoId,
        })
        .select("id")
        .single();
      if (npErr) {
        result.erros.push({ contract_item_id: it.id, etapa: "processo", erro: npErr.message });
        continue;
      }
      processoId = novoProc.id;
      await recordContractEvent(admin, contractId, "processo_criado_por_contrato_validado", {
        processo_id: processoId, servico_id: servicoId, slug, contract_item_id: it.id,
      });
    }

    // 4c) Confirma pagamento + explode checklist (RPC canônica, idempotente)
    try {
      const { data: rpc, error: rpcErr } = await admin.rpc("qa_confirmar_pagamento_processo", {
        p_processo_id: processoId,
        p_origem: "contrato_validado",
        p_bypass_contrato_validado: true,
      });
      if (rpcErr) {
        result.erros.push({ processo_id: processoId, etapa: "checklist", erro: rpcErr.message });
      } else {
        const inseridos = Number((rpc as any)?.checklist_inseridos ?? 0);
        const jaExistentes = Number((rpc as any)?.checklist_ja_existentes ?? 0);
        if (inseridos > 0 || jaExistentes > 0) {
          await recordContractEvent(admin, contractId, "checklist_criado_por_contrato_validado", {
            processo_id: processoId, servico_id: servicoId, inseridos,
            ja_existentes: jaExistentes,
            idempotente: inseridos === 0,
          });
        }
        // Wave 3D — Pós-pagamento: gera protocolo + status de produção (best-effort)
        try {
          await admin.rpc("qa_pos_pagamento_protocolar", { p_processo_id: processoId });
        } catch (e) {
          console.warn("[liberar-servicos-contrato] qa_pos_pagamento_protocolar exception:", e);
        }
      }
    } catch (e) {
      result.erros.push({ processo_id: processoId, etapa: "checklist", erro: String(e) });
    }

    // Marca a solicitação como processo aberto. O campo legado
    // qa_solicitacoes_servico.processo_id é INTEGER e não comporta o UUID de
    // qa_processos.id; por isso o vínculo canônico permanece por
    // (venda_id, servico_id, cliente_id) e pelo próprio qa_processos.solicitacao_id.
    if (solicitacaoId && processoId) {
      const { error: linkErr } = await admin.from("qa_solicitacoes_servico")
        .update({ status_processo: "processo_aberto" })
        .eq("id", solicitacaoId)
        .neq("status_processo", "processo_aberto");
      if (linkErr) {
        result.erros.push({ processo_id: processoId, solicitacao_id: solicitacaoId, etapa: "vincular_solicitacao", erro: linkErr.message });
      }
    }

    await recordContractEvent(admin, contractId, "servico_liberado_por_contrato_validado", {
      servico_id: servicoId, slug, processo_id: processoId, contract_item_id: it.id,
    });
    result.processos.push({ id: processoId, servico_id: servicoId, slug });
    result.items_processados++;
  }

  await recordContractEvent(admin, contractId, "contrato_validado_liberacao_concluida", {
    items: result.items_processados,
    processos: result.processos.length,
    solicitacoes: result.solicitacoes.length,
    erros: result.erros.length,
    erros_detalhe: result.erros,
  });

  return json({ ok: true, ...result }, 200);
});
