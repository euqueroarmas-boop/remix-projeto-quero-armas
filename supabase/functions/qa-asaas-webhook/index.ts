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

    // Gera protocolo oficial (QA-{SIGLA}-{ANO}-{SEQ}) — idempotente.
    // Best-effort: falha NÃO compromete o webhook.
    try {
      const { data: protoData, error: protoErr } = await supabase.rpc(
        "qa_gerar_protocolo",
        { p_venda_id: venda_id },
      );
      if (protoErr) {
        await logSistemaBackend({
          tipo: "protocolo", status: "error",
          mensagem: `qa-asaas-webhook: falha gerar protocolo venda ${venda_id}`,
          payload: { venda_id, error: protoErr.message },
        });
      } else {
        await logSistemaBackend({
          tipo: "protocolo", status: "success",
          mensagem: `qa-asaas-webhook: protocolo ${protoData} gerado p/ venda ${venda_id}`,
          payload: { venda_id, numero_protocolo: protoData },
        });
      }
    } catch (e) {
      await logSistemaBackend({
        tipo: "protocolo", status: "error",
        mensagem: `qa-asaas-webhook: exceção gerar protocolo venda ${venda_id}`,
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
