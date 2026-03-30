/// <reference types="cypress" />

/* ──────────────────────────────────────────────
 *  Cypress custom commands — WMTi
 *  Todos os seletores usam data-testid estáveis.
 * ────────────────────────────────────────────── */

export interface ClienteFixture {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelEmail: string;
  responsavelTelefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

declare global {
  namespace Cypress {
    interface Chainable {
      /** Preenche o formulário de cadastro do contratante usando fixture */
      preencherContratante(fixtureName?: string): Chainable<void>;

      /** Seleciona um prazo contratual (12, 24 ou 36 meses) */
      selecionarPrazo(meses: 12 | 24 | 36): Chainable<void>;

      /** Ajusta a quantidade de hosts na calculadora */
      ajustarHosts(quantidade: number): Chainable<void>;

      /** Ajusta a quantidade de VMs na calculadora */
      ajustarVMs(quantidade: number): Chainable<void>;

      /** Ativa ou desativa o suporte 24h */
      toggleSuporte24h(ativar: boolean): Chainable<void>;

      /** Avança no wizard até a etapa de contrato (cadastro + plano) */
      avancarAteContrato(opts?: {
        fixture?: string;
        prazo?: 12 | 24 | 36;
        suporte24h?: boolean;
      }): Chainable<void>;
    }
  }
}

// ─── Helper: type into field only if empty ───
function typeIfEmpty(testId: string, value: string) {
  cy.get(`[data-testid="${testId}"]`).then(($el) => {
    if (!$el.val()) {
      cy.wrap($el).type(value, { delay: 10 });
    }
  });
}

function typeIfEmptyBySelector(selector: string, value: string) {
  cy.get(selector).then(($el) => {
    if ($el.length && !$el.val()) {
      cy.wrap($el).first().type(value, { delay: 10 });
    }
  });
}

// ═══════════════════════════════════════════════
//  1. Preencher dados do contratante
// ═══════════════════════════════════════════════
Cypress.Commands.add("preencherContratante", (fixtureName = "empresa_padrao") => {
  cy.fixture("clientes.json").then((data: Record<string, ClienteFixture>) => {
    const c = data[fixtureName];
    if (!c) throw new Error(`Fixture "${fixtureName}" não encontrada em clientes.json`);

    // Intercept CNPJ and CEP API calls
    cy.intercept("POST", "**/brasil-api-lookup").as("brasilApiLookup");

    // CNPJ (always clear + type to trigger auto-fill)
    cy.get('[data-testid="campo-cnpj"]').clear().type(c.cnpj, { delay: 10 });

    // Wait for CNPJ lookup to complete (or timeout gracefully)
    cy.wait("@brasilApiLookup", { timeout: 10000 }).then(() => {
      cy.wait(300); // allow React state to settle
    });

    // Fields that may be auto-filled by CNPJ lookup
    typeIfEmpty("campo-razao-social", c.razaoSocial);
    typeIfEmpty("campo-representante-nome", c.responsavelNome);
    typeIfEmpty("campo-representante-cpf", c.responsavelCpf);
    typeIfEmpty("campo-representante-email", c.responsavelEmail);
    typeIfEmpty("campo-representante-telefone", c.responsavelTelefone);

    // CEP — type and wait for lookup
    cy.get('[data-testid="campo-cep"]').then(($el) => {
      if (!$el.val()) {
        cy.wrap($el).type(c.cep, { delay: 10 });
        // Wait for CEP lookup response
        cy.wait("@brasilApiLookup", { timeout: 10000 }).then(() => {
          cy.wait(300); // allow React state to settle after CEP fill
        });
      }
    });

    // Address fields — use stable data-testid selectors, fill only if empty
    typeIfEmpty("campo-logradouro", c.logradouro);
    typeIfEmpty("campo-numero", c.numero);
    if (c.complemento) {
      typeIfEmpty("campo-complemento", c.complemento);
    }
    typeIfEmpty("campo-bairro", c.bairro);
    typeIfEmpty("campo-cidade", c.cidade);
    typeIfEmpty("campo-uf", c.uf);
  });
});

// ═══════════════════════════════════════════════
//  2. Selecionar prazo contratual
// ═══════════════════════════════════════════════
Cypress.Commands.add("selecionarPrazo", (meses: 12 | 24 | 36) => {
  cy.get(`[data-testid="plano-${meses}-meses"]`, { timeout: 15000 })
    .should("be.visible")
    .click();
});

// ═══════════════════════════════════════════════
//  3. Ajustar quantidade de hosts
// ═══════════════════════════════════════════════
Cypress.Commands.add("ajustarHosts", (quantidade: number) => {
  if (quantidade < 1) throw new Error("Hosts mínimo é 1");

  cy.get('[data-testid="quantidade-hosts"]').then(($el) => {
    const current = parseInt($el.text(), 10);
    const diff = quantidade - current;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        cy.get('[data-testid="incrementar-host"]').click();
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        cy.get('[data-testid="decrementar-host"]').click();
      }
    }

    cy.get('[data-testid="quantidade-hosts"]').should("have.text", String(quantidade));
  });
});

// ═══════════════════════════════════════════════
//  4. Ajustar quantidade de VMs
// ═══════════════════════════════════════════════
Cypress.Commands.add("ajustarVMs", (quantidade: number) => {
  if (quantidade < 0) throw new Error("VMs mínimo é 0");

  cy.get('[data-testid="quantidade-vms"]').then(($el) => {
    const current = parseInt($el.text(), 10);
    const diff = quantidade - current;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        cy.get('[data-testid="incrementar-vm"]').click();
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        cy.get('[data-testid="decrementar-vm"]').click();
      }
    }

    cy.get('[data-testid="quantidade-vms"]').should("have.text", String(quantidade));
  });
});

// ═══════════════════════════════════════════════
//  5. Toggle suporte 24h
// ═══════════════════════════════════════════════
Cypress.Commands.add("toggleSuporte24h", (ativar: boolean) => {
  cy.get('[data-testid="toggle-suporte-24h"]').then(($el) => {
    const isChecked = $el.attr("data-state") === "checked" || $el.attr("aria-checked") === "true";
    if (ativar !== isChecked) {
      cy.wrap($el).click();
    }
  });
});

// ═══════════════════════════════════════════════
//  6. Avançar até geração do contrato
// ═══════════════════════════════════════════════
Cypress.Commands.add("avancarAteContrato", (opts = {}) => {
  const { fixture = "empresa_padrao", prazo = 12, suporte24h = false } = opts;

  // Step 1: Fill registration
  cy.preencherContratante(fixture);
  cy.get('[data-testid="botao-prosseguir-cadastro"]').click();

  // Step 2: Configure plan
  cy.selecionarPrazo(prazo);
  if (suporte24h) {
    cy.toggleSuporte24h(true);
  }
  cy.get('[data-testid="botao-confirmar-plano"]').click();

  // Step 3: Wait for contract generation
  cy.contains("Contrato e Assinatura", { timeout: 15000 }).should("be.visible");
  cy.get('[data-testid="botao-abrir-contrato"]', { timeout: 10000 }).should("be.visible");
});

export {};
