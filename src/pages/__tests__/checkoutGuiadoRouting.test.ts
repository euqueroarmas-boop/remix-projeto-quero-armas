import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CHECKOUT_GUIADO_DESIGN_NAME,
  buildCheckoutGuiadoUrl,
} from "@/lib/quero-armas/checkoutGuiadoUrl";

describe("Checkout Guiado Dark Premium Quero Armas - roteamento", () => {
  const routes = readFileSync("src/pages/quero-armas/QARoutes.tsx", "utf8");
  const contratar = readFileSync("src/pages/quero-armas/QAContratarServicoPage.tsx", "utf8");
  const servicos = readFileSync("src/pages/ServicesListPage.tsx", "utf8");
  const carrinho = readFileSync("src/pages/CarrinhoPage.tsx", "utf8");

  it("nomeia o padrao visual aprovado", () => {
    expect(CHECKOUT_GUIADO_DESIGN_NAME).toBe("Checkout Guiado Dark Premium Quero Armas");
  });

  it("monta URL do cadastro refinado com servico confirmado para cliente logado", () => {
    expect(
      buildCheckoutGuiadoUrl("concessao-cr", {
        origem: "area_cliente_catalogo",
        servicoConfirmado: true,
        retomar: true,
      }),
    ).toBe("/cadastro?servico=concessao-cr&origem=area_cliente_catalogo&servico_confirmado=1&retomar=1");
  });

  it("area do cliente, carrinho e catalogo publico usam o helper do checkout guiado", () => {
    expect(contratar).toContain("buildCheckoutGuiadoUrl");
    expect(contratar).toContain("area_cliente_catalogo");
    expect(servicos).toContain("buildCheckoutGuiadoUrl");
    expect(servicos).toContain("servicos_cliente_logado");
    expect(carrinho).toContain("buildCheckoutGuiadoUrl");
    expect(carrinho).toContain("carrinho_cliente_logado");
  });

  it("rotas legadas de contratar redirecionam em vez de montar telas antigas", () => {
    expect(routes).toContain("ClienteContratarSlugRedirect");
    expect(routes).toContain('path="area-do-cliente/contratar/:slug/confirmar"');
    expect(routes).toContain('origem="area_cliente_confirmar_legado"');
    expect(routes).not.toContain("QAContratarConfirmarPage = lazyRetry");
    expect(routes).not.toContain("<QAContratarConfirmarPage");
    expect(routes).not.toContain("<QAContratarIdentificarPage");
    expect(routes).not.toContain("<QAContratarPublicoPage");
    expect(routes).not.toContain("<QAContratarSucessoPage");
  });
});
