/**
 * FASE 2C-1 — qa-asaas-webhook
 *
 * Webhook Asaas EXCLUSIVO do Quero Armas.
 * Processa SOMENTE pagamentos com externalReference = "qa_venda:<id>".
 *
 * Isolamento total do legado WMTi:
 *  - NÃO importa post-purchase / customerResolver / ensureClientAccess
 *  - NÃO toca em payments / contracts / quotes / customers
 *  - NÃO chama qa-generate-contract (a trigger de qa_vendas faz isso)
 *  - NÃO cria processo nem checklist
 *
 * Idempotência: tabela qa_asaas_webhook_events (event_key UNIQUE).
 * Token: QA_ASAAS_WEBHOOK_TOKEN (fallback ASAAS_WEBHOOK_TOKEN).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { executarPipelinePosPagamento } from "../_shared/qaPosPagamento.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token, x-asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const QA_PREFIX = "qa_venda:";

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isQaExternalReference(ref: unknown): ref is string {
  return typeof ref === "string" && ref.startsWith(QA_PREFIX) && ref.length > QA_PREFIX.length;
}

export function extractVendaId(ref: string): number | null {
  if (!ref.startsWith(QA_PREFIX)) return null;
  const raw = ref.slice(QA_PREFIX.length).trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}

export function buildEventKey(event: string, paymentId: string, externalReference: string): string {
  return `${event}:${paymentId}:${externalReference}`;
}

type CobrancaUpdate = Record<string, unknown>;

export function mapEventToUpdate(
  event: string,
  payment: { invoiceUrl?: string | null; bankSlipUrl?: string | null; dueDate?: string | null },
  current: { status?: string | null; cobranca_confirmada_em?: string | null },
): { update: CobrancaUpdate; ignored?: string } {
  const upd: CobrancaUpdate = {};
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      upd.cobranca_status = "confirmada";
      if (!current.cobranca_confirmada_em) upd.cobranca_confirmada_em = new Date().toISOString();
      if (current.status !== "PAGO") upd.status = "PAGO";
      if (payment.invoiceUrl) upd.asaas_invoice_url = payment.invoiceUrl;
      if (payment.bankSlipUrl) upd.asaas_bank_slip_url = payment.bankSlipUrl;
      if (payment.dueDate) upd.asaas_due_date = payment.dueDate;
      return { update: upd };
    }
    case "PAYMENT_OVERDUE":
      return { update: { cobranca_status: "vencida" } };
    case "PAYMENT_DELETED":
      return { update: { cobranca_status: "cancelada" } };
    case "PAYMENT_REFUNDED":
    case "PAYMENT_REFUND_IN_PROGRESS":
      return { update: { cobranca_status: "estornada" } };
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_CHARGEBACK_DISPUTE":
      return { update: { cobranca_status: "chargeback" } };
    default:
      return { update: {}, ignored: "unhandled_event" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ---- Token ----
  const expected =
    Deno.env.get("QA_ASAAS_WEBHOOK_TOKEN") || Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
  const provided =
    req.headers.get("asaas-access-token") || req.headers.get("x-asaas-access-token") || "";
  if (!expected || !provided || !constantTimeEquals(provided, expected)) {
    return json({ error: "unauthorized" }, 401);
  }

  // ---- Parse ----
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const event = String(payload?.event || "").trim();
  const payment = payload?.payment ?? {};
  const externalReference = payment?.externalReference;
  const paymentId = payment?.id ? String(payment.id) : "";

  if (!event) return json({ error: "missing_event" }, 400);

  // Roteamento: somente Quero Armas.
  if (!isQaExternalReference(externalReference)) {
    return json({ ignored: "not_qa" }, 200);
  }
  if (!paymentId) {
    return json({ ignored: "missing_payment_id" }, 200);
  }
  const venda_id = extractVendaId(externalReference);
  if (!venda_id) {
    return json({ ignored: "invalid_qa_reference" }, 200);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const event_key = buildEventKey(event, paymentId, externalReference);

  // ---- Idempotência ----
  const { error: insErr } = await supabase
    .from("qa_asaas_webhook_events")
    .insert({
      event_key,
      event,
      asaas_payment_id: paymentId,
      external_reference: externalReference,
      venda_id,
      status: "received",
      payload,
    });

  if (insErr) {
    const { data: existing } = await supabase
      .from("qa_asaas_webhook_events")
      .select("status")
      .eq("event_key", event_key)
      .maybeSingle();
    if (existing) {
      return json({ idempotent: true, status: existing.status }, 200);
    }
    await logSistemaBackend({
      tipo: "webhook", status: "error",
      mensagem: `qa-asaas-webhook: falha ao registrar evento ${event}`,
      payload: { event, paymentId, venda_id, error: insErr.message },
    });
    return json({ error: "audit_insert_failed" }, 200);
  }

  const finalize = async (status: string, error_message?: string) => {
    await supabase
      .from("qa_asaas_webhook_events")
      .update({ status, processed_at: new Date().toISOString(), error_message: error_message ?? null })
      .eq("event_key", event_key);
  };

  // ---- Buscar venda ----
  const { data: venda, error: vErr } = await supabase
    .from("qa_vendas")
    .select("id, status, asaas_payment_id, cobranca_confirmada_em")
    .eq("id", venda_id)
    .maybeSingle();

  if (vErr) {
    await finalize("error", vErr.message);
    await logSistemaBackend({
      tipo: "webhook", status: "error",
      mensagem: `qa-asaas-webhook: erro DB ao buscar venda ${venda_id}`,
      payload: { event, paymentId, venda_id, error: vErr.message },
    });
    return json({ error: "db_error" }, 200);
  }
  if (!venda) {
    await finalize("ignored", "venda_not_found");
    return json({ ignored: "venda_not_found" }, 200);
  }

  await logSistemaBackend({
    tipo: "webhook", status: "info",
    mensagem: `qa-asaas-webhook: evento ${event} recebido para venda ${venda_id}`,
    payload: { event, paymentId, venda_id },
  });

  // ---- payment.id vs qa_vendas.asaas_payment_id ----
  let backfilled = false;
  if (venda.asaas_payment_id && venda.asaas_payment_id !== paymentId) {
    await finalize("mismatch", `expected=${venda.asaas_payment_id} got=${paymentId}`);
    await logSistemaBackend({
      tipo: "webhook", status: "error",
      mensagem: `qa-asaas-webhook: payment.id divergente para venda ${venda_id}`,
      payload: { event, paymentId, venda_id, expected: venda.asaas_payment_id },
    });
    return json({ ignored: "payment_mismatch" }, 200);
  }
  if (!venda.asaas_payment_id) {
    backfilled = true;
    await logSistemaBackend({
      tipo: "webhook", status: "warning",
      mensagem: `qa-asaas-webhook: payment_id_backfilled_from_webhook venda ${venda_id}`,
      payload: { event, paymentId, venda_id },
    });
  }

  // ---- Mapeia evento ----
  const { update, ignored } = mapEventToUpdate(
    event,
    {
      invoiceUrl: payment?.invoiceUrl ?? null,
      bankSlipUrl: payment?.bankSlipUrl ?? null,
      dueDate: payment?.dueDate ?? null,
    },
    { status: venda.status, cobranca_confirmada_em: venda.cobranca_confirmada_em },
  );

  if (ignored) {
    await finalize("ignored", ignored);
    return json({ ignored }, 200);
  }

  if (backfilled) update.asaas_payment_id = paymentId;

  const { error: uErr } = await supabase
    .from("qa_vendas")
    .update(update)
    .eq("id", venda_id);

  if (uErr) {
    await finalize("error", uErr.message);
    await logSistemaBackend({
      tipo: "webhook", status: "error",
      mensagem: `qa-asaas-webhook: falha update venda ${venda_id}`,
      payload: { event, paymentId, venda_id, error: uErr.message },
    });
    return json({ error: "update_failed" }, 200);
  }

  await finalize("success");

  if (update.status === "PAGO") {
    await logSistemaBackend({
      tipo: "pagamento", status: "success",
      mensagem: `qa-asaas-webhook: venda ${venda_id} marcada como PAGO`,
      payload: { event, paymentId, venda_id },
    });

    // Pipeline canônico pós-pagamento: gerar_protocolo + qa-generate-contract
    // + notificações. Idempotente e best-effort.
    await executarPipelinePosPagamento(supabase as any, venda_id, "asaas_webhook");

    // ── Camada ADITIVA: provisiona acesso ao Arsenal Inteligente (portal)
    //    para o cliente da venda. A function é idempotente (no-op se
    //    portal_provisionado_em já existir). Best-effort: erro NÃO derruba
    //    o webhook.
    try {
      const { data: vendaCli, error: vendaCliErr } = await supabase
        .from("qa_vendas")
        .select("cliente_id")
        .eq("id", venda_id)
        .maybeSingle();
      if (vendaCliErr || !vendaCli?.cliente_id) {
        await logSistemaBackend({
          tipo: "portal", status: "warning",
          mensagem: `qa-asaas-webhook: venda ${venda_id} sem cliente_id p/ provisionar portal`,
          payload: { venda_id, error: vendaCliErr?.message ?? null },
        });
      } else {
        const { data: provData, error: provErr } = await supabase.functions.invoke(
          "qa-provisionar-acesso-portal",
          { body: { qa_client_id: vendaCli.cliente_id, venda_id } },
        );
        if (provErr) {
          await logSistemaBackend({
            tipo: "portal", status: "error",
            mensagem: `qa-asaas-webhook: provisionar acesso portal falhou venda ${venda_id}`,
            payload: { venda_id, cliente_id: vendaCli.cliente_id, error: provErr.message },
          });
        } else {
          await logSistemaBackend({
            tipo: "portal", status: "success",
            mensagem: `qa-asaas-webhook: acesso portal provisionado venda ${venda_id}`,
            payload: { venda_id, cliente_id: vendaCli.cliente_id, result: provData ?? null },
          });
        }
      }
    } catch (e) {
      await logSistemaBackend({
        tipo: "portal", status: "error",
        mensagem: `qa-asaas-webhook: exceção provisionar portal venda ${venda_id}`,
        payload: { venda_id, error: String((e as any)?.message || e) },
      });
    }

    // ── Camada ADITIVA: dispara qa_confirmar_pagamento_processo para cada
    //    processo desta venda. A RPC é idempotente (ja_estava_confirmado=true
    //    no segundo disparo) e ela mesma EXPLODE o checklist via
    //    qa_explodir_checklist_processo. Substitui o passo manual da Equipe.
    //    Best-effort: erro aqui NÃO derruba o webhook.
    try {
      const { data: procs, error: procsErr } = await supabase
        .from("qa_processos")
        .select("id, pagamento_status")
        .eq("venda_id", venda_id);

      if (procsErr) {
        await logSistemaBackend({
          tipo: "webhook", status: "error",
          mensagem: `qa-asaas-webhook: falha listar processos da venda ${venda_id}`,
          payload: { venda_id, error: procsErr.message },
        });
      } else if (!procs || procs.length === 0) {
        await logSistemaBackend({
          tipo: "webhook", status: "warning",
          mensagem: `qa-asaas-webhook: nenhum processo encontrado p/ venda ${venda_id} no instante do PAGO`,
          payload: { venda_id },
        });
      } else {
        for (const p of procs) {
          try {
            const { data: confRes, error: confErr } = await supabase.rpc(
              "qa_confirmar_pagamento_processo",
              { p_processo_id: p.id, p_origem: "asaas_webhook", p_bypass_contrato_validado: false },
            );
            if (confErr) {
              await logSistemaBackend({
                tipo: "pagamento", status: "error",
                mensagem: `qa-asaas-webhook: confirmar_pagamento_processo falhou`,
                payload: { venda_id, processo_id: p.id, error: confErr.message },
              });
              continue;
            }

            // GATE DE CONTRATO ASSINADO (Fase Hardening):
            // A RPC qa_confirmar_pagamento_processo bloqueia a explosão do
            // checklist quando não há contrato 'validated' para a venda.
            // Nesse caso ela confirma o pagamento e move o processo para
            // 'aguardando_assinatura' (Arsenal gratuito segue liberado pelo
            // frontend; checklist só após assinatura). Retorna
            // skipped='contract_not_validated'. Aqui só registramos auditoria
            // explícita e seguimos — sem notificar pagamento_confirmado.
            if ((confRes as any)?.skipped === "contract_not_validated") {
              await logSistemaBackend({
                tipo: "pagamento", status: "warning",
                mensagem: `qa-asaas-webhook: processo ${p.id} movido para aguardando_assinatura — pagamento OK, contrato pendente (venda ${venda_id})`,
                payload: { venda_id, processo_id: p.id, origem: "asaas_webhook" },
              });
              continue;
            }

            // pós-pagamento (protocolo interno do processo + status produção)
            try {
              await supabase.rpc("qa_pos_pagamento_protocolar", {
                p_processo_id: p.id,
              });
            } catch (e) {
              console.warn("[qa-asaas-webhook] pos_pagamento_protocolar:", e);
            }

            // Notifica apenas se a confirmação foi efetiva agora
            if (!confRes?.ja_estava_confirmado) {
              supabase.functions
                .invoke("qa-processo-notificar", {
                  body: { processo_id: p.id, evento: "pagamento_confirmado" },
                })
                .catch((e) =>
                  console.warn("[qa-asaas-webhook] notificar falhou:", e),
                );

              await logSistemaBackend({
                tipo: "pagamento", status: "success",
                mensagem: `qa-asaas-webhook: processo ${p.id} confirmado + checklist explodido (venda ${venda_id})`,
                payload: {
                  venda_id,
                  processo_id: p.id,
                  checklist_inseridos: confRes?.checklist_inseridos ?? null,
                  checklist_ja_existentes: confRes?.checklist_ja_existentes ?? null,
                },
              });
            }

            // Camada ADITIVA — se o pagamento era o último bloqueio para
            // promover o processo a "pronto_para_protocolar", a edge
            // function abaixo cuidará da promoção e do envio idempotente
            // dos e-mails. Best-effort: erro NÃO derruba o webhook.
            try {
              await supabase.functions.invoke(
                "qa-processo-checar-conclusao-checklist",
                { body: { processo_id: p.id, origem: "webhook_asaas" } },
              );
            } catch (e) {
              console.warn(
                "[qa-asaas-webhook] checar-conclusao falhou:",
                e,
              );
            }
          } catch (e) {
            await logSistemaBackend({
              tipo: "pagamento", status: "error",
              mensagem: `qa-asaas-webhook: exceção confirmando processo ${p.id}`,
              payload: { venda_id, processo_id: p.id, error: String((e as any)?.message || e) },
            });
          }
        }
      }
    } catch (e) {
      await logSistemaBackend({
        tipo: "webhook", status: "error",
        mensagem: `qa-asaas-webhook: exceção no bloco automação processos venda ${venda_id}`,
        payload: { venda_id, error: String((e as any)?.message || e) },
      });
    }
  } else {
    await logSistemaBackend({
      tipo: "webhook", status: "info",
      mensagem: `qa-asaas-webhook: venda ${venda_id} cobranca_status=${update.cobranca_status}`,
      payload: { event, paymentId, venda_id, cobranca_status: update.cobranca_status },
    });
  }

  return json({ success: true, venda_id, applied: update }, 200);
});
