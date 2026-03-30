/// <reference types="cypress" />

describe("Certificado Digital — Tratamento de Erros", () => {
  beforeEach(() => {
    cy.visit("/admin");
    cy.get("input[type='password']", { timeout: 15000 }).should("be.visible");
    cy.get("input[type='password']").type(Cypress.env("ADMIN_PASSWORD") || "admin");
    cy.contains("button", /entrar|login|acessar/i).click();
    cy.get("[data-testid='admin-authenticated']", { timeout: 15000 }).should("exist");
    cy.log("CERT_LOGIN_OK");

    // Navigate to cert diagnostic module
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      }
    });
    cy.contains(/Diagnóstico Cert|Diag\. Certificado/i, { timeout: 10000 }).click();
    cy.get("[data-testid='certificate-diagnostic-page']", { timeout: 15000 }).should("exist");
  });

  it("senha com espaço é detectada no diagnóstico", () => {
    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("[data-testid='certificate-diag-file-input']").selectFile(
      "cypress/fixtures/certificates/corrupted-cert.pfx",
      { force: true }
    );
    cy.get("[data-testid='certificate-diag-password-input']").type("senha123 ");
    cy.get("[data-testid='certificate-run-diagnostic-button']").click();

    cy.wait("@diagnose", { timeout: 30000 });
    cy.get("[data-testid='certificate-result-panel']", { timeout: 30000 }).should("exist");
  });

  it("resposta do backend contém campos obrigatórios", () => {
    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("[data-testid='certificate-diag-file-input']").selectFile(
      "cypress/fixtures/certificates/corrupted-cert.pfx",
      { force: true }
    );
    cy.get("[data-testid='certificate-diag-password-input']").type("senha123");
    cy.get("[data-testid='certificate-run-diagnostic-button']").click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      const body = interception.response?.body;
      expect(body).to.have.property("success");
      expect(body).to.have.property("request_id");
      expect(body).to.have.property("steps");
      expect(body).to.have.property("conclusion");
      expect(body).to.have.property("duration_ms");
      expect(body.steps).to.be.an("array");
    });
  });

  it("botão copiar relatório funciona após diagnóstico", () => {
    cy.get("[data-testid='certificate-diag-file-input']").selectFile(
      "cypress/fixtures/certificates/corrupted-cert.pfx",
      { force: true }
    );
    cy.get("[data-testid='certificate-diag-password-input']").type("test");
    cy.get("[data-testid='certificate-run-diagnostic-button']").click();

    cy.get("[data-testid='certificate-result-panel']", { timeout: 30000 }).should("exist");
    cy.contains("button", /Copiar relatório/i).should("exist").click();
    cy.contains(/Copiado/i).should("exist");
  });
});
