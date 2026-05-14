import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

function findLatestMigrationContaining(needle: string): string {
  const dir = resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const src = readFileSync(resolve(dir, files[i]), "utf-8");
    if (src.includes(needle)) return src;
  }
  throw new Error(`migration with ${needle} not found`);
}

describe("FASE 2C-5 — acesso QA puro pós-pagamento", () => {
  describe("Edge function qa-provisionar-acesso-portal", () => {
    const src = r("supabase/functions/qa-provisionar-acesso-portal/index.ts");

    it("não toca tabelas WMTi (customers/payments/quotes/contracts)", () => {
      expect(src).not.toMatch(/from\(\s*["']customers["']/);
      expect(src).not.toMatch(/from\(\s*["']payments["']/);
      expect(src).not.toMatch(/from\(\s*["']quotes["']/);
      expect(src).not.toMatch(/from\(\s*["']contracts["']/);
    });

    it("não importa post-purchase nem ensureClientAccess", () => {
      expect(src).not.toMatch(/post-purchase/);
      expect(src).not.toMatch(/ensureClientAccess/);
      expect(src).not.toMatch(/ensure-client-access/);
    });

    it("usa qa_clientes como fonte de verdade", () => {
      expect(src).toMatch(/from\(\s*["']qa_clientes["']/);
    });

    it("é idempotente: respeita portal_provisionado_em e LGPD", () => {
      expect(src).toMatch(/portal_provisionado_em/);
      expect(src).toMatch(/excluido_lgpd/);
    });

    it("não envia senha em texto puro no e-mail", () => {
      // O template de boas-vindas não recebe senha; só nome/email/serviço.
      expect(src).not.toMatch(/password\s*[:=]\s*tempPwd/);
      expect(src).not.toMatch(/senha.*tempPwd/i);
      // Nenhum campo "password" é passado para sendWelcomeEmail
      expect(src).not.toMatch(/sendWelcomeEmail[\s\S]*password/);
    });

    it("não cria processo nem checklist", () => {
      expect(src).not.toMatch(/from\(\s*["']qa_processos["']\s*\)\s*\.insert/);
      expect(src).not.toMatch(/from\(\s*["']qa_checklists?["']\s*\)\s*\.insert/);
    });

    it("emite eventos de auditoria QA puros", () => {
      expect(src).toMatch(/acesso_portal_preparado_pos_pagamento/);
      expect(src).toMatch(/convite_acesso_enviado/);
      expect(src).toMatch(/convite_acesso_reutilizado/);
    });

    it("nunca registra arsenal_bloqueado", () => {
      expect(src).not.toMatch(/arsenal_bloqueado/);
    });
  });

  describe("trigger qa_vendas_provisionar_portal_on_pago (migração mais recente)", () => {
    const sql = findLatestMigrationContaining("qa_vendas_provisionar_portal_on_pago");

    it("aponta para qa-provisionar-acesso-portal (não create-client-user)", () => {
      expect(sql).toMatch(/qa-provisionar-acesso-portal/);
      // A última migração que define a função NÃO chama create-client-user.
      expect(sql).not.toMatch(/create-client-user/);
    });

    it("usa header x-trigger-source: qa_vendas_pago_acesso", () => {
      expect(sql).toMatch(/qa_vendas_pago_acesso/);
    });

    it("preserva guardas idempotentes (LGPD, portal_provisionado_em, sem e-mail)", () => {
      expect(sql).toMatch(/excluido_lgpd/);
      expect(sql).toMatch(/portal_provisionado_em IS NOT NULL/);
      expect(sql).toMatch(/v_cliente\.email IS NULL/);
    });
  });

  describe("Portal/Arsenal — Arsenal permanece gratuito", () => {
    it("QAClientePortalPage importa ContratosPosPagamentoCard e não usa ArsenalGate", () => {
      const src = r("src/pages/quero-armas/QAClientePortalPage.tsx");
      expect(src).toMatch(/ContratosPosPagamentoCard/);
      expect(src).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
    });

    it("QAArsenalDigitalGratuitoPage não tem gate/bloqueio por contrato", () => {
      const src = r("src/pages/quero-armas/QAArsenalDigitalGratuitoPage.tsx");
      expect(src).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
      expect(src).not.toMatch(/contrato.*assinado.*bloqueia/i);
    });

    it("ContratosPosPagamentoCard exibe badge aguardando contrato + download", () => {
      const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
      expect(src.toUpperCase()).toMatch(/AGUARDANDO CONTRATO ASSINADO/);
      expect(src).toMatch(/qa-serve-contract-pdf|baixar|download/i);
    });
  });

  describe("Reaproveitamento de fluxo existente (sem arquitetura paralela)", () => {
    it("qa-cliente-reenviar-boas-vindas continua QA puro", () => {
      const src = r("supabase/functions/qa-cliente-reenviar-boas-vindas/index.ts");
      expect(src).toMatch(/qa_clientes/);
      expect(src).toMatch(/send-smtp-email/);
      expect(src).not.toMatch(/from\(\s*["']customers["']/);
    });

    it("nova função reutiliza qaArsenalWelcome templates (não cria template novo)", () => {
      const src = r("supabase/functions/qa-provisionar-acesso-portal/index.ts");
      expect(src).toMatch(/qaArsenalWelcomeHtml/);
      expect(src).toMatch(/qaArsenalWelcomeText/);
    });
  });
});
