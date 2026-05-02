import { describe, expect, it } from "vitest";
import { computeChecklistMetrics, normalizeChecklistStage } from "../checklistMetrics";

describe("Checklist Concessão de CR — métricas reais", () => {
  it("conta somente documentos reais do processo", () => {
    const metrics = computeChecklistMetrics([
      { status: "aprovado" },
      { status: "validado" },
      { status: "em_analise" },
      { status: "pendente" },
      { status: "invalido" },
    ]);

    expect(metrics).toMatchObject({
      total: 5,
      cumpridos: 2,
      emAnalise: 1,
      pendentes: 2,
      progresso: 40,
    });
  });

  it("normaliza etapas antigas sem permitir valor fora do CHECK", () => {
    expect(normalizeChecklistStage("antecedentes")).toBe("base");
    expect(normalizeChecklistStage("declaracoes")).toBe("complementar");
    expect(normalizeChecklistStage("renda")).toBe("complementar");
    expect(normalizeChecklistStage("tecnico")).toBe("tecnico");
    expect(normalizeChecklistStage(null)).toBe("base");
  });
});