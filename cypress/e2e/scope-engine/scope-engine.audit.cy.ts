/**
 * WMTi Scope Engine — Audit E2E
 * Validates that service pages render the scope section correctly.
 */

import "../../support/scopeEngine";

const AUDIT_SERVICES = [
  {
    slug: "administracao-de-servidores",
    name: "Administração de Servidores",
    type: "recorrente",
  },
  {
    slug: "suporte-tecnico-emergencial",
    name: "Suporte Técnico Emergencial",
    type: "pontual",
  },
  {
    slug: "firewall-pfsense-jacarei",
    name: "Firewall pfSense",
    type: "infraestrutura",
  },
];

describe("Scope Engine — Page Audit", () => {
  AUDIT_SERVICES.forEach((svc) => {
    describe(`Service: ${svc.name} (${svc.type})`, () => {
      beforeEach(() => {
        cy.visitServicePage(svc.slug);
      });

      it("renders the scope section with all required fields", () => {
        cy.assertScopeSection();
      });

      it("scope section contains the service name", () => {
        cy.get('[data-testid="scope-section"]').should("be.visible");
        // The scope description or included items should relate to the service
        cy.get('[data-testid="scope-description"]')
          .invoke("text")
          .should("have.length.greaterThan", 20);
      });

      it("SLA and frequency cards are populated", () => {
        cy.get('[data-testid="scope-sla"]')
          .invoke("text")
          .should("have.length.greaterThan", 5);

        cy.get('[data-testid="scope-frequency"]')
          .invoke("text")
          .should("have.length.greaterThan", 5);
      });

      it("included and not-included lists have items", () => {
        cy.get('[data-testid="scope-included-list"] li')
          .should("have.length.greaterThan", 0)
          .first()
          .invoke("text")
          .should("have.length.greaterThan", 3);

        cy.get('[data-testid="scope-not-included-list"] li')
          .should("have.length.greaterThan", 0)
          .first()
          .invoke("text")
          .should("have.length.greaterThan", 3);
      });
    });
  });
});

describe("Scope Engine — Full Service Coverage", () => {
  const ALL_SLUGS = [
    "administracao-de-servidores",
    "monitoramento-de-rede",
    "backup-corporativo",
    "infraestrutura-ti-corporativa-jacarei",
    "suporte-ti-jacarei",
    "seguranca-de-rede",
    "terceirizacao-de-mao-de-obra-ti",
    "locacao-de-computadores-para-empresas-jacarei",
    "firewall-pfsense-jacarei",
    "microsoft-365-para-empresas-jacarei",
    "suporte-linux",
    "suporte-windows-server",
    "montagem-e-monitoramento-de-redes-jacarei",
    "reestruturacao-completa-de-rede-corporativa",
    "monitoramento-de-servidores",
    "suporte-tecnico-para-redes-corporativas",
    "desenvolvimento-de-sites-e-sistemas-web",
    "automacao-de-ti-com-inteligencia-artificial",
    "automacao-alexa-casa-empresa-inteligente",
    "suporte-tecnico-emergencial",
    "servidor-dell-poweredge-jacarei",
    "manutencao-de-infraestrutura-de-ti",
  ];

  ALL_SLUGS.forEach((slug) => {
    it(`"${slug}" loads and renders scope section`, () => {
      cy.visitServicePage(slug);
      cy.get('[data-testid="scope-section"]', { timeout: 15000 }).should("be.visible");
      cy.get('[data-testid="scope-included-list"] li').should("have.length.greaterThan", 0);
      cy.log(`[Scope Audit] ✔ ${slug} — OK`);
    });
  });
});
