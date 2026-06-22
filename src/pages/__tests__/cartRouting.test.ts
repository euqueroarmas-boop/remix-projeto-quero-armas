import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Carrinho - checkout consolidado", () => {
  const carrinho = readFileSync("src/pages/CarrinhoPage.tsx", "utf8");

  it("finalizar contratacao aponta para o cadastro refinado", () => {
    expect(carrinho).toContain("buildCheckoutGuiadoUrl");
    expect(carrinho).toContain("origem: 'carrinho'");
    expect(carrinho).toContain("origem: 'carrinho_cliente_logado'");
    expect(carrinho).toContain("servicoConfirmado: true");
    expect(carrinho).toContain("retomar: true");
  });

  it("nao usa a tela antiga /checkout/finalizar", () => {
    expect(carrinho).not.toContain("navigate(`/checkout/finalizar`)");
    expect(carrinho).not.toContain('navigate("/checkout/finalizar")');
    expect(carrinho).not.toContain("navigate('/checkout/finalizar')");
  });

  it("nao envia cliente logado para a confirmacao legada da area do cliente", () => {
    expect(carrinho).not.toContain("navigate(`/area-do-cliente/contratar/${slugs[0]}/confirmar`)");
  });
});
