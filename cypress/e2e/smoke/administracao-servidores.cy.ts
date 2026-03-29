/// <reference types="cypress" />

describe("Smoke — Administração de Servidores", () => {
  describe("Página de serviço", () => {
    beforeEach(() => {
      cy.visit("/administracao-de-servidores");
    });

    it("carrega sem erro", () => {
      cy.get("body").should("be.visible");
      cy.get("h1").should("be.visible");
    });

    it("exibe calculadora de servidores", () => {
      cy.get("#calculadora-servidores").should("be.visible");
    });

    it("controles de host existem", () => {
      cy.get('[data-testid="quantidade-hosts"]').should("be.visible");
      cy.get('[data-testid="incrementar-host"]').should("be.visible");
      cy.get('[data-testid="decrementar-host"]').should("exist");
    });

    it("controles de VM existem", () => {
      cy.get('[data-testid="quantidade-vms"]').should("be.visible");
      cy.get('[data-testid="incrementar-vm"]').should("be.visible");
      cy.get('[data-testid="decrementar-vm"]').should("exist");
    });

    it("botão de contratação existe", () => {
      cy.get('[data-testid="botao-contratar"]').should("be.visible");
    });

    it("FAQ existe", () => {
      cy.get('[class*="accordion"], [data-state]').should("exist");
    });

    it("navbar e footer visíveis", () => {
      cy.get("nav").should("be.visible");
      cy.get("footer").should("be.visible");
    });
  });

  describe("Wizard de contratação", () => {
    beforeEach(() => {
      cy.visit("/contratar/administracao-de-servidores?hosts=1&vms=2");
    });

    it("carrega o wizard", () => {
      cy.get("#contracting-wizard").should("be.visible");
    });

    it("exibe as 4 etapas do wizard", () => {
      cy.contains("Dados do Contratante").should("be.visible");
      cy.contains("Configuração do Plano").should("be.visible");
      cy.contains("Contrato e Assinatura").should("be.visible");
      cy.contains("Pagamento").should("be.visible");
    });

    it("formulário de cadastro com campos essenciais", () => {
      cy.get('[data-testid="campo-cnpj"]').should("be.visible");
      cy.get('[data-testid="campo-razao-social"]').should("be.visible");
      cy.get('[data-testid="campo-representante-nome"]').should("be.visible");
      cy.get('[data-testid="campo-representante-cpf"]').should("be.visible");
      cy.get('[data-testid="campo-representante-email"]').should("be.visible");
      cy.get('[data-testid="campo-representante-telefone"]').should("be.visible");
      cy.get('[data-testid="campo-cep"]').should("be.visible");
      cy.get('[data-testid="campo-numero"]').should("be.visible");
    });

    it("botão de prosseguir existe", () => {
      cy.get('[data-testid="botao-prosseguir-cadastro"]').should("be.visible");
    });

    it("header do wizard mostra hosts e VMs corretos", () => {
      cy.contains("Hosts").should("be.visible");
      cy.contains("VMs").should("be.visible");
    });
  });
});
