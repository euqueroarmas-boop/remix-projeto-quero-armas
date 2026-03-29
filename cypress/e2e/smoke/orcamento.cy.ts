/// <reference types="cypress" />

describe("Smoke — Orçamento / Contato", () => {
  it("página de orçamento carrega", () => {
    cy.visit("/orcamento-ti");
    cy.get("body").should("be.visible");
    cy.get("h1").should("be.visible");
  });

  it("formulário de contato existe", () => {
    cy.visit("/orcamento-ti");
    cy.get('input[type="email"]').should("exist");
    cy.get("button[type='submit'], button").contains(/enviar|solicitar|contato/i).should("exist");
  });

  it("campo de interesse existe", () => {
    cy.visit("/orcamento-ti");
    cy.get("select, [role='combobox'], input[name*='interest'], input[name*='interesse']").should("exist");
  });

  it("navbar e footer visíveis", () => {
    cy.visit("/orcamento-ti");
    cy.get("nav").should("be.visible");
    cy.get("footer").should("be.visible");
  });
});
