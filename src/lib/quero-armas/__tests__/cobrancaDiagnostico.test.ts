import { describe, it, expect } from "vitest";

/**
 * FASE 2B-1 — Verificação mínima do diagnóstico de cobrança.
 * Não há lógica de geração nesta fase; testamos só o "rótulo" exibido na UI.
 */
function rotuloCobranca(v: { asaas_payment_id?: string | null; cobranca_status?: string | null }) {
  if (!v.asaas_payment_id) return { tipo: "ausente" as const, label: "Cobrança não gerada" };
  return {
    tipo: "vinculada" as const,
    paymentId: v.asaas_payment_id,
    status: v.cobranca_status ?? "—",
  };
}

const STATUS_VALIDOS = [
  "nao_gerada",
  "aguardando_pagamento",
  "confirmada",
  "vencida",
  "cancelada",
  "estornada",
  "chargeback",
  "erro",
];

describe("FASE 2B-1 — diagnóstico de cobrança em qa_vendas", () => {
  it("venda sem cobrança aparece como 'Cobrança não gerada'", () => {
    expect(rotuloCobranca({})).toEqual({ tipo: "ausente", label: "Cobrança não gerada" });
    expect(rotuloCobranca({ asaas_payment_id: null })).toEqual({
      tipo: "ausente",
      label: "Cobrança não gerada",
    });
  });

  it("venda com payment_id mostra ID e status", () => {
    const r = rotuloCobranca({ asaas_payment_id: "pay_123", cobranca_status: "aguardando_pagamento" });
    expect(r.tipo).toBe("vinculada");
    if (r.tipo === "vinculada") {
      expect(r.paymentId).toBe("pay_123");
      expect(r.status).toBe("aguardando_pagamento");
    }
  });

  it("venda com payment_id sem status mostra '—'", () => {
    const r = rotuloCobranca({ asaas_payment_id: "pay_456" });
    expect(r.tipo).toBe("vinculada");
    if (r.tipo === "vinculada") expect(r.status).toBe("—");
  });

  it("catálogo de cobranca_status documentado é estável", () => {
    expect(STATUS_VALIDOS).toContain("aguardando_pagamento");
    expect(STATUS_VALIDOS).toContain("confirmada");
    expect(STATUS_VALIDOS).toContain("vencida");
    expect(new Set(STATUS_VALIDOS).size).toBe(STATUS_VALIDOS.length);
  });
});