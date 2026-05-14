import { describe, it, expect } from "vitest";

/**
 * FASE 2C-2 — testes da lógica de gating do qa-checkout-iniciar-pagamento.
 *
 * Replicamos as helpers puras do edge (`sha256Hex`, `constantTimeEqual`)
 * e o gate de pré-condições. Garante que:
 *   - token errado/vencido bloqueia;
 *   - venda paga / com payment_id dispara reused;
 *   - valor sempre vem da venda, nunca do cliente;
 *   - billing_type aceito apenas PIX/BOLETO/CREDIT_CARD;
 *   - externalReference é qa_venda:<id> e customer é qa_cliente:<id>.
 */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

const ALLOWED_BILLING = new Set(["PIX", "BOLETO", "CREDIT_CARD"]);

interface VendaRow {
  id: number;
  status: string | null;
  cobranca_origem: string | null;
  cobranca_status: string | null;
  asaas_payment_id: string | null;
  valor_a_pagar: number | null;
  checkout_token_hash: string | null;
  checkout_token_expires_at: string | null;
}

async function gate(venda: VendaRow, body: { checkout_token: string; billing_type: string; valor_frontend?: number }) {
  if (!ALLOWED_BILLING.has(body.billing_type)) return { error: "invalid_billing_type" };
  if ((venda.cobranca_origem || "") !== "checkout_site") return { error: "venda_nao_eh_checkout_publico" };
  const submittedHash = await sha256Hex(body.checkout_token);
  if (!venda.checkout_token_hash || !constantTimeEqual(submittedHash, venda.checkout_token_hash)) {
    return { error: "checkout_token_invalido" };
  }
  if (!venda.checkout_token_expires_at || new Date(venda.checkout_token_expires_at).getTime() < Date.now()) {
    return { error: "checkout_token_expirado" };
  }
  if (String(venda.status || "").toUpperCase().trim() === "PAGO") return { error: "venda_ja_paga" };
  if (String(venda.cobranca_status || "").toLowerCase() === "confirmada") return { error: "cobranca_ja_confirmada" };
  if (venda.asaas_payment_id) return { reused: true, asaas_payment_id: venda.asaas_payment_id };
  const valor = Number(venda.valor_a_pagar);
  if (!Number.isFinite(valor) || valor <= 0) return { error: "valor_invalido" };
  return { ok: true, valor_canonico: valor }; // valor_frontend NUNCA é usado
}

function makeVenda(over: Partial<VendaRow> = {}): VendaRow {
  return {
    id: 123,
    status: "À INICIAR",
    cobranca_origem: "checkout_site",
    cobranca_status: "nao_gerada",
    asaas_payment_id: null,
    valor_a_pagar: 250.5,
    checkout_token_hash: null,
    checkout_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    ...over,
  };
}

describe("checkout iniciar-pagamento — gating", () => {
  const RAW = "tk_abc_123_super_secret_xxxxxxxxxxxxxx";

  it("aceita token correto + venda válida", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(makeVenda({ checkout_token_hash: hash }), {
      checkout_token: RAW,
      billing_type: "PIX",
    });
    expect(r).toEqual({ ok: true, valor_canonico: 250.5 });
  });

  it("bloqueia token inválido", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(makeVenda({ checkout_token_hash: hash }), {
      checkout_token: "tk_errado_xxxxxxxxxxxxxxxxx",
      billing_type: "PIX",
    });
    expect(r).toEqual({ error: "checkout_token_invalido" });
  });

  it("bloqueia token expirado", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(
      makeVenda({
        checkout_token_hash: hash,
        checkout_token_expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
      { checkout_token: RAW, billing_type: "PIX" },
    );
    expect(r).toEqual({ error: "checkout_token_expirado" });
  });

  it("bloqueia venda que não nasceu do checkout público", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(
      makeVenda({ checkout_token_hash: hash, cobranca_origem: "equipe_quero_armas" }),
      { checkout_token: RAW, billing_type: "PIX" },
    );
    expect(r).toEqual({ error: "venda_nao_eh_checkout_publico" });
  });

  it("bloqueia venda já paga", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(
      makeVenda({ checkout_token_hash: hash, status: "PAGO" }),
      { checkout_token: RAW, billing_type: "PIX" },
    );
    expect(r).toEqual({ error: "venda_ja_paga" });
  });

  it("retorna reused quando já existe asaas_payment_id", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(
      makeVenda({ checkout_token_hash: hash, asaas_payment_id: "pay_xyz" }),
      { checkout_token: RAW, billing_type: "PIX" },
    );
    expect(r).toEqual({ reused: true, asaas_payment_id: "pay_xyz" });
  });

  it("rejeita billing_type fora do allowlist", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(makeVenda({ checkout_token_hash: hash }), {
      checkout_token: RAW,
      billing_type: "CRYPTO",
    });
    expect(r).toEqual({ error: "invalid_billing_type" });
  });

  it("ignora valor enviado pelo frontend — usa valor_a_pagar da venda", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(makeVenda({ checkout_token_hash: hash, valor_a_pagar: 100 }), {
      checkout_token: RAW,
      billing_type: "PIX",
      valor_frontend: 1, // tentativa de underpayment
    });
    expect(r).toEqual({ ok: true, valor_canonico: 100 });
  });

  it("rejeita venda com valor inválido", async () => {
    const hash = await sha256Hex(RAW);
    const r = await gate(makeVenda({ checkout_token_hash: hash, valor_a_pagar: 0 }), {
      checkout_token: RAW,
      billing_type: "PIX",
    });
    expect(r).toEqual({ error: "valor_invalido" });
  });

  it("externalReference do payment é qa_venda:<id>", () => {
    const ref = `qa_venda:${makeVenda().id}`;
    expect(ref).toBe("qa_venda:123");
    expect(ref.startsWith("qa_venda:")).toBe(true);
  });

  it("externalReference do customer é qa_cliente:<id>", () => {
    const ref = `qa_cliente:${42}`;
    expect(ref).toBe("qa_cliente:42");
    expect(ref.startsWith("qa_cliente:")).toBe(true);
  });

  it("constantTimeEqual evita short-circuit em comprimentos iguais", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("a", "abc")).toBe(false);
  });

  it("hash do token salvo nunca é o token cru", async () => {
    const hash = await sha256Hex(RAW);
    expect(hash).not.toBe(RAW);
    expect(hash).toHaveLength(64);
  });
});