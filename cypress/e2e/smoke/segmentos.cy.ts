/// <reference types="cypress" />

const segmentoPages = [
  { path: "/ti-para-cartorios", name: "TI para Cartórios" },
  { path: "/ti-para-serventias-cartoriais", name: "TI para Serventias Cartoriais" },
  { path: "/ti-para-industrias-alimenticias", name: "TI para Indústrias Alimentícias" },
  { path: "/ti-para-industrias-petroliferas", name: "TI para Indústrias Petrolíferas" },
  { path: "/ti-para-escritorios-de-advocacia", name: "TI para Escritórios de Advocacia" },
  { path: "/ti-para-contabilidades", name: "TI para Contabilidades" },
  { path: "/ti-para-escritorios-corporativos", name: "TI para Escritórios Corporativos" },
  { path: "/ti-para-hospitais-e-clinicas", name: "TI para Hospitais e Clínicas" },
  { path: "/cartorios/provimento-213", name: "Provimento 213" },
];

describe("Smoke — Páginas de Segmento", () => {
  segmentoPages.forEach(({ path, name }) => {
    it(`${name} carrega corretamente`, () => {
      cy.visit(path, { timeout: 15000 });
      cy.get("body").should("be.visible");
      cy.get("h1", { timeout: 10000 }).should("be.visible");
      cy.get("nav").should("be.visible");
      cy.get("footer").should("be.visible");
    });
  });
});
