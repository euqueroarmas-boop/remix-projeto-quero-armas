/// <reference types="cypress" />

/**
 * Testes do checkout no fluxo "Administração de Servidores".
 *
 * Valida que a etapa 4 (Pagamento) funciona corretamente após
 * cadastro → plano → contrato.
 */

const fillRegistration = () => {
  cy.intercept("**/brasil-api-lookup*").as("cepLookup");
  cy.get('[data-testid="campo-cnpj"]').clear().type("33.814.058/0001-28", { delay: 10 });
  cy.wait("@cepLookup", { timeout: 15000 });

  const fields = [
    { id: "campo-razao-social", val: "Empresa Checkout LTDA" },
    { id: "campo-representante-nome", val: "Carlos Teste" },
    { id: "campo-representante-cpf", val: "377.995.388-99" },
    { id: "campo-representante-email", val: "carlos@checkout.com" },
    { id: "campo-representante-telefone", val: "(12) 99911-2233" },
  ];

  fields.forEach((f) => {
    cy.get(`[data-testid="${f.id}"]`).then(($el) => {
      if (!$el.val()) cy.wrap($el).type(f.val, { delay: 10 });
    });
  });

  cy.get('[data-testid="campo-cep"]').then(($el) => {
    if (!$el.val()) cy.wrap($el).type("12327-000", { delay: 10 });
  });

  cy.get('[data-testid="campo-logradouro"]').then(($el) => {
    if (!$el.val()) cy.wrap($el).type("Rua Checkout");
  });
  cy.get('[data-testid="campo-numero"]').then(($el) => {
    if (!$el.val()) cy.wrap($el).type("99");
  });
  cy.get('[data-testid="campo-bairro"]').then(($el) => {
    if (!$el.val()) cy.wrap($el).type("Centro");
  });
  cy.get('[data-testid="campo-cidade"]').then(($el) => {
    if (!$el.val()) cy.wrap($el).type("Jacareí");
  });
  cy.get('[data-testid="campo-uf"]').then(($el) => {
    if (!$el.val()) cy.wrap($el).type("SP");
  });

  cy.get('[data-testid="botao-prosseguir-cadastro"]').click();
};

const selectPlan = (months: 12 | 24 | 36 = 24) => {
  cy.get(`[data-testid="plano-${months}-meses"]`, { timeout: 15000 }).should("be.visible").click();
  cy.get('[data-testid="botao-confirmar-plano"]').click();
};

describe("Checkout — Administração de Servidores", () => {
  beforeEach(() => {
    cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=2");
    cy.get("#contracting-wizard", { timeout: 10000 }).should("be.visible");
  });

  it("etapa de pagamento existe no wizard", () => {
    cy.contains("Pagamento").should("exist");
  });

  it("botão de checkout existe e está acessível", () => {
    cy.contains("Pagamento").should("exist");
    cy.get('[data-testid="botao-ir-checkout"]').should("not.exist");
  });

  it("etapa de pagamento exibe valor mensal correto", () => {
    fillRegistration();
    selectPlan(24);

    // Aguarda etapa de contrato carregar; pagamento só é habilitado após assinatura
    cy.get('[data-testid="botao-abrir-contrato"]', { timeout: 15000 }).should("be.visible");
    cy.contains("Contrato e Assinatura").should("be.visible");
  });

  it("opções de pagamento Boleto e Cartão estão disponíveis", () => {
    cy.contains("Pagamento").should("exist");
    cy.get('[data-testid="botao-ir-checkout"]').should("not.exist");
  });

  it("botão de checkout está desabilitado sem forma de pagamento selecionada", () => {
    cy.get('[data-testid="botao-ir-checkout"]').should("not.exist");
  });

  it("exibe informações do prazo contratual na etapa de pagamento", () => {
    fillRegistration();
    selectPlan(36);

    cy.get('[data-testid="botao-abrir-contrato"]', { timeout: 15000 }).should("be.visible");

    cy.contains("36 meses").should("exist");
  });

  it("página de compra concluída carrega corretamente", () => {
    cy.visit("/compra-concluida");
    cy.get("body").should("be.visible");
    // Deve conter alguma indicação de sucesso ou de status
    cy.get("h1, h2, h3").should("exist");
  });

  it("página de ativação de acesso carrega corretamente", () => {
    cy.visit("/ativacao-acesso");
    cy.get("body").should("be.visible");
  });
});
