/// <reference types="cypress" />

describe("Administração de Servidores — Página", () => {
  beforeEach(() => {
    cy.visit("/administracao-de-servidores");
  });

  it("carrega a página corretamente", () => {
    cy.get("h1").should("be.visible");
    cy.contains("administração", { matchCase: false }).should("exist");
  });

  it("exibe a calculadora de servidores", () => {
    cy.get("#calculadora-servidores").should("be.visible");
  });

  it("permite incrementar hosts", () => {
    cy.get("#calculadora-servidores").within(() => {
      cy.contains("Hosts").should("be.visible");
      // Click the increment button for hosts
      cy.get('button[aria-label="Aumentar hosts"]').click();
      cy.contains("2").should("be.visible");
    });
  });

  it("permite adicionar VMs", () => {
    cy.get("#calculadora-servidores").within(() => {
      cy.contains("VMs").should("be.visible");
      cy.get('button[aria-label="Aumentar VMs"]').click();
      cy.contains("1").should("be.visible");
    });
  });

  it("atualiza o valor total ao alterar hosts e VMs", () => {
    cy.get("#calculadora-servidores").within(() => {
      // Default: 1 host (R$350), 0 VMs = R$350
      cy.contains("350").should("be.visible");

      // Add 1 VM: R$350 + R$200 = R$550
      cy.get('button[aria-label="Aumentar VMs"]').click();
      cy.contains("550").should("be.visible");
    });
  });

  it("botão de contratação redireciona corretamente", () => {
    cy.get("#calculadora-servidores").within(() => {
      cy.get('button[aria-label="Aumentar VMs"]').click();
      cy.contains("Contratar").click();
    });
    cy.url().should("include", "/contratar/administracao-de-servidores");
    cy.url().should("include", "hosts=1");
    cy.url().should("include", "vms=1");
  });
});
