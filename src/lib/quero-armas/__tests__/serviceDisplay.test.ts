import { describe, it, expect } from "vitest";
import { getQAServiceDisplayName } from "../serviceDisplay";

describe("getQAServiceDisplayName — fonte canônica de exibição de serviço", () => {
  it("renderiza Porte para slug porte-arma-fogo", () => {
    expect(getQAServiceDisplayName({ service_slug: "porte-arma-fogo" })).toBe("Porte de arma de fogo");
  });

  it("renderiza Posse para slug posse-arma-fogo", () => {
    expect(getQAServiceDisplayName({ service_slug: "posse-arma-fogo" })).toBe("Posse de arma de fogo");
  });

  it("nunca renderiza Posse quando slug é porte-arma-fogo", () => {
    const out = getQAServiceDisplayName({ service_slug: "porte-arma-fogo", servico_nome: "Posse na Polícia Federal" });
    expect(out).not.toMatch(/posse/i);
    expect(out).toMatch(/porte/i);
  });

  it("nunca renderiza Porte quando slug é posse-arma-fogo", () => {
    const out = getQAServiceDisplayName({ service_slug: "posse-arma-fogo", servico_nome: "Porte na Polícia Federal" });
    expect(out).not.toMatch(/porte/i);
    expect(out).toMatch(/posse/i);
  });

  it("usa nome do catálogo quando há slug desconhecido", () => {
    expect(getQAServiceDisplayName({ service_slug: "outro-servico", nome: "Serviço X" })).toBe("Serviço X");
  });

  it("retorna null quando catálogo está ausente — caller deve usar Serviço #id, nunca Posse", () => {
    expect(getQAServiceDisplayName({ servico_id: 99 })).toBeNull();
  });

  it("usa servico_nome quando não há slug", () => {
    expect(getQAServiceDisplayName({ servico_nome: "Porte na Polícia Federal" })).toBe("Porte na Polícia Federal");
  });
});