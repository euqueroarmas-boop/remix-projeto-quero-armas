/// <reference types="cypress" />

describe("Formulário de Contratação — Cadastro", () => {
  beforeEach(() => {
    cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=2");
    cy.get("#contracting-wizard", { timeout: 10000 }).should("be.visible");
  });

  it("exibe o formulário de cadastro como primeira etapa", () => {
    cy.contains("Dados do Contratante").should("be.visible");
    cy.get('[data-testid="campo-cnpj"]').should("be.visible");
  });

  it("valida campos obrigatórios ao submeter vazio", () => {
    cy.get('[data-testid="botao-prosseguir-cadastro"]').click();
    cy.get('[role="status"], [data-sonner-toast], .text-destructive', { timeout: 5000 })
      .should("exist");
  });

  it("preenche todos os campos do formulário corretamente", () => {
    cy.fixture("clientes.json").then((data) => {
      const c = data.empresa_padrao;
      cy.intercept("**/brasil-api-lookup*").as("brasilApiLookup");

      cy.get('[data-testid="campo-cnpj"]').clear().type(c.cnpj, { delay: 10 });
      cy.wait("@brasilApiLookup", { timeout: 15000 });

      cy.get('[data-testid="campo-razao-social"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.razaoSocial);
      });
      cy.get('[data-testid="campo-representante-nome"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.responsavelNome);
      });
      cy.get('[data-testid="campo-representante-cpf"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.responsavelCpf);
      });
      cy.get('[data-testid="campo-representante-email"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.responsavelEmail);
      });
      cy.get('[data-testid="campo-representante-telefone"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.responsavelTelefone);
      });
      cy.get('[data-testid="campo-cep"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.cep);
      });

      cy.wait(500);

      cy.get('[data-testid="campo-logradouro"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type(c.logradouro);
      });
      cy.get('[data-testid="campo-bairro"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type(c.bairro);
      });

      cy.get('[data-testid="campo-numero"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type(c.numero);
      });
      cy.get('[data-testid="campo-cidade"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type(c.cidade);
      });
      cy.get('[data-testid="campo-uf"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type(c.uf);
      });

      // Verify fields are filled
      cy.get('[data-testid="campo-cnpj"]').should("not.have.value", "");
      cy.get('[data-testid="campo-representante-nome"]').should("not.have.value", "");
      cy.get('[data-testid="campo-representante-email"]').should("not.have.value", "");
    });
  });

  it("formulário aceita dados de pessoa jurídica grande", () => {
    cy.fixture("clientes.json").then((data) => {
      cy.get('[data-testid="campo-cnpj"]').clear().type(data.empresa_grande.cnpj, { delay: 10 });
      cy.wait(500);
      cy.get('[data-testid="campo-cnpj"]').should("not.have.value", "");
    });
  });
});
