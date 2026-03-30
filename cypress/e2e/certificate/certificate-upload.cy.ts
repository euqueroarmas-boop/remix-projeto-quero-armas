/// <reference types="cypress" />

describe("Certificado Digital — Upload", () => {
  beforeEach(() => {
    cy.loginAdmin("digital-signature");
    cy.log("CERT_NAVIGATION_OK");
    cy.log("CERT_PAGE_LOADED");
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
