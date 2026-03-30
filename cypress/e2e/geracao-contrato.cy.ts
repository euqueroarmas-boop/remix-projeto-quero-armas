/// <reference types="cypress" />

describe("Geração de Contrato", () => {
  beforeEach(() => {
    cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=0");
    cy.get("#contracting-wizard", { timeout: 10000 }).should("be.visible");
  });

  const completeRegistration = () => {
    cy.intercept("**/brasil-api-lookup*").as("cepLookup");
    cy.get('[data-testid="campo-cnpj"]').clear().type("33.814.058/0001-28", { delay: 10 });
    cy.wait("@cepLookup", { timeout: 15000 });

    const fields = [
      { testid: "campo-razao-social", val: "Empresa Teste LTDA" },
      { testid: "campo-representante-nome", val: "João da Silva" },
      { testid: "campo-representante-cpf", val: "377.995.388-99" },
      { testid: "campo-representante-email", val: "joao@teste.com" },
      { testid: "campo-representante-telefone", val: "(12) 99876-5432" },
    ];
    fields.forEach((f) => {
      cy.get(`[data-testid="${f.testid}"]`).then(($el) => {
        if (!$el.val()) cy.wrap($el).type(f.val, { delay: 10 });
      });
    });

    cy.get('[data-testid="campo-cep"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("12327-000", { delay: 10 });
    });

    cy.get('[data-testid="campo-logradouro"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("Rua das Flores");
    });
    cy.get('[data-testid="campo-numero"]').then(($el) => {
      if (!$el.val()) cy.wrap($el).type("100");
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

  const selectPlan = () => {
    cy.get('[data-testid="plano-12-meses"]', { timeout: 15000 }).should("be.visible").click();
    cy.get('[data-testid="botao-confirmar-plano"]').click();
  };

  it("avança para etapa de contrato após configuração do plano", () => {
    completeRegistration();
    selectPlan();
    cy.contains("Contrato e Assinatura", { timeout: 15000 }).should("be.visible");
  });

  it("exibe botão para abrir contrato", () => {
    completeRegistration();
    selectPlan();
    cy.get('[data-testid="botao-abrir-contrato"]', { timeout: 15000 })
      .should("be.visible")
      .should("not.be.disabled");
  });
});
