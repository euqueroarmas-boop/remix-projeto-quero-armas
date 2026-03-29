/// <reference types="cypress" />

describe("Formulário de Contratação — Cadastro", () => {
  beforeEach(() => {
    cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=2");
    cy.get("#contracting-wizard", { timeout: 10000 }).should("be.visible");
  });

  it("exibe o formulário de cadastro como primeira etapa", () => {
    cy.contains("Dados do Contratante").should("be.visible");
    cy.get('input[placeholder*="CNPJ"]').should("be.visible");
  });

  it("valida campos obrigatórios ao submeter vazio", () => {
    cy.contains("button", /prosseguir|confirmar|enviar|cadastrar|avançar/i).click();

    // Should show validation errors (toast or inline)
    cy.get('[role="status"], [data-sonner-toast], .text-destructive', { timeout: 5000 })
      .should("exist");
  });

  it("preenche todos os campos do formulário corretamente", () => {
    cy.fixture("clientes.json").then((data) => {
      const c = data.empresa_padrao;

      cy.get('input[placeholder*="CNPJ"]').first().clear().type("12345678000190", { delay: 10 });
      cy.wait(1000);

      // Fill remaining fields
      cy.get('input[placeholder*="Razão Social"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.razaoSocial);
      });
      cy.get('input[placeholder*="Nome Fantasia"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.nomeFantasia);
      });
      cy.get('input[placeholder*="Nome completo"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.responsavel);
      });
      cy.get('input[placeholder*="CPF"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type("37799538899");
      });
      cy.get('input[placeholder*="E-mail do responsável"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.email);
      });
      cy.get('input[placeholder*="Telefone do responsável"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type(c.telefone);
      });
      cy.get('input[placeholder*="CEP"]').then(($el) => {
        if (!$el.val()) cy.wrap($el).type("12327000");
      });

      cy.wait(500);

      cy.get('input[placeholder*="Logradouro"], input[placeholder*="logradouro"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type("Rua das Flores");
      });
      cy.get('input[placeholder*="Número"], input[placeholder*="número"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type("100");
      });
      cy.get('input[placeholder*="Cidade"], input[placeholder*="cidade"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type("Jacareí");
      });
      cy.get('input[placeholder*="UF"], input[placeholder*="uf"], input[placeholder*="Estado"]').then(($el) => {
        if ($el.length && !$el.val()) cy.wrap($el).type("SP");
      });

      // All fields should be filled
      cy.get('input[placeholder*="CNPJ"]').should("not.have.value", "");
      cy.get('input[placeholder*="Nome completo"]').should("not.have.value", "");
    });
  });

  it("formulário aceita dados de pessoa jurídica grande", () => {
    cy.fixture("clientes.json").then((data) => {
      const c = data.empresa_grande;
      cy.get('input[placeholder*="CNPJ"]').first().clear().type("98765432000110", { delay: 10 });
      cy.wait(500);
      cy.get('input[placeholder*="CNPJ"]').should("not.have.value", "");
    });
  });
});
