import { describe, it, expect } from "vitest";
import {
  snapshotCart,
  frozenSubtotal,
  isValidCPF,
  isValidEmail,
  isValidIdentificacao,
} from "../checkoutSnapshot";

describe("checkoutSnapshot", () => {
  it("calcula total a partir dos itens (cents)", () => {
    const r = snapshotCart([
      {
        service_id: "a",
        service_slug: "x",
        service_name: "X",
        unit_price_cents: 50000,
        quantity: 2,
      },
      {
        service_id: "b",
        service_slug: "y",
        service_name: "Y",
        unit_price_cents: 12345,
        quantity: 1,
      },
    ]);
    expect(r.total_cents).toBe(50000 * 2 + 12345);
    expect(r.lines[0].subtotal_cents).toBe(100000);
  });

  it("normaliza quantidade mínima 1", () => {
    const r = snapshotCart([
      {
        service_id: "a",
        service_slug: "x",
        service_name: "X",
        unit_price_cents: 1000,
        quantity: 0,
      },
    ]);
    expect(r.lines[0].quantity).toBe(1);
    expect(r.total_cents).toBe(1000);
  });

  it("snapshot independe de mudança futura do catálogo", () => {
    // Preço no momento da venda = 30000 cents.
    // Catálogo agora subiu para 99999 — subtotal congelado deve ignorar.
    expect(frozenSubtotal(30000, 2, 99999)).toBe(60000);
    expect(frozenSubtotal(30000, 2, 1)).toBe(60000);
  });

  it("valida CPF (apenas dígitos e tamanho)", () => {
    expect(isValidCPF("123.456.789-09")).toBe(true);
    expect(isValidCPF("11111111111")).toBe(false);
    expect(isValidCPF("123")).toBe(false);
  });

  it("valida e-mail", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("xx")).toBe(false);
  });

  it("valida identificação completa", () => {
    expect(
      isValidIdentificacao({
        nome_completo: "Fulano de Tal",
        cpf: "123.456.789-09",
        email: "f@t.com",
        celular: "(62) 99999-0000",
      }),
    ).toBe(true);
    expect(
      isValidIdentificacao({
        nome_completo: "X",
        cpf: "1",
        email: "no",
        celular: "1",
      }),
    ).toBe(false);
  });
});