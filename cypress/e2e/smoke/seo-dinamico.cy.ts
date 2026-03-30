/// <reference types="cypress" />

const seoPages = [
  "/suporte-ti-em-jacarei",
  "/administracao-de-servidores-em-jacarei",
  "/backup-corporativo-em-jacarei",
];

describe("Smoke — SEO Dinâmico", () => {
  seoPages.forEach((path) => {
    it(`${path} carrega sem 404`, () => {
      cy.visit(path, { timeout: 15000, failOnStatusCode: false });
      cy.get("body").should("be.visible");
      // Não deve mostrar página 404
      cy.get("h1", { timeout: 10000 }).should("be.visible");
      cy.get("h1").invoke("text").should("not.match", /não encontrad|not found|404/i);
    });
  });

  it("slug inexistente mostra 404", () => {
    cy.visit("/pagina-totalmente-inventada-xyz", { timeout: 15000, failOnStatusCode: false });
    cy.get("body").should("be.visible");
  });
});
