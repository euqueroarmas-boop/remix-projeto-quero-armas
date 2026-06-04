import { describe, it, expect } from "vitest";
import {
  serviceScopes,
  getServiceScopeBySlug,
  validateServiceScope,
  generateObjectClause,
} from "@/data/serviceScopes";
import { getServiceContractObject, requireServiceScope } from "@/lib/serviceContractMap";

/* ═══════════════════════════════════════════════════
   SCOPE ENGINE AUDIT — End-to-end validation
   ═══════════════════════════════════════════════════ */

// All actual routes from App.tsx (service pages only)
const ACTUAL_ROUTES = [
  "administracao-de-servidores",
  "monitoramento-de-rede",
  "backup-corporativo",
  "infraestrutura-ti-corporativa-jacarei",
  "suporte-ti-jacarei",
  "seguranca-de-rede",
  "terceirizacao-de-mao-de-obra-ti",
  "locacao-de-computadores-para-empresas-jacarei",
  "firewall-pfsense-jacarei",
  "microsoft-365-para-empresas-jacarei",
  "suporte-linux",
  "suporte-windows-server",
  "montagem-e-monitoramento-de-redes-jacarei",
  "reestruturacao-completa-de-rede-corporativa",
  "monitoramento-de-servidores",
  "suporte-tecnico-para-redes-corporativas",
  "desenvolvimento-de-sites-e-sistemas-web",
  "automacao-de-ti-com-inteligencia-artificial",
  "automacao-alexa-casa-empresa-inteligente",
  "suporte-tecnico-emergencial",
  "servidor-dell-poweredge-jacarei",
  "manutencao-de-infraestrutura-de-ti",
];

describe("Scope Engine — Global Audit", () => {
  it("all 22 scopes are registered", () => {
    expect(serviceScopes.length).toBe(22);
  });

  it("every scope has a unique slug", () => {
    const slugs = serviceScopes.map(s => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every scope slug matches an actual route", () => {
    const mismatches: string[] = [];
    for (const scope of serviceScopes) {
      if (!ACTUAL_ROUTES.includes(scope.slug)) {
        mismatches.push(scope.slug);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("every actual route has a scope", () => {
    const missing: string[] = [];
    for (const route of ACTUAL_ROUTES) {
      if (!getServiceScopeBySlug(route)) {
        missing.push(route);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("Scope Engine — Service: administracao-de-servidores", () => {
  const slug = "administracao-de-servidores";

  it("scope exists and is valid", () => {
    expect(validateServiceScope(slug)).toBe(true);
  });

  it("scope has all required fields populated", () => {
    const scope = getServiceScopeBySlug(slug)!;
    expect(scope.service_name).toBeTruthy();
    expect(scope.included.length).toBeGreaterThan(0);
    expect(scope.not_included.length).toBeGreaterThan(0);
    expect(scope.sla).toBeTruthy();
    expect(scope.frequency).toBeTruthy();
    expect(scope.client_dependencies.length).toBeGreaterThan(0);
  });

  it("contract clause uses exact scope data", () => {
    const scope = getServiceScopeBySlug(slug)!;
    const clause = getServiceContractObject(slug);
    expect(clause).toContain(scope.service_name);
    expect(clause).toContain(scope.sla);
    for (const item of scope.included) {
      expect(clause).toContain(item);
    }
  });

  it("requireServiceScope does not throw", () => {
    expect(() => requireServiceScope(slug)).not.toThrow();
  });
});

describe("Scope Engine — Service: suporte-ti-jacarei", () => {
  const slug = "suporte-ti-jacarei";

  it("scope exists and is valid", () => {
    expect(validateServiceScope(slug)).toBe(true);
  });

  it("contract clause contains scope data", () => {
    const scope = getServiceScopeBySlug(slug)!;
    const clause = generateObjectClause(scope);
    expect(clause).toContain(scope.service_name);
    expect(clause).toContain(scope.frequency);
  });
});

describe("Scope Engine — Service: firewall-pfsense-jacarei", () => {
  const slug = "firewall-pfsense-jacarei";

  it("scope exists and is valid", () => {
    expect(validateServiceScope(slug)).toBe(true);
  });

  it("contract clause contains scope data", () => {
    const scope = getServiceScopeBySlug(slug)!;
    const clause = getServiceContractObject(slug);
    expect(clause).toContain("pfSense");
    expect(clause).toContain(scope.sla);
  });
});

describe("Scope Engine — Blocking validation", () => {
  it("validateServiceScope returns false for unknown slug", () => {
    expect(validateServiceScope("servico-inexistente")).toBe(false);
  });

  it("requireServiceScope throws for unknown slug", () => {
    expect(() => requireServiceScope("servico-inexistente")).toThrow("scope incomplete");
  });

  it("fallback contract text is used for unknown slug", () => {
    const text = getServiceContractObject("servico-inexistente");
    expect(text).toContain("escopo acordado entre as partes");
  });
});
