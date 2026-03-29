/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Preenche um formulário com os dados fornecidos.
       * @param fields - Objeto com seletor CSS ou label como chave e valor a preencher.
       */
      fillForm(fields: Record<string, string>): Chainable<void>;

      /**
       * Preenche um formulário de cliente usando dados de fixture.
       * @param fixtureName - Nome do cliente no fixture (ex: "empresa_padrao").
       */
      fillClientForm(fixtureName?: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("fillForm", (fields: Record<string, string>) => {
  Object.entries(fields).forEach(([selector, value]) => {
    cy.get(selector).clear().type(value, { delay: 30 });
  });
});

Cypress.Commands.add("fillClientForm", (fixtureName = "empresa_padrao") => {
  cy.fixture("clientes.json").then((data) => {
    const cliente = data[fixtureName];
    if (!cliente) throw new Error(`Fixture "${fixtureName}" não encontrada em clientes.json`);

    const fieldMap: Record<string, string> = {
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      cnpjOuCpf: cliente.cnpjOuCpf,
      responsavel: cliente.responsavel,
      email: cliente.email,
      telefone: cliente.telefone,
      endereco: cliente.endereco,
      cidade: cliente.cidade,
      cep: cliente.cep,
    };

    Object.entries(fieldMap).forEach(([field, value]) => {
      if (value) {
        cy.get(`input[name="${field}"], input[placeholder*="${field}"]`)
          .first()
          .clear()
          .type(value, { delay: 20 });
      }
    });
  });
});

export {};
