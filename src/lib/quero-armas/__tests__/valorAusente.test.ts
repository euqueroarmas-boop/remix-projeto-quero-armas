import { describe, it, expect } from "vitest";
import { valorAusente, normalizarAptidao } from "../valorAusente";

describe("valorAusente", () => {
  it("trata sentinelas de ausência como dado inexistente", () => {
    for (const v of ["(não consta)", "NÃO CONSTA", "não informado", "n/a", "—", "  ", "***", null, undefined, "ilegível"]) {
      expect(valorAusente(v as any)).toBe(true);
    }
  });
  it("mantém valor real como presente", () => {
    expect(valorAusente("04/08/1981")).toBe(false);
    expect(valorAusente("ANTHONY NELSON")).toBe(false);
  });
});

describe("normalizarAptidao", () => {
  it("lê apto e inapto", () => {
    expect(normalizarAptidao("APTO")).toBe("apto");
    expect(normalizarAptidao("Considerado INAPTO")).toBe("inapto");
    expect(normalizarAptidao("não apto")).toBe("inapto");
    expect(normalizarAptidao("(não consta)")).toBeNull();
  });
});
