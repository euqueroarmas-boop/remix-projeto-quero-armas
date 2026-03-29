/// <reference types="cypress" />

describe("Smoke — Home", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("carrega sem erro", () => {
    cy.get("body").should("be.visible");
    cy.title().should("not.be.empty");
  });

  it("exibe navbar", () => {
    cy.get("nav").should("be.visible");
  });

  it("exibe heading principal", () => {
    cy.get("h1").should("be.visible");
  });

  it("exibe footer", () => {
    cy.get("footer").should("be.visible");
  });

  it("possui link para orçamento", () => {
    cy.get('a[href*="orcamento"]').should("exist");
  });

  it("possui link para serviços", () => {
    cy.get('a[href*="suporte"], a[href*="servico"], a[href*="infraestrutura"]').should("exist");
  });
});
