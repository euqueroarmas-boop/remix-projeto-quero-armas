/// <reference types="cypress" />

describe("Certificado Digital – Diagnóstico Completo", () => {
  beforeEach(() => {
    cy.visit("/admin");
    cy.get("input[type='password']", { timeout: 15000 }).should("be.visible");
    cy.get("input[type='password']").type(Cypress.env("ADMIN_PASSWORD") || "admin");
    cy.contains("button", /entrar|login|acessar/i).click();
    cy.contains("Dashboard", { timeout: 15000 }).should("exist");
  });

  function navigateToCertDiag() {
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      } else if ($body.find("button").filter(":contains('Menu')").length) {
        cy.contains("button", "Menu").click();
      }
    });
    cy.contains(/Diagnóstico Cert|Diag\. Certificado/i, { timeout: 10000 }).click();
    cy.contains(/Diagnóstico de Certificado Digital/i, { timeout: 15000 }).should("exist");
  }

  it("CENÁRIO 1 — navega até o módulo de diagnóstico de certificado", () => {
    navigateToCertDiag();
    cy.contains(/Executar Diagnóstico/i).should("exist");
    cy.get("input[type='file'][accept='.pfx,.p12']").should("exist");
    cy.get("input[type='password']").should("exist");
  });

  it("CENÁRIO 2 — botão de diagnóstico desabilitado sem arquivo/senha", () => {
    navigateToCertDiag();
    cy.contains("button", /Executar Diagnóstico/i).should("be.disabled");
  });

  it("CENÁRIO 3 — upload de arquivo vazio mostra falha na etapa 1", () => {
    navigateToCertDiag();

    // Create empty file fixture
    cy.get("input[type='file']").selectFile({
      contents: new Uint8Array(0),
      fileName: "empty-cert.pfx",
      mimeType: "application/x-pkcs12",
    });

    cy.get("input[type='password']").last().type("qualquersenha");
    cy.contains("button", /Executar Diagnóstico/i).click();

    // Wait for results
    cy.contains(/FAIL/i, { timeout: 30000 }).should("exist");
    cy.contains(/Arquivo recebido/i).should("exist");
  });

  it("CENÁRIO 4 — upload de arquivo corrompido mostra falha no parser", () => {
    navigateToCertDiag();

    // Create corrupted file (random bytes that don't start with 0x30)
    const corruptedBytes = new Uint8Array([0xFF, 0xFE, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    cy.get("input[type='file']").selectFile({
      contents: corruptedBytes,
      fileName: "corrupted-cert.pfx",
      mimeType: "application/x-pkcs12",
    });

    cy.get("input[type='password']").last().type("qualquersenha");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.contains(/FAIL/i, { timeout: 30000 }).should("exist");
    cy.contains(/CERT_FILE_CORRUPTED|corrompido|Formato/i).should("exist");
  });

  it("CENÁRIO 5 — resultado exibe request ID e duração", () => {
    navigateToCertDiag();

    // Use a minimal file that at least starts with 0x30
    const minimalPfx = new Uint8Array([0x30, 0x82, 0x00, 0x01, 0x00]);
    cy.get("input[type='file']").selectFile({
      contents: minimalPfx,
      fileName: "test-cert.pfx",
      mimeType: "application/x-pkcs12",
    });

    cy.get("input[type='password']").last().type("testpassword");
    cy.contains("button", /Executar Diagnóstico/i).click();

    // Wait for result
    cy.contains(/Request ID/i, { timeout: 30000 }).should("exist");
    cy.contains(/Duração/i).should("exist");
  });

  it("CENÁRIO 6 — botão 'Copiar relatório' funciona após diagnóstico", () => {
    navigateToCertDiag();

    const minimalPfx = new Uint8Array([0x30, 0x82, 0x00, 0x01, 0x00]);
    cy.get("input[type='file']").selectFile({
      contents: minimalPfx,
      fileName: "test-cert.pfx",
      mimeType: "application/x-pkcs12",
    });

    cy.get("input[type='password']").last().type("testpassword");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.contains(/FAIL|PASS/i, { timeout: 30000 }).should("exist");
    cy.contains("button", /Copiar relatório/i).should("exist").click();
    cy.contains(/Copiado/i).should("exist");
  });

  it("CENÁRIO 7 — seção de Assinatura Digital (upload real) está acessível", () => {
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid='admin-menu-toggle']").length) {
        cy.get("[data-testid='admin-menu-toggle']").click();
      } else if ($body.find("button").filter(":contains('Menu')").length) {
        cy.contains("button", "Menu").click();
      }
    });

    cy.contains(/Assinatura Digital/i, { timeout: 10000 }).click();
    cy.contains(/Certificado|Enviar Certificado A1|Substituir Certificado A1/i, { timeout: 15000 }).should("exist");
  });

  it("CENÁRIO 8 — checklist mostra etapas numeradas", () => {
    navigateToCertDiag();

    const minimalPfx = new Uint8Array([0x30, 0x82, 0x00, 0x01, 0x00]);
    cy.get("input[type='file']").selectFile({
      contents: minimalPfx,
      fileName: "test-cert.pfx",
      mimeType: "application/x-pkcs12",
    });

    cy.get("input[type='password']").last().type("test");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.contains(/Checklist técnico/i, { timeout: 30000 }).should("exist");
    cy.contains(/Arquivo recebido/i).should("exist");
    cy.contains(/Conclusão técnica/i).should("exist");
  });
});
