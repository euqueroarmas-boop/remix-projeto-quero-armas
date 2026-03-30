/// <reference types="cypress" />

describe("Smoke — Páginas Transacionais", () => {
  it("/contrato carrega", () => {
    cy.visit("/contrato", { timeout: 15000 });
    cy.get("body").should("be.visible");
    cy.get("h1, h2", { timeout: 10000 }).should("be.visible");
  });

  it("/compra-concluida carrega", () => {
    cy.visit("/compra-concluida", { timeout: 15000 });
    cy.get("body").should("be.visible");
    cy.get("h1, h2, p", { timeout: 10000 }).should("be.visible");
  });

  it("/ativacao-acesso carrega", () => {
    cy.visit("/ativacao-acesso", { timeout: 15000 });
    cy.get("body").should("be.visible");
    cy.get("h1, h2, p", { timeout: 10000 }).should("be.visible");
  });

  it("/redefinir-senha carrega", () => {
    cy.visit("/redefinir-senha", { timeout: 15000 });
    cy.get("body").should("be.visible");
    cy.get("h1, h2, input", { timeout: 10000 }).should("be.visible");
  });

  it("/contratar/administracao-de-servidores carrega wizard", () => {
    cy.visit("/contratar/administracao-de-servidores", { timeout: 15000 });
    cy.get("body").should("be.visible");
    cy.get("h1, h2", { timeout: 10000 }).should("be.visible");
  });
});

describe("Smoke — Redirects Legacy", () => {
  const redirects = [
    { from: "/sobre", to: "/institucional" },
    { from: "/cliente", to: "/area-do-cliente" },
    { from: "/servidores-dell-poweredge-jacarei", to: "/servidor-dell-poweredge-jacarei" },
    { from: "/locacao-de-computadores-para-empresas", to: "/locacao-de-computadores-para-empresas-jacarei" },
    { from: "/suporte-ti-empresarial-jacarei", to: "/suporte-ti-jacarei" },
    { from: "/microsoft-365-para-empresas", to: "/microsoft-365-para-empresas-jacarei" },
    { from: "/provimento-213", to: "/cartorios/provimento-213" },
    { from: "/ti-para-industrias", to: "/ti-para-industrias-alimenticias" },
    { from: "/servidores-dell-poweredge", to: "/servidor-dell-poweredge-jacarei" },
    { from: "/locacao-computadores-jacarei", to: "/locacao-de-computadores-para-empresas-jacarei" },
    { from: "/infraestrutura-ti-corporativa", to: "/infraestrutura-ti-corporativa-jacarei" },
    { from: "/infraestrutura-corporativa", to: "/infraestrutura-ti-corporativa-jacarei" },
    { from: "/microsoft-365-empresas-jacarei", to: "/microsoft-365-para-empresas-jacarei" },
    { from: "/microsoft-365-para-empresas", to: "/microsoft-365-para-empresas-jacarei" },
    { from: "/montagem-redes-corporativas-jacarei", to: "/montagem-e-monitoramento-de-redes-jacarei" },
    { from: "/montagem-redes-estruturadas-jacarei", to: "/montagem-e-monitoramento-de-redes-jacarei" },
    { from: "/montagem-redes-jacarei", to: "/montagem-e-monitoramento-de-redes-jacarei" },
  ];

  redirects.forEach(({ from, to }) => {
    it(`${from} redireciona para ${to}`, () => {
      cy.visit(from, { timeout: 15000 });
      cy.url().should("include", to);
    });
  });
});
