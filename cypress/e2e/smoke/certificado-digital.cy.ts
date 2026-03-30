/// <reference types="cypress" />

describe("Certificado Digital – Módulo Admin", () => {
  beforeEach(() => {
    // Login no admin antes de cada teste
    cy.visit("/admin");
    cy.get("input[type='password']", { timeout: 15000 }).should("be.visible");
    cy.get("input[type='password']").type(Cypress.env("ADMIN_PASSWORD") || "admin");
    cy.contains("button", /entrar|login|acessar/i).click();

    // Aguardar dashboard carregar
    cy.contains("Dashboard", { timeout: 15000 }).should("exist");
  });

  it("navega até Assinatura Digital pelo menu", () => {
    // Abrir menu mobile se necessário
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      } else if ($body.find("button").filter(":contains('Menu')").length) {
        cy.contains("button", "Menu").click();
      }
    });

    // Clicar em Configurações > Assinatura Digital
    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();
    
    // Verificar que o módulo carregou
    cy.contains(/Certificado|certificado/i, { timeout: 15000 }).should("exist");
  });

  it("exibe seção de upload do certificado A1", () => {
    // Navegar ao módulo
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      } else if ($body.find("button").filter(":contains('Menu')").length) {
        cy.contains("button", "Menu").click();
      }
    });

    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();

    // Verificar seção de upload
    cy.contains(/Enviar Certificado A1|Substituir Certificado A1/i, { timeout: 15000 }).should("exist");
    cy.get("input[type='file'][accept='.pfx,.p12']").should("exist");
    cy.get("input[type='password'], input[placeholder*='Senha']").should("exist");
    cy.contains("button", /Enviar certificado/i).should("exist");
  });

  it("valida que upload exige arquivo e senha", () => {
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      } else if ($body.find("button").filter(":contains('Menu')").length) {
        cy.contains("button", "Menu").click();
      }
    });

    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();

    // Botão deve estar desabilitado sem arquivo/senha
    cy.contains("button", /Enviar certificado/i, { timeout: 15000 }).should("be.disabled");
  });

  it("exibe cards de status: Certificado, Validade, Assinaturas", () => {
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      } else if ($body.find("button").filter(":contains('Menu')").length) {
        cy.contains("button", "Menu").click();
      }
    });

    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();

    // 3 cards de status
    cy.contains(/Certificado/i, { timeout: 15000 }).should("exist");
    cy.contains(/Validade/i).should("exist");
    cy.contains(/Assinaturas/i).should("exist");
  });

  it("exibe seção de Logs de Assinatura", () => {
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      } else if ($body.find("button").filter(":contains('Menu')").length) {
        cy.contains("button", "Menu").click();
      }
    });

    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();

    // Logs section
    cy.contains(/Logs de Assinatura/i, { timeout: 15000 }).should("exist");
    cy.contains("button", /Atualizar/i).should("exist");
  });

  it("mensagem de segurança sobre senha está visível", () => {
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      } else if ($body.find("button").filter(":contains('Menu')").length) {
        cy.contains("button", "Menu").click();
      }
    });

    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();

    cy.contains(/criptografada|segura|frontend/i, { timeout: 15000 }).should("exist");
  });
});
