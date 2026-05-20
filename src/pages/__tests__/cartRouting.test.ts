import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Carrinho - checkout consolidado", () => {
  const carrinho = readFileSync("src/pages/CarrinhoPage.tsx", "utf8");

  it("finalizar contratacao aponta para o cadastro refinado", () => {
    expect(carrinho).toContain("origem: 'carrinho'");
    expect(carrinho).toContain("servico: slugs.join(',')");
    expect(carrinho).toContain("navigate(`/cadastro?");
  });

  it("nao usa a tela antiga /checkout/finalizar", () => {
    expect(carrinho).not.toContain("navigate(`/checkout/finalizar`)");
    expect(carrinho).not.toContain('navigate("/checkout/finalizar")');
    expect(carrinho).not.toContain("navigate('/checkout/finalizar')");
  });
});
