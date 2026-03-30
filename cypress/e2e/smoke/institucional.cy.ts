/// <reference types="cypress" />

const institucionalPages = [
  { path: "/institucional", name: "Institucional" },
  { path: "/servicos", name: "Serviços" },
  { path: "/infraestrutura", name: "Infraestrutura" },
  { path: "/locacao", name: "Locação" },
  { path: "/cartorios", name: "Cartórios" },
];

describe("Smoke — Páginas Institucionais", () => {
  institucionalPages.forEach(({ path, name }) => {
    it(`${name} carrega corretamente`, () => {
      cy.visit(path, { timeout: 15000 });
      cy.get("body").should("be.visible");
      cy.get("h1, h2", { timeout: 10000 }).should("be.visible");
      cy.get("nav").should("be.visible");
      cy.get("footer").should("be.visible");
    });
  });
});
