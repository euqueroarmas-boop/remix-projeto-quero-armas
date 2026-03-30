/// <reference types="cypress" />

describe("Certificado Digital — Autenticação Admin", () => {
  it("faz login admin e valida estado autenticado", () => {
    cy.visit("/admin");
    cy.get("input[type='password']", { timeout: 15000 }).should("be.visible");
    cy.get("input[type='password']").type(Cypress.env("ADMIN_PASSWORD") || "admin");
    cy.contains("button", /entrar|login|acessar/i).click();

    // Valida que o admin está autenticado
    cy.get("[data-testid='admin-authenticated']", { timeout: 15000 }).should("exist");
    cy.log("CERT_LOGIN_OK");
  });

  it("sessão expirada redireciona para login", () => {
    // Simula sessão expirada com token inválido
    cy.window().then((win) => {
      win.localStorage.setItem("adminToken", "0.invalidsignature");
    });
    cy.visit("/admin");
    cy.get("input[type='password']", { timeout: 15000 }).should("be.visible");
  });
});
