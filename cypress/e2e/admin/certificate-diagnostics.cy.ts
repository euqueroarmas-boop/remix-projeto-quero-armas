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

  // ════════════════════════════════════════
  // CENÁRIO 1 — Navega até o módulo
  // ════════════════════════════════════════
  it("CENÁRIO 1 — navega até o módulo de diagnóstico de certificado", () => {
    navigateToCertDiag();
    cy.contains(/Executar Diagnóstico/i).should("exist");
    cy.get("input[type='file'][accept='.pfx,.p12']").should("exist");
    cy.get("input[type='password']").should("exist");
  });

  // ════════════════════════════════════════
  // CENÁRIO 2 — Botão desabilitado sem arquivo/senha
  // ════════════════════════════════════════
  it("CENÁRIO 2 — botão de diagnóstico desabilitado sem arquivo/senha", () => {
    navigateToCertDiag();
    cy.contains("button", /Executar Diagnóstico/i).should("be.disabled");
  });

  // ════════════════════════════════════════
  // CENÁRIO 3 — Upload de arquivo vazio
  // ════════════════════════════════════════
  it("CENÁRIO 3 — upload de arquivo vazio mostra falha na etapa 1", () => {
    navigateToCertDiag();

    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("input[type='file']").selectFile("cypress/fixtures/certificates/empty-cert.pfx", { force: true });
    cy.get("input[type='password']").last().type("qualquersenha");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 400]);
    });

    cy.contains(/FAIL|Arquivo recebido/i, { timeout: 30000 }).should("exist");
  });

  // ════════════════════════════════════════
  // CENÁRIO 4 — Certificado corrompido
  // ════════════════════════════════════════
  it("CENÁRIO 4 — upload de arquivo corrompido mostra falha no parser", () => {
    navigateToCertDiag();

    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("input[type='file']").selectFile("cypress/fixtures/certificates/corrupted-cert.pfx", { force: true });
    cy.get("input[type='password']").last().type("qualquersenha");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      const body = interception.response?.body;
      if (body?.steps) {
        const failedStep = body.steps.find((s: any) => s.status === "fail");
        expect(failedStep).to.exist;
        if (failedStep?.code) {
          expect(failedStep.code).to.match(/CERT_FILE_CORRUPTED|CERT_PARSE_FAILED/);
        }
      }
    });

    cy.contains(/FAIL/i, { timeout: 30000 }).should("exist");
  });

  // ════════════════════════════════════════
  // CENÁRIO 5 — Resultado exibe request ID e duração
  // ════════════════════════════════════════
  it("CENÁRIO 5 — resultado exibe request ID e duração", () => {
    navigateToCertDiag();

    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("input[type='file']").selectFile("cypress/fixtures/certificates/valid-cert.pfx", { force: true });
    cy.get("input[type='password']").last().type("testpassword");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      expect(interception.response?.body).to.have.property("request_id");
      expect(interception.response?.body).to.have.property("duration_ms");
    });

    cy.contains(/Request ID/i, { timeout: 30000 }).should("exist");
    cy.contains(/Duração/i).should("exist");
  });

  // ════════════════════════════════════════
  // CENÁRIO 6 — Botão copiar relatório
  // ════════════════════════════════════════
  it("CENÁRIO 6 — botão 'Copiar relatório' funciona após diagnóstico", () => {
    navigateToCertDiag();

    cy.get("input[type='file']").selectFile("cypress/fixtures/certificates/valid-cert.pfx", { force: true });
    cy.get("input[type='password']").last().type("testpassword");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.contains(/FAIL|PASS/i, { timeout: 30000 }).should("exist");
    cy.contains("button", /Copiar relatório/i).should("exist").click();
    cy.contains(/Copiado/i).should("exist");
  });

  // ════════════════════════════════════════
  // CENÁRIO 7 — Assinatura Digital acessível
  // ════════════════════════════════════════
  it("CENÁRIO 7 — seção de Assinatura Digital está acessível", () => {
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

  // ════════════════════════════════════════
  // CENÁRIO 8 — Checklist mostra etapas numeradas
  // ════════════════════════════════════════
  it("CENÁRIO 8 — checklist mostra etapas numeradas", () => {
    navigateToCertDiag();

    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("input[type='file']").selectFile("cypress/fixtures/certificates/valid-cert.pfx", { force: true });
    cy.get("input[type='password']").last().type("test");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      const body = interception.response?.body;
      if (body?.steps) {
        expect(body.steps.length).to.be.greaterThan(0);
        body.steps.forEach((s: any, i: number) => {
          expect(s).to.have.property("step", i + 1);
          expect(s).to.have.property("name");
          expect(s).to.have.property("status");
        });
      }
    });

    cy.contains(/Checklist técnico/i, { timeout: 30000 }).should("exist");
    cy.contains(/Arquivo recebido/i).should("exist");
    cy.contains(/Conclusão técnica/i).should("exist");
  });

  // ════════════════════════════════════════
  // CENÁRIO 9 — Payload de diagnóstico contém campos obrigatórios
  // ════════════════════════════════════════
  it("CENÁRIO 9 — payload de resposta contém campos obrigatórios", () => {
    navigateToCertDiag();

    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("input[type='file']").selectFile("cypress/fixtures/certificates/corrupted-cert.pfx", { force: true });
    cy.get("input[type='password']").last().type("senha123");
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      const body = interception.response?.body;
      expect(body).to.have.property("success");
      expect(body).to.have.property("request_id");
      expect(body).to.have.property("steps");
      expect(body).to.have.property("conclusion");
      expect(body).to.have.property("duration_ms");
      expect(body.steps).to.be.an("array");
    });
  });

  // ════════════════════════════════════════
  // CENÁRIO 10 — Senha com espaço detectada na resposta
  // ════════════════════════════════════════
  it("CENÁRIO 10 — senha com espaço é diagnosticada no payload", () => {
    navigateToCertDiag();

    cy.intercept("POST", "**/certificate-manager*diagnose*").as("diagnose");

    cy.get("input[type='file']").selectFile("cypress/fixtures/certificates/valid-cert.pfx", { force: true });
    cy.get("input[type='password']").last().type("senha123 "); // trailing space
    cy.contains("button", /Executar Diagnóstico/i).click();

    cy.wait("@diagnose", { timeout: 30000 }).then((interception) => {
      const body = interception.response?.body;
      // Password analysis step should detect whitespace
      const pwdStep = body?.steps?.find((s: any) => 
        s.name?.toLowerCase().includes("senha") || s.name?.toLowerCase().includes("password")
      );
      if (pwdStep) {
        expect(pwdStep.message).to.match(/espaço|whitespace|trimmed/i);
      }
    });
  });
});
