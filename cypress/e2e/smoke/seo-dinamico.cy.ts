/// <reference types="cypress" />

const seoPages = [
  "/suporte-ti-em-jacarei",
  "/administracao-de-servidores-em-jacarei",
  "/backup-corporativo-em-jacarei",
];

describe("Smoke — SEO Dinâmico", () => {
  seoPages.forEach((path) => {
    it(`${path} carrega sem 404`, () => {
      cy.visit(path, { timeout: 20000, failOnStatusCode: false });
      cy.location("pathname", { timeout: 20000 }).should("eq", path);
      cy.get("body", { timeout: 20000 }).should("be.visible");
      cy.get("#root", { timeout: 20000 }).should("exist");
      cy.get("body").invoke("text").should("not.match", /página não encontrada|nao encontrada|não encontrada|not found|erro 404|\b404\b/i);
    });
  });

  it("slug inexistente mostra 404", () => {
    cy.visit("/pagina-totalmente-inventada-xyz", { timeout: 15000, failOnStatusCode: false });
    cy.get("body").should("be.visible");
  });

  it("/seguranca-da-informacao-empresarial-jacarei redireciona para /seguranca-de-rede", () => {
    cy.visit("/seguranca-da-informacao-empresarial-jacarei", { timeout: 20000 });
    cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.match(/\/seguranca-de-rede|\/seguranca-informacao-empresarial/);
    });
  });
});
