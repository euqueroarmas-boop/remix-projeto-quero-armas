/// <reference types="cypress" />

describe("Certificado Digital — Assinatura", () => {
  beforeEach(() => {
    cy.loginAdmin("digital-signature");
    cy.log("CERT_NAVIGATION_OK");
    cy.log("CERT_PAGE_LOADED");
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
