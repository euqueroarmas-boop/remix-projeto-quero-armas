/**
 * WMTi Scope Engine — Validation E2E
 * Ensures scope completeness and blocking behavior.
 */

import "../../support/scopeEngine";

describe("Scope Engine — Scope Completeness Validation", () => {
  const SAMPLE_SERVICES = [
    "administracao-de-servidores",
    "suporte-ti-jacarei",
    "monitoramento-de-servidores",
  ];

  SAMPLE_SERVICES.forEach((slug) => {
    it(`"${slug}" has all scope sub-sections rendered`, () => {
      cy.visitServicePage(slug);
      cy.assertScopeSection();

      // Verify all 3 info cards exist (SLA, Frequency, Dependencies)
      cy.get('[data-testid="scope-sla"]').should("be.visible");
      cy.get('[data-testid="scope-frequency"]').should("be.visible");
      cy.get('[data-testid="scope-dependencies"]').should("be.visible");

      cy.log(`[Scope Audit] ✔ Completeness validated: ${slug}`);
    });
  });
});

describe("Scope Engine — Checkout Persistence", () => {
  it("navigating from service page to checkout preserves service context", () => {
    const slug = "administracao-de-servidores";
    cy.visitServicePage(slug);

    // Start checkout
    cy.startServiceCheckout();

    // Checkout page should reference the service
    cy.url().should("include", `/contratar-servico/${slug}`);
    cy.get("body").invoke("text").then((text) => {
      expect(text.toLowerCase()).to.include("servidor");
    });

    cy.log("[Scope Audit] Checkout persistence validated");
  });
});

describe("Scope Engine — Cross-service Scope Isolation", () => {
  it("different services render different scope content", () => {
    let firstScopeText = "";

    cy.visitServicePage("administracao-de-servidores");
    cy.get('[data-testid="scope-description"]')
      .invoke("text")
      .then((text) => {
        firstScopeText = text;
      });

    cy.visitServicePage("backup-corporativo");
    cy.get('[data-testid="scope-description"]')
      .invoke("text")
      .then((text) => {
        expect(text).to.not.equal(firstScopeText);
        cy.log("[Scope Audit] ✔ Scope isolation confirmed — different services have different scopes");
      });
  });
});

describe("Scope Engine — Contract Mode Selection", () => {
  it("service page has contract mode selector or CTA", () => {
    cy.visitServicePage("administracao-de-servidores");

    // Should have at least one CTA linking to checkout
    cy.get('a[href*="/contratar-servico/"]').should("have.length.greaterThan", 0);
    cy.log("[Scope Audit] ✔ Contract CTA present");
  });
});
