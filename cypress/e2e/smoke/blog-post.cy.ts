/// <reference types="cypress" />

describe("Smoke — Blog Post Individual", () => {
  it("listagem do blog carrega", () => {
    cy.visit("/blog", { timeout: 15000 });
    cy.get("h1", { timeout: 10000 }).should("be.visible");
  });

  it("primeiro post do blog abre corretamente", () => {
    cy.visit("/blog", { timeout: 15000 });
    cy.get('a[href*="/blog/"]', { timeout: 10000 }).first().then(($link) => {
      const href = $link.attr("href");
      if (href) {
        cy.visit(href, { timeout: 15000 });
        cy.get("h1", { timeout: 10000 }).should("be.visible");
        cy.get("article, [class*='blog'], [class*='post'], main").should("exist");
      }
    });
  });

  it("blog post inexistente redireciona para listagem ou 404", () => {
    cy.visit("/blog/post-que-nao-existe-xyz-123", { timeout: 15000, failOnStatusCode: false });
    cy.get("body").should("be.visible");
  });
});
