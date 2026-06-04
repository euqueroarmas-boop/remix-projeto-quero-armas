import { describe, it, expect } from "vitest";
import {
  calcularPrecoFinal,
  listarOpcoesParcelamento,
  auditarRecebimentoLiquido,
  DEFAULT_PRICING_CONFIG,
  uiPagamentoToBillingType,
} from "../checkoutPricing";

describe("checkoutPricing — gross-up Asaas (taxas reais 18/05/2026)", () => {
  describe("PIX", () => {
    it("cliente paga = preco_base (Asaas não cobra PIX)", () => {
      const r = calcularPrecoFinal(1500, "PIX");
      expect(r.valorTotal).toBe(1500);
      expect(r.encargosReais).toBe(0);
    });
  });

  describe("BOLETO", () => {
    it("cliente paga preco_base + R$ 1,99 (taxa por boleto pago)", () => {
      const r = calcularPrecoFinal(1500, "BOLETO");
      expect(r.valorTotal).toBe(1501.99);
      expect(r.encargosReais).toBe(1.99);
    });

    it("líquido recebido = preco_base", () => {
      const r = calcularPrecoFinal(1500, "BOLETO");
      const aud = auditarRecebimentoLiquido(r);
      expect(aud.liquidoEsperado).toBe(1500);
      expect(Math.abs(aud.diffParaBase)).toBeLessThan(0.01);
    });
  });

  describe("CREDIT_CARD — gross-up garante líquido = preco_base", () => {
    it("1x: cliente paga ~4,3% acima (MDR 2,99% + R$0,49 + 1,15% antecipação)", () => {
      const r = calcularPrecoFinal(1500, "CREDIT_CARD", 1);
      expect(r.encargosFracao).toBeGreaterThan(0.04);
      expect(r.encargosFracao).toBeLessThan(0.05);
      const aud = auditarRecebimentoLiquido(r);
      expect(Math.abs(aud.diffParaBase)).toBeLessThan(0.05);
    });

    it("6x: cliente paga ~9-10% acima", () => {
      const r = calcularPrecoFinal(1500, "CREDIT_CARD", 6);
      expect(r.encargosFracao).toBeGreaterThan(0.09);
      expect(r.encargosFracao).toBeLessThan(0.105);
    });

    it("12x: cliente paga ~15-16% acima", () => {
      const r = calcularPrecoFinal(1500, "CREDIT_CARD", 12);
      expect(r.encargosFracao).toBeGreaterThan(0.15);
      expect(r.encargosFracao).toBeLessThan(0.16);
    });

    it("auditoria: TODAS as faixas devolvem líquido ≈ preco_base", () => {
      for (let n = 1; n <= 12; n++) {
        const r = calcularPrecoFinal(1500, "CREDIT_CARD", n);
        const aud = auditarRecebimentoLiquido(r);
        expect(Math.abs(aud.diffParaBase)).toBeLessThan(0.05); // tolerância 5 centavos por arredondamento
      }
    });

    it("salto de faixa MDR: 7x deve cobrar mais que 6x (3,99% vs 3,49%)", () => {
      const r6 = calcularPrecoFinal(1500, "CREDIT_CARD", 6);
      const r7 = calcularPrecoFinal(1500, "CREDIT_CARD", 7);
      // r7 fica significativamente acima de r6 por causa do salto de MDR
      expect(r7.valorTotal - r6.valorTotal).toBeGreaterThan(15);
    });

    it("limita parcelas no maxParcelas (default 12)", () => {
      const r = calcularPrecoFinal(1500, "CREDIT_CARD", 24);
      expect(r.parcelas).toBe(12);
    });

    it("normaliza parcelas <= 0 para 1", () => {
      const r = calcularPrecoFinal(1500, "CREDIT_CARD", 0);
      expect(r.parcelas).toBe(1);
    });
  });

  describe("modo sem antecipação (lojista absorve o tempo)", () => {
    const cfgSemAnteci = {
      ...DEFAULT_PRICING_CONFIG,
      asaas: { ...DEFAULT_PRICING_CONFIG.asaas, modoAntecipacao: "nenhuma" as const },
    };

    it("12x sem antecipação ~4,2% (só MDR + R$0,49)", () => {
      const r = calcularPrecoFinal(1500, "CREDIT_CARD", 12, cfgSemAnteci);
      expect(r.encargosFracao).toBeGreaterThan(0.04);
      expect(r.encargosFracao).toBeLessThan(0.045);
    });

    it("1x sem antecipação ~3,1% (só MDR 2,99% + R$0,49)", () => {
      const r = calcularPrecoFinal(1500, "CREDIT_CARD", 1, cfgSemAnteci);
      expect(r.encargosFracao).toBeGreaterThan(0.03);
      expect(r.encargosFracao).toBeLessThan(0.035);
    });
  });

  describe("listarOpcoesParcelamento", () => {
    it("gera exatamente 12 opções com total crescente", () => {
      const opts = listarOpcoesParcelamento(1500);
      expect(opts).toHaveLength(12);
      for (let k = 1; k < opts.length; k++) {
        expect(opts[k].valorTotal).toBeGreaterThanOrEqual(opts[k - 1].valorTotal);
      }
    });
  });

  describe("validação de entradas", () => {
    it("lança erro em preço inválido", () => {
      expect(() => calcularPrecoFinal(0, "PIX")).toThrow();
      expect(() => calcularPrecoFinal(-100, "PIX")).toThrow();
      expect(() => calcularPrecoFinal(NaN, "PIX")).toThrow();
      expect(() => calcularPrecoFinal(Infinity, "PIX")).toThrow();
    });
  });

  describe("uiPagamentoToBillingType", () => {
    it("mapeia corretamente", () => {
      expect(uiPagamentoToBillingType("pix")).toBe("PIX");
      expect(uiPagamentoToBillingType("boleto")).toBe("BOLETO");
      expect(uiPagamentoToBillingType("cartao")).toBe("CREDIT_CARD");
    });
  });

  describe("invariante crítico: lojista sempre recebe ≥ preco_base", () => {
    it("para vários precoBase (R$ 200 até R$ 20.000) e todas as faixas", () => {
      [200, 500, 1500, 4500, 9990, 14479.19, 20000].forEach((base) => {
        for (let n = 1; n <= 12; n++) {
          const r = calcularPrecoFinal(base, "CREDIT_CARD", n);
          const aud = auditarRecebimentoLiquido(r);
          // tolerância 10 centavos pra arredondamento em valores altos
          expect(aud.diffParaBase).toBeGreaterThanOrEqual(-0.10);
        }
      });
    });
  });
});
