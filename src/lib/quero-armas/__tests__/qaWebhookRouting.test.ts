import { describe, it, expect } from "vitest";

/**
 * FASE 2C-1 — Testes puros das helpers de roteamento do qa-asaas-webhook.
 * Mantemos cópias locais (sem importar Deno) para validar a regra canônica
 * sem acoplar a função edge a este teste. Mudanças aqui devem refletir as
 * helpers exportadas em supabase/functions/qa-asaas-webhook/index.ts.
 */
const QA_PREFIX = "qa_venda:";

function isQaExternalReference(ref: unknown): ref is string {
  return typeof ref === "string" && ref.startsWith(QA_PREFIX) && ref.length > QA_PREFIX.length;
}
function extractVendaId(ref: string): number | null {
  if (!ref.startsWith(QA_PREFIX)) return null;
  const raw = ref.slice(QA_PREFIX.length).trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}
function buildEventKey(event: string, paymentId: string, externalReference: string): string {
  return `${event}:${paymentId}:${externalReference}`;
}

type CobrancaUpdate = Record<string, unknown>;
function mapEventToUpdate(
  event: string,
  payment: { invoiceUrl?: string | null; bankSlipUrl?: string | null; dueDate?: string | null },
  current: { status?: string | null; cobranca_confirmada_em?: string | null },
): { update: CobrancaUpdate; ignored?: string } {
  const upd: CobrancaUpdate = {};
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      upd.cobranca_status = "confirmada";
      if (!current.cobranca_confirmada_em) upd.cobranca_confirmada_em = "now";
      if (current.status !== "PAGO") upd.status = "PAGO";
      if (payment.invoiceUrl) upd.asaas_invoice_url = payment.invoiceUrl;
      if (payment.bankSlipUrl) upd.asaas_bank_slip_url = payment.bankSlipUrl;
      if (payment.dueDate) upd.asaas_due_date = payment.dueDate;
      return { update: upd };
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

describe("FASE 2C-1 — roteamento qa-asaas-webhook", () => {
  describe("isQaExternalReference", () => {
    it("aceita qa_venda:<n>", () => {
      expect(isQaExternalReference("qa_venda:123")).toBe(true);
    });
    it("rejeita prefixo errado, vazio, número e nulo", () => {
      expect(isQaExternalReference("contract:42")).toBe(false);
      expect(isQaExternalReference("qa_venda:")).toBe(false);
      expect(isQaExternalReference("")).toBe(false);
      expect(isQaExternalReference(null)).toBe(false);
      expect(isQaExternalReference(undefined)).toBe(false);
      expect(isQaExternalReference(123 as any)).toBe(false);
    });
  });

  describe("extractVendaId", () => {
    it("extrai id válido", () => {
      expect(extractVendaId("qa_venda:42")).toBe(42);
    });
    it("rejeita não-numérico, zero, negativo, decimal", () => {
      expect(extractVendaId("qa_venda:abc")).toBeNull();
      expect(extractVendaId("qa_venda:0")).toBeNull();
      expect(extractVendaId("qa_venda:-1")).toBeNull();
      expect(extractVendaId("qa_venda:1.5")).toBeNull();
    });
  });

  describe("buildEventKey", () => {
    it("produz chave canônica", () => {
      expect(buildEventKey("PAYMENT_CONFIRMED", "pay_X", "qa_venda:7")).toBe(
        "PAYMENT_CONFIRMED:pay_X:qa_venda:7",
      );
    });
  });

  describe("mapEventToUpdate", () => {
    const empty = { invoiceUrl: null, bankSlipUrl: null, dueDate: null };

    it("PAYMENT_CONFIRMED marca PAGO e confirma cobrança", () => {
      const r = mapEventToUpdate("PAYMENT_CONFIRMED", empty, { status: "EM_ANALISE", cobranca_confirmada_em: null });
      expect(r.update.cobranca_status).toBe("confirmada");
      expect(r.update.status).toBe("PAGO");
      expect(r.update.cobranca_confirmada_em).toBeDefined();
      expect(r.ignored).toBeUndefined();
    });

    it("PAYMENT_RECEIVED tem o mesmo efeito", () => {
      const r = mapEventToUpdate("PAYMENT_RECEIVED", empty, { status: "EM_ANALISE", cobranca_confirmada_em: null });
      expect(r.update.cobranca_status).toBe("confirmada");
      expect(r.update.status).toBe("PAGO");
    });

    it("não sobrescreve status se já PAGO", () => {
      const r = mapEventToUpdate("PAYMENT_CONFIRMED", empty, { status: "PAGO", cobranca_confirmada_em: "2024-01-01" });
      expect(r.update.status).toBeUndefined();
      expect(r.update.cobranca_confirmada_em).toBeUndefined();
      expect(r.update.cobranca_status).toBe("confirmada");
    });

    it("propaga URLs/dueDate do payment", () => {
      const r = mapEventToUpdate(
        "PAYMENT_CONFIRMED",
        { invoiceUrl: "https://i.x", bankSlipUrl: "https://b.x", dueDate: "2026-01-01" },
        { status: "EM_ANALISE", cobranca_confirmada_em: null },
      );
      expect(r.update.asaas_invoice_url).toBe("https://i.x");
      expect(r.update.asaas_bank_slip_url).toBe("https://b.x");
      expect(r.update.asaas_due_date).toBe("2026-01-01");
    });

    it("PAYMENT_OVERDUE → vencida (sem alterar status)", () => {
      const r = mapEventToUpdate("PAYMENT_OVERDUE", empty, { status: "EM_ANALISE", cobranca_confirmada_em: null });
      expect(r.update).toEqual({ cobranca_status: "vencida" });
    });

    it("PAYMENT_DELETED → cancelada", () => {
      expect(mapEventToUpdate("PAYMENT_DELETED", empty, {}).update).toEqual({ cobranca_status: "cancelada" });
    });

    it("PAYMENT_REFUNDED / IN_PROGRESS → estornada", () => {
      expect(mapEventToUpdate("PAYMENT_REFUNDED", empty, {}).update).toEqual({ cobranca_status: "estornada" });
      expect(mapEventToUpdate("PAYMENT_REFUND_IN_PROGRESS", empty, {}).update).toEqual({ cobranca_status: "estornada" });
    });

    it("CHARGEBACK_* → chargeback", () => {
      expect(mapEventToUpdate("PAYMENT_CHARGEBACK_REQUESTED", empty, {}).update).toEqual({ cobranca_status: "chargeback" });
      expect(mapEventToUpdate("PAYMENT_CHARGEBACK_DISPUTE", empty, {}).update).toEqual({ cobranca_status: "chargeback" });
    });

    it("evento desconhecido → ignored unhandled_event", () => {
      const r = mapEventToUpdate("PAYMENT_RANDOM", empty, {});
      expect(r.ignored).toBe("unhandled_event");
      expect(r.update).toEqual({});
    });
  });
});
