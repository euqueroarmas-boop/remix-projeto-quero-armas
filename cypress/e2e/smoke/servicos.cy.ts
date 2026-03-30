/// <reference types="cypress" />

const servicoPages = [
  { path: "/firewall-pfsense-jacarei", name: "Firewall pfSense" },
  { path: "/servidor-dell-poweredge-jacarei", name: "Servidores Dell" },
  { path: "/microsoft-365-para-empresas-jacarei", name: "Microsoft 365" },
  { path: "/montagem-e-monitoramento-de-redes-jacarei", name: "Montagem de Redes" },
  { path: "/locacao-de-computadores-para-empresas-jacarei", name: "Locação de Computadores" },
  { path: "/suporte-ti-jacarei", name: "Suporte TI" },
  { path: "/infraestrutura-ti-corporativa-jacarei", name: "Infraestrutura Corporativa" },
  { path: "/administracao-de-servidores", name: "Administração de Servidores" },
  { path: "/monitoramento-de-servidores", name: "Monitoramento de Servidores" },
  { path: "/backup-corporativo", name: "Backup Corporativo" },
  { path: "/seguranca-de-rede", name: "Segurança de Rede" },
  { path: "/monitoramento-de-rede", name: "Monitoramento de Rede" },
  { path: "/suporte-tecnico-emergencial", name: "Suporte Emergencial" },
  { path: "/suporte-windows-server", name: "Suporte Windows Server" },
  { path: "/suporte-linux", name: "Suporte Linux" },
  { path: "/manutencao-de-infraestrutura-de-ti", name: "Manutenção de Infraestrutura" },
  { path: "/suporte-tecnico-para-redes-corporativas", name: "Suporte Redes Corporativas" },
  { path: "/reestruturacao-completa-de-rede-corporativa", name: "Reestruturação de Rede" },
  { path: "/desenvolvimento-de-sites-e-sistemas-web", name: "Desenvolvimento Web" },
  { path: "/automacao-de-ti-com-inteligencia-artificial", name: "Automação IA" },
  { path: "/automacao-alexa-casa-empresa-inteligente", name: "Automação Alexa" },
  { path: "/terceirizacao-de-mao-de-obra-ti", name: "Terceirização TI" },
];

describe("Smoke — Páginas de Serviço", () => {
  servicoPages.forEach(({ path, name }) => {
    it(`${name} carrega corretamente`, () => {
      cy.visit(path, { timeout: 15000 });
      cy.get("body").should("be.visible");
      cy.get("h1", { timeout: 10000 }).should("be.visible");
      cy.get("nav").should("be.visible");
      cy.get("footer").should("be.visible");
    });
  });
});
