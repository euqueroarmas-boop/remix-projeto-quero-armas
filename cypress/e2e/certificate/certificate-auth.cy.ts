/// <reference types="cypress" />

describe("Certificado Digital — Autenticação Admin", () => {
  it("faz login admin e valida estado autenticado", () => {
    cy.visit("/admin", {
      onBeforeLoad(win) {
        win.sessionStorage.clear();
      },
    });

    cy.log("ADMIN_LOGIN_STARTED");
    cy.get("[data-testid='admin-login-page']", { timeout: 20000 }).should("be.visible");
    cy.get("[data-testid='admin-login-password']", { timeout: 20000 })
      .should("be.visible")
      .clear()
      .type(String(Cypress.env("ADMIN_PASSWORD")), { log: false });
    cy.get("[data-testid='admin-login-submit']").click();

    cy.location("pathname", { timeout: 20000 }).should("eq", "/admin");
    cy.get("[data-testid='admin-topbar']", { timeout: 20000 }).should("be.visible");
    cy.window().then((win) => {
      const token = win.sessionStorage.getItem("admin_token");
      expect(token, "admin token").to.match(/^\d+\.[a-f0-9]+$/);
    });
    cy.log("ADMIN_LOGIN_SUCCESS");
    cy.log("ADMIN_SESSION_CONFIRMED");

    cy.get("[data-testid='admin-nav-digital-signature']", { timeout: 20000 }).click();
    cy.get("[data-testid='certificate-module-page']", { timeout: 20000 }).should("be.visible");
    cy.log("CERT_MODULE_OPENED");
  });

  it("sessão expirada redireciona para login", () => {
    cy.visit("/admin", {
      onBeforeLoad(win) {
        win.sessionStorage.setItem("admin_token", "0.invalidsignature");
      },
    });

    cy.location("pathname", { timeout: 20000 }).should("eq", "/admin");
    cy.get("[data-testid='admin-login-page']", { timeout: 20000 }).should("be.visible");
    cy.get("[data-testid='admin-topbar']").should("not.exist");
  });
});
