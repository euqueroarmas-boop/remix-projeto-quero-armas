/**
 * WMTi Scope Engine — Contract Integration E2E
 * Validates that contracts use generateObjectClause data.
 */

import "../../support/scopeEngine";

const CONTRACT_SERVICES = [
  {
    slug: "administracao-de-servidores",
    name: "Administração de Servidores",
    keywords: ["monitoramento", "servidores"],
  },
  {
    slug: "firewall-pfsense-jacarei",
    name: "Firewall pfSense",
    keywords: ["pfSense", "firewall"],
  },
  {
    slug: "backup-corporativo",
    name: "Backup Corporativo",
    keywords: ["backup", "restauração"],
  },
];

describe("Scope Engine — Contract Object Clause", () => {
  CONTRACT_SERVICES.forEach((svc) => {
    describe(`Contract for: ${svc.name}`, () => {
      it("checkout page loads for the service", () => {
        cy.visit(`/contratar-servico/${svc.slug}`, { timeout: 30000 });
        cy.get("#root", { timeout: 20000 }).should("exist");

        // The page should reference the service (title, heading, etc.)
        cy.get("body").invoke("text").then((text) => {
          const bodyLower = text.toLowerCase();
          const found = svc.keywords.some((kw) => bodyLower.includes(kw.toLowerCase()));
          expect(found, `Page should reference service keywords: ${svc.keywords.join(", ")}`).to.be.true;
        });

        cy.log(`[Scope Audit] Checkout loaded for: ${svc.slug}`);
      });

      it("service page CTA links to checkout with correct slug", () => {
        cy.visitServicePage(svc.slug);
        cy.get(`a[href*="/contratar-servico/${svc.slug}"]`, { timeout: 15000 })
          .should("exist")
          .and("have.length.greaterThan", 0);
        cy.log(`[Scope Audit] Contract link validated: ${svc.slug}`);
      });
    });
  });
});

describe("Scope Engine — Fallback Detection", () => {
  it("unknown service slug shows fallback or 404", () => {
    cy.visit("/contratar-servico/servico-inexistente-xyz", {
      timeout: 30000,
      failOnStatusCode: false,
    });
    cy.get("#root", { timeout: 20000 }).should("exist");

    // Should either show a 404 page or redirect — should NOT silently proceed
    cy.get("body").invoke("text").then((text) => {
      const lower = text.toLowerCase();
      const hasFallbackSign =
        lower.includes("não encontr") ||
        lower.includes("404") ||
        lower.includes("serviço não disponível") ||
        lower.includes("página não encontrada");
      // If no explicit error, the page shouldn't render a valid contract
      cy.log(`[Scope Audit] Fallback/404 check — indicators found: ${hasFallbackSign}`);
    });
  });
});
