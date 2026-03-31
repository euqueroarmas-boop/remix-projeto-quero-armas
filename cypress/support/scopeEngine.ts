/**
 * WMTi Scope Engine — Cypress Helpers
 * Custom commands for auditing the Scope Engine E2E.
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /** Visit a service page by slug and wait for render */
      visitServicePage(slug: string): Chainable<void>;
      /** Assert the scope section is rendered with all required parts */
      assertScopeSection(): Chainable<void>;
      /** Start checkout from a service page */
      startServiceCheckout(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("visitServicePage", (slug: string) => {
  cy.log(`[Scope Audit] Visiting service: ${slug}`);
  cy.visit(`/${slug}`, { timeout: 30000 });
  cy.get("#root", { timeout: 20000 }).should("exist");
  cy.log(`[Scope Audit] Page loaded: ${slug}`);
});

Cypress.Commands.add("assertScopeSection", () => {
  // Scope section container
  cy.get('[data-testid="scope-section"]', { timeout: 15000 }).should("be.visible");

  // Description
  cy.get('[data-testid="scope-description"]').should("exist").and("not.be.empty");

  // Included items
  cy.get('[data-testid="scope-included-list"]').should("exist");
  cy.get('[data-testid="scope-included-list"] li').should("have.length.greaterThan", 0);

  // Not included items
  cy.get('[data-testid="scope-not-included-list"]').should("exist");
  cy.get('[data-testid="scope-not-included-list"] li').should("have.length.greaterThan", 0);

  // SLA
  cy.get('[data-testid="scope-sla"]').should("exist").and("not.be.empty");

  // Frequency
  cy.get('[data-testid="scope-frequency"]').should("exist").and("not.be.empty");

  // Client dependencies
  cy.get('[data-testid="scope-dependencies"]').should("exist");
  cy.get('[data-testid="scope-dependencies"] li').should("have.length.greaterThan", 0);

  cy.log("[Scope Audit] Scope rendered successfully");
});

Cypress.Commands.add("startServiceCheckout", () => {
  // Click the first "Contratar" CTA on the page
  cy.get('a[href*="/contratar-servico/"]', { timeout: 15000 }).first().then(($a) => {
    const href = $a.attr("href")!;
    cy.log(`[Scope Audit] Navigating to checkout: ${href}`);
    cy.visit(href, { timeout: 30000 });
    cy.get("#root", { timeout: 20000 }).should("exist");
  });
  cy.log("[Scope Audit] Checkout page loaded");
});

export {};
