import { describe, expect, it } from "vitest";
import { toHubTipoCompartilhado } from "@/lib/quero-armas/hubTipoMap";

describe("tipos canônicos das certidões militares", () => {
  it("mantém STM e TJM em exigências diferentes", () => {
    expect(toHubTipoCompartilhado("certidao_crimes_militares_stm")).toBe("antecedentes_militar");
    expect(toHubTipoCompartilhado("antecedentes_militar")).toBe("antecedentes_militar");
    expect(toHubTipoCompartilhado("certidao_criminal_tjmsp")).toBe("antecedentes_militar_estadual");
    expect(toHubTipoCompartilhado("antecedentes_militar_estadual")).toBe("antecedentes_militar_estadual");
  });
});