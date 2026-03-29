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
  const BASE = 750; // 1 host + 2 VMs

  beforeEach(() => {
    // Go to the contracting page with predefined params
    cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=2");
    cy.get("#contracting-wizard").should("be.visible");
  });

  /**
   * Helper: fill the server admin registration form with fixture data
   * and submit to advance to the plan config step.
   */
  const fillAndSubmitRegistration = () => {
    cy.fixture("clientes.json").then((clientes) => {
      const c = clientes.empresa_padrao;

      // Fill CNPJ field
      cy.get("#contracting-wizard").within(() => {
        // CNPJ
        cy.get('input[placeholder*="CNPJ"]').first().clear().type("12345678000190", { delay: 10 });

        // Wait for potential auto-fill, then fill remaining fields
        cy.wait(1000);

        // Razão Social (may be auto-filled)
        cy.get('input').then(($inputs) => {
          // Fill fields that are empty
          const fields = [
            { placeholder: "Razão Social", value: c.razaoSocial },
            { placeholder: "Nome Fantasia", value: c.nomeFantasia },
            { placeholder: "Nome completo", value: c.responsavel },
            { placeholder: "CPF", value: "37799538899" },
            { placeholder: "E-mail do responsável", value: c.email },
            { placeholder: "Telefone do responsável", value: c.telefone },
            { placeholder: "CEP", value: "12327000" },
          ];

          fields.forEach((f) => {
            cy.get(`input[placeholder*="${f.placeholder}"]`).then(($el) => {
              if ($el.length > 0 && !$el.val()) {
                cy.wrap($el).clear().type(f.value, { delay: 10 });
              }
            });
          });
        });

        cy.wait(500);

        // Fill address fields that may not be auto-filled
        cy.get('input[placeholder*="Logradouro"], input[placeholder*="logradouro"]').then(($el) => {
          if ($el.length > 0 && !$el.val()) {
            cy.wrap($el).clear().type("Rua das Flores", { delay: 10 });
          }
        });
        cy.get('input[placeholder*="Número"], input[placeholder*="número"]').then(($el) => {
          if ($el.length > 0 && !$el.val()) {
            cy.wrap($el).clear().type("100", { delay: 10 });
          }
        });
        cy.get('input[placeholder*="Cidade"], input[placeholder*="cidade"]').then(($el) => {
          if ($el.length > 0 && !$el.val()) {
            cy.wrap($el).clear().type("Jacareí", { delay: 10 });
          }
        });
        cy.get('input[placeholder*="UF"], input[placeholder*="uf"], input[placeholder*="Estado"]').then(($el) => {
          if ($el.length > 0 && !$el.val()) {
            cy.wrap($el).clear().type("SP", { delay: 10 });
          }
        });

        // Submit the registration form
        cy.contains("button", /prosseguir|confirmar|enviar|cadastrar|avançar/i).click();
      });
    });
  };

  it("exibe a etapa de Configuração do Plano após cadastro", () => {
    fillAndSubmitRegistration();
    cy.contains("Configuração do Plano", { timeout: 15000 }).should("be.visible");
    cy.contains("12").should("be.visible");
    cy.contains("24").should("be.visible");
    cy.contains("36").should("be.visible");
  });

  it("12 meses → sem desconto", () => {
    fillAndSubmitRegistration();
    cy.contains("Configuração do Plano", { timeout: 15000 }).should("be.visible");

    // Select 12 months
    cy.contains("button", "12").click();

    // 12m = 0% discount, so base value R$750.00
    cy.contains("750,00").should("be.visible");
  });

  it("24 meses → 7% de desconto", () => {
    fillAndSubmitRegistration();
    cy.contains("Configuração do Plano", { timeout: 15000 }).should("be.visible");

    // Select 24 months
    cy.contains("button", "24").click();

    // 24m = 7% discount: R$750 × 0.93 = R$697.50
    cy.contains("697,50").should("be.visible");
    cy.contains("7%").should("be.visible");
  });

  it("36 meses → 12% de desconto", () => {
    fillAndSubmitRegistration();
    cy.contains("Configuração do Plano", { timeout: 15000 }).should("be.visible");

    // Select 36 months
    cy.contains("button", "36").click();

    // 36m = 12% discount: R$750 × 0.88 = R$660.00
    cy.contains("660,00").should("be.visible");
    cy.contains("12%").should("be.visible");
  });

  it("Suporte 24h adiciona 35% sobre subtotal com desconto", () => {
    fillAndSubmitRegistration();
    cy.contains("Configuração do Plano", { timeout: 15000 }).should("be.visible");

    // Select 24 months first
    cy.contains("button", "24").click();
    cy.contains("697,50").should("be.visible");

    // Toggle 24h support
    cy.contains("Suporte 24h").should("be.visible");
    cy.get('[role="switch"]').click();

    // 24m + 24h = R$697.50 × 1.35 = R$941.63 (rounded)
    cy.contains("941,6").should("be.visible");
  });
});
