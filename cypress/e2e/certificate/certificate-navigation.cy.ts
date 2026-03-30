/// <reference types="cypress" />

describe("Certificado Digital — Navegação", () => {
  beforeEach(() => {
    cy.visit("/admin");
    cy.get("input[type='password']", { timeout: 15000 }).should("be.visible");
    cy.get("input[type='password']").type(Cypress.env("ADMIN_PASSWORD") || "admin");
    cy.contains("button", /entrar|login|acessar/i).click();
    cy.get("[data-testid='admin-authenticated']", { timeout: 15000 }).should("exist");
    cy.log("CERT_LOGIN_OK");
  });

  it("navega até Assinatura Digital pelo menu", () => {
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      }
    });

    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();
    cy.get("[data-testid='certificate-module-page']", { timeout: 15000 }).should("exist");
  });

  it("navega até Diagnóstico de Certificado pelo menu", () => {
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      }
    });

    cy.contains(/Diagnóstico Cert|Diag\. Certificado/i, { timeout: 10000 }).click();
    cy.get("[data-testid='certificate-diagnostic-page']", { timeout: 15000 }).should("exist");
  });
});
