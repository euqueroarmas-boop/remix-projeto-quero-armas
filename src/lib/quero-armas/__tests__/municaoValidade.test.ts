import { describe, it, expect } from "vitest";
import { calcularValidadeMunicao } from "../municaoValidade";

const HOJE = new Date("2026-05-03T12:00:00Z");

describe("calcularValidadeMunicao", () => {
  it("sem data → cinza + sem_data", () => {
    const r = calcularValidadeMunicao(null, HOJE);
    expect(r.sem_data).toBe(true);
    expect(r.status.cor).toBe("cinza");
    expect(r.data_validade).toBeNull();
  });

  it("data inválida → cinza + sem_data", () => {
    const r = calcularValidadeMunicao("xxxx" as any, HOJE);
    expect(r.sem_data).toBe(true);
    expect(r.status.cor).toBe("cinza");
  });

  it("vencida (fab há 6 anos) → vermelho", () => {
    // fab + 60m = +5y → já passou 1 ano
    const r = calcularValidadeMunicao("2020-05-03", HOJE);
    expect(r.sem_data).toBe(false);
    expect(r.data_validade).toBe("2025-05-03");
    expect(r.status.cor).toBe("vermelho");
  });

  it("vencendo (fab há ~4 anos e 11 meses) → amarelo/laranja", () => {
    // validade ≈ daqui 1 mês
    const r = calcularValidadeMunicao("2021-06-03", HOJE);
    expect(r.sem_data).toBe(false);
    expect(["amarelo", "laranja"]).toContain(r.status.cor);
  });

  it("ok (fab recente) → verde", () => {
    const r = calcularValidadeMunicao("2025-01-01", HOJE);
    expect(r.sem_data).toBe(false);
    expect(r.data_validade).toBe("2030-01-01");
    expect(r.status.cor).toBe("verde");
  });
});