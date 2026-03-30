/// <reference types="cypress" />

describe("Certificado Digital — Navegação", () => {
  beforeEach(() => {
    cy.loginAdmin();
  });

  it("navega até Assinatura Digital pelo menu", () => {
    cy.get("[data-testid='admin-nav-digital-signature']", { timeout: 20000 }).click();
    cy.location("pathname", { timeout: 20000 }).should("eq", "/admin");
    cy.get("[data-testid='certificate-module-page']", { timeout: 20000 }).should("be.visible");
    cy.log("CERT_NAVIGATION_OK");
    cy.log("CERT_PAGE_LOADED");
    cy.log("CERT_MODULE_OPENED");
  });

  it("navega até Diagnóstico de Certificado pelo menu", () => {
    cy.get("[data-testid='admin-nav-cert-diagnostic']", { timeout: 20000 }).click();
    cy.location("pathname", { timeout: 20000 }).should("eq", "/admin");
    cy.get("[data-testid='certificate-diagnostic-page']", { timeout: 20000 }).should("be.visible");
    cy.log("CERT_NAVIGATION_OK");
    cy.log("CERT_PAGE_LOADED");
    cy.log("CERT_MODULE_OPENED");
  });
});
