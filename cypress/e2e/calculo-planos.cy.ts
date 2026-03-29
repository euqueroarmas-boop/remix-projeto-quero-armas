/// <reference types="cypress" />

/**
 * Testa a lógica de cálculo de planos (12, 24, 36 meses)
 * na etapa de Configuração do Plano do wizard de contratação.
 *
 * Valores base: 1 host (R$350) + 2 VMs (R$400) = R$750/mês
 * Descontos: 12m → 0%, 24m → 7%, 36m → 12%
 * Suporte 24h: +35% sobre subtotal com desconto
 */

describe("Cálculo de Planos — 12, 24, 36 meses", () => {
  beforeEach(() => {
    cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=2");
    cy.get("#contracting-wizard").should("be.visible");
  });

  const fillAndSubmitRegistration = () => {
    cy.get('[data-testid="campo-cnpj"]').clear().type("12345678000190", { delay: 10 });
    cy.wait(1000);

    cy.get('[data-testid="campo-razao-social"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("Empresa Teste LTDA");
    });
    cy.get('[data-testid="campo-representante-nome"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("João da Silva");
    });
    cy.get('[data-testid="campo-representante-cpf"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("37799538899");
    });
    cy.get('[data-testid="campo-representante-email"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("joao@teste.com");
    });
    cy.get('[data-testid="campo-representante-telefone"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("12998765432");
    });
    cy.get('[data-testid="campo-cep"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("12327000");
    });

    cy.wait(500);

    cy.get('input[placeholder*="Logradouro"], input[placeholder*="logradouro"]').then(($el) => {
      if ($el.length && !$el.val()) cy.wrap($el).type("Rua das Flores");
    });
    cy.get('[data-testid="campo-numero"]').then(($el) => {
      if ($el.length && !$el.val()) cy.wrap($el).type("100");
    });
    cy.get('input[placeholder*="Cidade"], input[placeholder*="cidade"]').then(($el) => {
      if ($el.length && !$el.val()) cy.wrap($el).type("Jacareí");
    });
    cy.get('input[placeholder*="UF"], input[placeholder*="uf"], input[placeholder*="Estado"]').then(($el) => {
      if ($el.length && !$el.val()) cy.wrap($el).type("SP");
    });

    cy.get('[data-testid="botao-prosseguir-cadastro"]').click();
  };

  it("exibe a etapa de Configuração do Plano após cadastro", () => {
    fillAndSubmitRegistration();
    cy.get('[data-testid="plano-12-meses"]', { timeout: 15000 }).should("be.visible");
    cy.get('[data-testid="plano-24-meses"]').should("be.visible");
    cy.get('[data-testid="plano-36-meses"]').should("be.visible");
  });

  it("12 meses → sem desconto (R$750,00)", () => {
    fillAndSubmitRegistration();
    cy.get('[data-testid="plano-12-meses"]', { timeout: 15000 }).click();
    cy.get('[data-testid="resumo-valor-base"]').should("contain", "750,00");
  });

  it("24 meses → 7% de desconto (R$697,50)", () => {
    fillAndSubmitRegistration();
    cy.get('[data-testid="plano-24-meses"]', { timeout: 15000 }).click();
    cy.get('[data-testid="resumo-subtotal"]').should("contain", "697,50");
    cy.get('[data-testid="resumo-desconto"]').should("be.visible");
  });

  it("36 meses → 12% de desconto (R$660,00)", () => {
    fillAndSubmitRegistration();
    cy.get('[data-testid="plano-36-meses"]', { timeout: 15000 }).click();
    cy.get('[data-testid="resumo-subtotal"]').should("contain", "660,00");
  });

  it("Suporte 24h adiciona 35% sobre subtotal com desconto", () => {
    fillAndSubmitRegistration();
    cy.get('[data-testid="plano-24-meses"]', { timeout: 15000 }).click();
    cy.get('[data-testid="resumo-subtotal"]').should("contain", "697,50");

    cy.get('[data-testid="toggle-suporte-24h"]').click();
    cy.get('[data-testid="resumo-adicional-24h"]').should("be.visible");
    cy.get('[data-testid="resumo-total-mensal"]').should("contain", "941,6");
  });

  it("total do contrato calcula corretamente (24m × R$697,50)", () => {
    fillAndSubmitRegistration();
    cy.get('[data-testid="plano-24-meses"]', { timeout: 15000 }).click();
    // 24 × R$697,50 = R$16.740,00
    cy.get('[data-testid="resumo-total-contrato"]').should("contain", "16.740,00");
  });
});
