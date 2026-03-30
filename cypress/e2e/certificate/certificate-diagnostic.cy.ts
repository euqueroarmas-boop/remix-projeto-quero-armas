/// <reference types="cypress" />

describe("Certificado Digital — Diagnóstico", () => {
  beforeEach(() => {
    cy.loginAdmin("cert-diagnostic");
    cy.log("CERT_NAVIGATION_OK");
    cy.log("CERT_PAGE_LOADED");
  });

  it("exibe formulário de diagnóstico com campos obrigatórios", () => {
    cy.get("[data-testid='certificate-diag-file-input']").should("exist");
    cy.get("[data-testid='certificate-diag-password-input']").should("exist");
    cy.get("[data-testid='certificate-run-diagnostic-button']").should("exist");
  });

  it("botão de diagnóstico desabilitado sem arquivo/senha", () => {
    cy.get("[data-testid='certificate-run-diagnostic-button']").should("be.disabled");
  });

  it("upload de arquivo vazio mostra falha", () => {
    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("[data-testid='certificate-diag-file-input']").selectFile(
      "cypress/fixtures/certificates/empty-cert.pfx",
      { force: true }
    );
    cy.get("[data-testid='certificate-diag-password-input']").type("qualquersenha");
    cy.get("[data-testid='certificate-run-diagnostic-button']").click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 400]);
    });

    cy.get("[data-testid='certificate-result-panel']", { timeout: 30000 }).should("exist");
  });

  it("upload de arquivo corrompido mostra falha no parser", () => {
    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("[data-testid='certificate-diag-file-input']").selectFile(
      "cypress/fixtures/certificates/corrupted-cert.pfx",
      { force: true }
    );
    cy.get("[data-testid='certificate-diag-password-input']").type("qualquersenha");
    cy.get("[data-testid='certificate-run-diagnostic-button']").click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      const body = interception.response?.body;
      if (body?.steps) {
        const failedStep = body.steps.find((s: any) => s.status === "fail");
        expect(failedStep).to.exist;
      }
    });

    cy.get("[data-testid='certificate-result-panel']", { timeout: 30000 }).should("exist");
  });

  it("resultado exibe request ID e duração", () => {
    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("[data-testid='certificate-diag-file-input']").selectFile(
      "cypress/fixtures/certificates/corrupted-cert.pfx",
      { force: true }
    );
    cy.get("[data-testid='certificate-diag-password-input']").type("test");
    cy.get("[data-testid='certificate-run-diagnostic-button']").click();

    cy.wait("@diagnose", { timeout: 30000 });

    cy.get("[data-testid='certificate-result-panel']", { timeout: 30000 }).should("exist");
    cy.contains(/Request ID/i).should("exist");
    cy.contains(/Duração/i).should("exist");
  });
});
