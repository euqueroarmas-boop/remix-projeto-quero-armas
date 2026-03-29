/// <reference types="cypress" />

describe("Smoke — Blog", () => {
  beforeEach(() => {
    cy.visit("/blog");
  });

  it("carrega sem erro", () => {
    cy.get("body").should("be.visible");
    cy.title().should("not.be.empty");
  });

  it("exibe heading principal", () => {
    cy.get("h1").should("be.visible");
  });

  it("exibe pelo menos um artigo", () => {
    cy.get("article, [class*='card'], a[href*='/blog/']").should("have.length.greaterThan", 0);
  });

  it("exibe navbar e footer", () => {
    cy.get("nav").should("be.visible");
    cy.get("footer").should("be.visible");
  });
});
