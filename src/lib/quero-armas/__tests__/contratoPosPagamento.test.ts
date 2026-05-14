/**
 * FASE 2C-4 — Testes do fluxo de contrato pós-pagamento Quero Armas.
 *
 * Cobre regras invioláveis (sem chamar DB):
 *  - Snapshot de itens é congelado (não muda quando o catálogo muda).
 *  - Status PAGO → contrato esperado; status diferente → não.
 *  - Webhook QA não chama qa-generate-contract manualmente.
 *  - Edge qa-generate-contract não usa WMTi (payments/contracts/quotes/customers).
 *  - Card do portal não bloqueia Arsenal.
 *  - Migration desativa triggers de Arsenal upgrade.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const r = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("FASE 2C-4 — Contrato pós-pagamento", () => {
  describe("Snapshot dos itens", () => {
    it("contrato grava service_name_snapshot/description_snapshot/unit_price_cents", () => {
      const src = r("supabase/functions/qa-generate-contract/index.ts");
      expect(src).toMatch(/service_name_snapshot/);
      expect(src).toMatch(/service_description_snapshot/);
      expect(src).toMatch(/unit_price_cents/);
      expect(src).toMatch(/total_price_cents/);
    });

    it("snapshot lê catálogo apenas no momento da geração — depois usa qa_contract_items", () => {
      const src = r("supabase/functions/qa-generate-contract/index.ts");
      // Catálogo só é consultado para snapshot, e qa_contract_items é a fonte definitiva.
      expect(src).toMatch(/qa_contract_items/);
      expect(src).toMatch(/UNIQUE|UNIQUE\(venda_id\)|idempot/i);
    });

    it("card do portal só lê snapshot de qa_contract_items, nunca qa_servicos_catalogo", () => {
      const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
      expect(src).toMatch(/qa_contract_items/);
      expect(src).toMatch(/service_name_snapshot/);
      expect(src).not.toMatch(/qa_servicos_catalogo/);
    });
  });

  describe("Trigger só dispara em PAGO", () => {
    it("migration condiciona disparo a transição para PAGO", () => {
      const dir = "supabase/migrations";
      const files = readdirSync(join(ROOT, dir));
      const target = files
        .map((f) => r(join(dir, f)))
        .find(
          (c) =>
            c.includes("qa_vendas_after_pago_invoke_contract") &&
            c.includes("FASE 2C-4"),
        );
      expect(target, "migration 2C-4 não encontrada").toBeTruthy();
      expect(target!).toMatch(/v_new_status\s*<>\s*'PAGO'\s*OR\s*v_old_status\s*=\s*'PAGO'/);
      expect(target!).toMatch(/qa-generate-contract/);
    });
  });

  describe("Webhook NÃO chama contrato manualmente", () => {
    it("qa-asaas-webhook não invoca qa-generate-contract", () => {
      const src = r("supabase/functions/qa-asaas-webhook/index.ts");
      expect(src).not.toMatch(/qa-generate-contract/);
      expect(src).not.toMatch(/qa_contracts/);
    });
  });

  describe("Sem WMTi", () => {
    it("qa-generate-contract não toca payments/contracts/quotes/customers", () => {
      const src = r("supabase/functions/qa-generate-contract/index.ts");
      expect(src).not.toMatch(/from\(["']payments["']/);
      expect(src).not.toMatch(/from\(["']contracts["']/);
      expect(src).not.toMatch(/from\(["']quotes["']/);
      expect(src).not.toMatch(/from\(["']customers["']/);
      expect(src).not.toMatch(/post-purchase/);
      expect(src).not.toMatch(/ensureClientAccess/);
    });

    it("card do portal não toca payments/contracts/quotes/customers", () => {
      const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
      expect(src).not.toMatch(/from\(["'](payments|contracts|quotes|customers)["']/);
      expect(src).not.toMatch(/post-purchase/);
      expect(src).not.toMatch(/ensureClientAccess/);
    });
  });

  describe("Arsenal sempre gratuito — nunca bloqueado", () => {
    it("card do portal não tem ArsenalGate / ArsenalBlockedPanel", () => {
      const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
      expect(src).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
    });

    it("migration 2C-4 desativa triggers de Arsenal upgrade", () => {
      const dir = "supabase/migrations";
      const files = readdirSync(join(ROOT, dir));
      const target = files
        .map((f) => r(join(dir, f)))
        .find(
          (c) =>
            c.includes("qa_vendas_after_pago_invoke_contract") &&
            c.includes("FASE 2C-4"),
        );
      expect(target!).toMatch(/DROP TRIGGER IF EXISTS trg_qa_vendas_arsenal_upgrade/);
      expect(target!).toMatch(/DROP TRIGGER IF EXISTS trg_qa_vendas_arsenal_upgrade_insert/);
    });

    it("plan.md declara Arsenal gratuito como regra canônica", () => {
      const src = r(".lovable/plan.md");
      expect(src).toMatch(/Arsenal Inteligente é gratuito/);
      expect(src).toMatch(/permanece acessível/);
    });
  });

  describe("Não cria processo / checklist / não libera execução operacional", () => {
    it("qa-generate-contract não insere em qa_processos nem checklist", () => {
      const src = r("supabase/functions/qa-generate-contract/index.ts");
      expect(src).not.toMatch(/from\(["']qa_processos["']\)\s*\.\s*insert/);
      expect(src).not.toMatch(/from\(["']qa_processo_checklist["']\)\s*\.\s*insert/);
      expect(src).not.toMatch(/from\(["']qa_solicitacoes_servico["']\)\s*\.\s*insert/);
    });

    it("card do portal não cria processo nem checklist", () => {
      const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
      expect(src).not.toMatch(/qa_processos/);
      expect(src).not.toMatch(/qa_processo_checklist/);
      expect(src).not.toMatch(/qa_solicitacoes_servico/);
    });
  });

  describe("Auditoria mínima", () => {
    it("edge registra evento contrato_gerado_pos_pagamento", () => {
      const src = r("supabase/functions/qa-generate-contract/index.ts");
      expect(src).toMatch(/contrato_gerado_pos_pagamento/);
    });

    it("card registra evento contrato_disponibilizado_portal", () => {
      const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
      expect(src).toMatch(/contrato_disponibilizado_portal/);
    });
  });
});
