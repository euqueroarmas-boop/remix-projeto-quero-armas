/// <reference types="cypress" />

describe("Smoke — Orçamento / Contato", () => {
  it("página de orçamento carrega", () => {
    cy.visit("/orcamento-ti", { timeout: 15000 });
    cy.get("body").should("be.visible");
    cy.get("h1", { timeout: 10000 }).should("be.visible");
  });

  it("formulário de contato existe", () => {
    cy.visit("/orcamento-ti", { timeout: 15000 });
    cy.get('input[type="email"]', { timeout: 10000 }).should("exist");
    cy.get('[data-testid="botao-solicitar-orcamento"], button[type="submit"]').should("exist");
  });

  it("campo de interesse existe", () => {
    cy.visit("/orcamento-ti", { timeout: 15000 });
    cy.get("select, [role='combobox'], input[name*='interest'], input[name*='interesse']", { timeout: 10000 }).should("exist");
  });

  it("navbar e footer visíveis", () => {
    cy.visit("/orcamento-ti", { timeout: 15000 });
    cy.get("nav").should("be.visible");
    cy.get("footer").should("be.visible");
  });
});
