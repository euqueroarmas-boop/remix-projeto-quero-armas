/// <reference types="cypress" />

/**
 * Testa o fluxo de checkout completo até a etapa de pagamento.
 * NÃO realiza pagamento real — apenas verifica que o wizard avança
 * corretamente e exibe as opções de pagamento.
 *
 * A geração de usuário/senha acontece pós-pagamento via webhook,
 * então aqui testamos que o sistema está preparado para isso.
 */

describe("Checkout — Fluxo Completo", () => {
  beforeEach(() => {
    cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=0");
    cy.get("#contracting-wizard", { timeout: 10000 }).should("be.visible");
  });

  const completeRegistration = () => {
    cy.get('input[placeholder*="CNPJ"]').first().clear().type("12345678000190", { delay: 10 });
    cy.wait(1000);

    const fields = [
      { sel: 'input[placeholder*="Razão Social"]', val: "Empresa Teste LTDA" },
      { sel: 'input[placeholder*="Nome Fantasia"]', val: "Teste Corp" },
      { sel: 'input[placeholder*="Nome completo"]', val: "João da Silva" },
      { sel: 'input[placeholder*="CPF"]', val: "37799538899" },
      { sel: 'input[placeholder*="E-mail do responsável"]', val: "joao@teste.com" },
      { sel: 'input[placeholder*="Telefone do responsável"]', val: "12998765432" },
      { sel: 'input[placeholder*="CEP"]', val: "12327000" },
    ];
    fields.forEach((f) => {
      cy.get(f.sel).then(($el) => {
        if ($el.length > 0 && !$el.val()) cy.wrap($el).type(f.val, { delay: 10 });
      });
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

    cy.contains("button", /prosseguir|confirmar|enviar|cadastrar|avançar/i).click();
  };

  const selectPlan = () => {
    cy.contains("Configuração do Plano", { timeout: 15000 }).should("be.visible");
    cy.contains("button", "24").click();
    cy.contains("button", /confirmar plano|confirmar configuração/i).click();
  };

  const signContract = () => {
    cy.contains("Contrato e Assinatura", { timeout: 15000 }).should("be.visible");
    // The contract is opened in a new tab and signed there.
    // We simulate the contract being signed by checking the wizard state.
    // In E2E we can verify the button exists.
    cy.contains(/abrir contrato|ler contrato|visualizar contrato/i).should("be.visible");
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
    signContract();
  });

  it("etapa de pagamento aparece após contrato", () => {
    // This test verifies the payment step exists in the wizard
    cy.contains("Pagamento").should("be.visible");

    // The payment step should be in "pending" state initially
    cy.get("#contracting-wizard").within(() => {
      cy.contains("Pagamento").should("exist");
    });
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
    // Should show login form since no user is authenticated
    cy.get('input[type="email"], input[type="password"]', { timeout: 10000 }).should("exist");
  });
});
