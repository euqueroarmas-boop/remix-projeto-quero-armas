/// <reference types="cypress" />

describe("Certificado Digital — Assinatura", () => {
  beforeEach(() => {
    cy.visit("/admin");
    cy.get("input[type='password']", { timeout: 15000 }).should("be.visible");
    cy.get("input[type='password']").type(Cypress.env("ADMIN_PASSWORD") || "admin");
    cy.contains("button", /entrar|login|acessar/i).click();
    cy.get("[data-testid='admin-sidebar'], [data-testid='admin-content']", { timeout: 15000 })
      .should("exist");

    // Navigate to digital signature module
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      }
    });
    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();
    cy.get("[data-testid='certificate-module-page']", { timeout: 15000 }).should("exist");
  });

  it("exibe cards de status: Certificado, Validade, Assinaturas", () => {
    cy.contains(/Certificado/i, { timeout: 15000 }).should("exist");
    cy.contains(/Validade/i).should("exist");
    cy.contains(/Assinaturas/i).should("exist");
  });

  it("exibe seção de Logs de Assinatura", () => {
    cy.contains(/Logs de Assinatura/i, { timeout: 15000 }).should("exist");
    cy.contains("button", /Atualizar/i).should("exist");
  });

  it("botão testar certificado existe quando certificado ativo", () => {
    cy.get("[data-testid='certificate-test-sign-button']").should("exist");
  });
});
