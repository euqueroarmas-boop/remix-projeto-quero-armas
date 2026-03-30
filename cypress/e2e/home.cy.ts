/// <reference types="cypress" />

describe("Home — Smoke Test", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("carrega a página inicial sem erros", () => {
    cy.get("body").should("be.visible");
    cy.title().should("not.be.empty");
  });

  it("exibe a navbar com logo", () => {
    cy.get("nav").should("be.visible");
  });

  it("exibe a seção hero", () => {
    cy.get("h1", { timeout: 10000 }).should("be.visible");
    cy.get("section").first().should(($section) => {
      expect($section[0].getBoundingClientRect().height).to.be.greaterThan(100);
    });
  });

  it("exibe o footer", () => {
    cy.get("footer").should("be.visible");
  });

  it("navegação para Administração de Servidores funciona", () => {
    cy.visit("/administracao-de-servidores");
    cy.url().should("include", "/administracao-de-servidores");
    cy.get("h1").should("be.visible");
  });
});
