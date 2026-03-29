/// <reference types="cypress" />

describe("Checkout — Fluxo Completo", () => {
  beforeEach(() => {
    cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=0");
    cy.get("#contracting-wizard", { timeout: 10000 }).should("be.visible");
  });

  const completeRegistration = () => {
    cy.get('[data-testid="campo-cnpj"]').clear().type("12345678000190", { delay: 10 });
    cy.wait(1000);

    const fields = [
      { testid: "campo-razao-social", val: "Empresa Teste LTDA" },
      { testid: "campo-representante-nome", val: "João da Silva" },
      { testid: "campo-representante-cpf", val: "37799538899" },
      { testid: "campo-representante-email", val: "joao@teste.com" },
      { testid: "campo-representante-telefone", val: "12998765432" },
      { testid: "campo-cep", val: "12327000" },
    ];
    fields.forEach((f) => {
      cy.get(`[data-testid="${f.testid}"]`).then(($el) => {
        if (!$el.val()) cy.wrap($el).type(f.val, { delay: 10 });
      });
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

  const selectPlan = () => {
    cy.get('[data-testid="plano-24-meses"]', { timeout: 15000 }).should("be.visible").click();
    cy.get('[data-testid="botao-confirmar-plano"]').click();
  };

  it("wizard exibe todas as 4 etapas", () => {
    cy.contains("Dados do Contratante").should("be.visible");
    cy.contains("Configuração do Plano").should("be.visible");
    cy.contains("Contrato e Assinatura").should("be.visible");
    cy.contains("Pagamento").should("be.visible");
  });

  it("fluxo avança: cadastro → plano → contrato", () => {
    completeRegistration();
    selectPlan();
    cy.get('[data-testid="botao-abrir-contrato"]', { timeout: 15000 }).should("be.visible");
  });

  it("botão de checkout existe na etapa de pagamento", () => {
    cy.contains("Pagamento").should("exist");
    cy.get('[data-testid="botao-ir-checkout"]').should("exist");
  });

  it("página de compra concluída existe", () => {
    cy.visit("/compra-concluida");
    cy.get("body").should("be.visible");
  });

  it("página de ativação de acesso existe", () => {
    cy.visit("/ativacao-acesso");
    cy.get("body").should("be.visible");
  });

  it("página de redefinição de senha existe", () => {
    cy.visit("/redefinir-senha");
    cy.get("body").should("be.visible");
  });

  it("área do cliente existe e exige login", () => {
    cy.visit("/area-do-cliente");
    cy.get("body").should("be.visible");
    cy.get('input[type="email"], input[type="password"]', { timeout: 10000 }).should("exist");
  });
});
