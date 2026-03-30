/// <reference types="cypress" />

describe("Smoke — Área do Cliente", () => {
  it("página de login carrega", () => {
    cy.visit("/area-do-cliente", { timeout: 15000 });
    cy.get("body").should("be.visible");
  });

  it("exibe formulário de login", () => {
    cy.visit("/area-do-cliente", { timeout: 15000 });
    cy.get('input[type="email"], input[type="text"]', { timeout: 10000 }).should("exist");
    cy.get('input[type="password"]').should("exist");
  });

  it("botão de entrar está visível", () => {
    cy.visit("/area-do-cliente", { timeout: 15000 });
    cy.get('button[type="submit"]', { timeout: 10000 }).should("be.visible");
  });

  it("redirect /cliente leva para /area-do-cliente", () => {
    cy.visit("/cliente", { timeout: 15000 });
    cy.url().should("include", "/area-do-cliente");
  });
});
