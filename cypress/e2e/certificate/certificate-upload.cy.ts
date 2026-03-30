/// <reference types="cypress" />

describe("Certificado Digital — Upload", () => {
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

  it("exibe seção de upload com campos obrigatórios", () => {
    cy.get("[data-testid='certificate-upload-input']").should("exist");
    cy.get("[data-testid='certificate-password-input']").should("exist");
    cy.get("[data-testid='certificate-upload-button']").should("exist");
  });

  it("botão de upload desabilitado sem arquivo e senha", () => {
    cy.get("[data-testid='certificate-upload-button']").should("be.disabled");
  });

  it("mensagem de segurança sobre senha está visível", () => {
    cy.contains(/criptografada|segura|frontend/i, { timeout: 10000 }).should("exist");
  });
});
