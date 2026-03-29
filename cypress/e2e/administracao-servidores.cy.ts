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
    cy.get('[data-testid="incrementar-host"]').click();
    cy.get('[data-testid="quantidade-hosts"]').should("have.text", "2");
  });

  it("permite decrementar hosts (mínimo 1)", () => {
    cy.get('[data-testid="incrementar-host"]').click();
    cy.get('[data-testid="quantidade-hosts"]').should("have.text", "2");
    cy.get('[data-testid="decrementar-host"]').click();
    cy.get('[data-testid="quantidade-hosts"]').should("have.text", "1");
    // Should not go below 1
    cy.get('[data-testid="decrementar-host"]').should("be.disabled");
  });

  it("permite adicionar VMs", () => {
    cy.get('[data-testid="incrementar-vm"]').click();
    cy.get('[data-testid="quantidade-vms"]').should("have.text", "1");
  });

  it("permite decrementar VMs (mínimo 0)", () => {
    cy.get('[data-testid="incrementar-vm"]').click();
    cy.get('[data-testid="quantidade-vms"]').should("have.text", "1");
    cy.get('[data-testid="decrementar-vm"]').click();
    cy.get('[data-testid="quantidade-vms"]').should("have.text", "0");
    cy.get('[data-testid="decrementar-vm"]').should("be.disabled");
  });

  it("atualiza o valor total ao alterar hosts e VMs", () => {
    // Default: 1 host (R$350), 0 VMs = R$350
    cy.contains("350").should("be.visible");

    // Add 1 VM: R$350 + R$200 = R$550
    cy.get('[data-testid="incrementar-vm"]').click();
    cy.contains("550").should("be.visible");
  });

  it("botão de contratação redireciona corretamente", () => {
    cy.get('[data-testid="incrementar-vm"]').click();
    cy.get('[data-testid="botao-contratar"]').click();
    cy.url().should("include", "/contratar/administracao-de-servidores");
    cy.url().should("include", "hosts=1");
    cy.url().should("include", "vms=1");
  });
});
