/// <reference types="cypress" />

const viewports: Array<{ name: string; width: number; height: number }> = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPad", width: 768, height: 1024 },
  { name: "Desktop", width: 1280, height: 720 },
];

const criticalPages = [
  "/",
  "/orcamento-ti",
  "/blog",
  "/administracao-de-servidores",
  "/ti-para-cartorios",
];

describe("Smoke — Responsividade", () => {
  viewports.forEach(({ name, width, height }) => {
    describe(`Viewport: ${name} (${width}x${height})`, () => {
      beforeEach(() => {
        cy.viewport(width, height);
      });

      criticalPages.forEach((path) => {
        it(`${path} renderiza sem overflow horizontal`, () => {
          cy.visit(path, { timeout: 15000 });
          cy.get("h1", { timeout: 10000 }).should("be.visible");
          // Verificar que não há overflow horizontal
          cy.document().then((doc) => {
            const body = doc.body;
            const html = doc.documentElement;
            expect(body.scrollWidth).to.be.at.most(html.clientWidth + 1);
          });
        });
      });
    });
  });
});
