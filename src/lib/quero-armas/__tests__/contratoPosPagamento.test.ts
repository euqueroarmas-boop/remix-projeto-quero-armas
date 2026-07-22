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
      // Pode mencionar em comentário, mas NÃO pode invocar.
      expect(src).not.toMatch(/functions\.invoke\(["']qa-generate-contract["']/);
      expect(src).not.toMatch(/functions\/v1\/qa-generate-contract/);
      expect(src).not.toMatch(/from\(["']qa_contracts["']\)/);
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

    it("edge renderiza o template principal vigente e filtra anexos pelos slugs contratados", () => {
      const src = r("supabase/functions/qa-generate-contract/index.ts");
      expect(src).toMatch(/qa_contract_templates/);
      expect(src).toMatch(/CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS/);
      expect(src).toMatch(/filterContractAnexosBySlugs/);
      expect(src).toMatch(/service_slug_snapshot/);
      expect(src).toMatch(/conteudo_renderizado/);
      expect(src).toMatch(/template_codigo/);
      expect(src).toMatch(/template_versao/);
      expect(src).not.toMatch(/CLÁUSULAS GERAIS/);
      expect(src).not.toMatch(/pdf-lib|PDFDocument|StandardFonts|buildPdf|original\.pdf/);
      expect(src).not.toMatch(/storage\s*\.\s*from\(BUCKET\)\s*\.\s*upload/);
    });

    it("download do cliente prioriza o contrato renderizado, não o PDF físico simplificado", () => {
      const src = r("supabase/functions/qa-serve-contract-pdf/index.ts");
      expect(src).toMatch(/Minuta_Contrato_Quero_Armas_v1\.md é o único contrato canônico/);
      expect(src).toMatch(/conteudo_renderizado/);
      expect(src).toMatch(/printableContractHtml/);
      expect(src).toMatch(/buildCanonicalPdf/);
      expect(src).toMatch(/ensureCanonicalPdf/);
      expect(src).toMatch(/ensureRenderedContractAudit/);
      expect(src).toMatch(/aceite_eletronico_data/);
      expect(src).toMatch(/aceite_ip/);
      expect(src).toMatch(/aceite_user_agent/);
      expect(src).toMatch(/aceite_hash/);
      expect(src).toMatch(/contractDownloadFilename/);
      expect(src).toMatch(/Contrato de Adesao Quero Armas/);
      expect(src).toMatch(/fullPersonName/);
      expect(src).toMatch(/rebuildRenderedContractHtml/);
      expect(src).toMatch(/contrato_renderizado_indisponivel/);
      expect(src).toMatch(/logSistemaBackend/);
      expect(src).toMatch(/failContractDownload/);
      expect(src).toMatch(/contrato_canonico_indisponivel/);
      expect(src).toMatch(/download bloqueado por fallback ou contrato canonico indisponivel/);
      expect(src.indexOf("ensureCanonicalPdf")).toBeLessThan(src.indexOf("storage.from(BUCKET).download"));
      expect(src).not.toMatch(/canServeRenderedHtml[\s\S]{0,180}company_signed_pdf_path/);
      expect(src).not.toMatch(/path = \(auditedContract as any\)\.company_signed_pdf_path \?\?/);
      expect(src).not.toMatch(/Fallback contrato de adesão/);
      expect(src).toMatch(/text\/html; charset=utf-8/);
    });

    it("portal do cliente usa a edge autenticada para baixar o contrato renderizado", () => {
      const card = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
      const block = r("src/components/quero-armas/portal/ContratoBlock.tsx");
      const helper = r("src/lib/quero-armas/minutaContratoDownload.ts");

      expect(card).toMatch(/openMinutaContratoQueroArmas/);
      expect(block).toMatch(/openMinutaContratoQueroArmas/);
      expect(card).not.toMatch(/conteudo_renderizado|openRenderedContract/);
      expect(block).not.toMatch(/conteudo_renderizado|openRenderedContract/);

      expect(helper).toMatch(/Minuta_Contrato_Quero_Armas_v1\.md/);
      expect(helper).toMatch(/qa-serve-contract-pdf/);
      expect(helper).toMatch(/CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS/);
      expect(helper).not.toMatch(/qa_contract_templates/);
      expect(helper).not.toMatch(/corpo_html|observacoes|filterContractAnexosBySlugs/);
    });

    it("reenvio manual de contrato regenerado usa template próprio e processa a fila", () => {
      const src = r("supabase/functions/qa-generate-contract/index.ts");
      const registry = r("supabase/functions/_shared/transactional-email-templates/registry.ts");
      expect(src).toMatch(/reenviar_email/);
      expect(src).toMatch(/contrato-regenerado-assinatura/);
      expect(src).toMatch(/process-email-queue/);
      expect(src).toMatch(/sendResult\.ok/);
      expect(src).toMatch(/Contrato regenerado, mas o e-mail não foi enfileirado/);
      expect(src).toMatch(/contrato_email_reenviado/);
      expect(registry).toMatch(/contrato-regenerado-assinatura/);
    });

    it("migration corrige Anexo I.6 para PF/SINARM-CAC no template e snapshots", () => {
      const src = r("supabase/migrations/20260620212500_qa_contract_anexo_16_sinarm_cac.sql");
      expect(src).toMatch(/I\.6\. CONCESSÃO DE CR/);
      expect(src).toMatch(/Polícia Federal \/ SINARM-CAC/);
      expect(src).toMatch(/Polícia Federal --- SINARM-CAC/);
      expect(src).toMatch(/qa_contract_templates/);
      expect(src).toMatch(/qa_contracts/);
      expect(src).toMatch(/CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS/);
    });

    it("migration remove ponteiros de PDFs legados do contrato principal aprovado", () => {
      const src = r("supabase/migrations/20260620134500_qa_contracts_remover_pdfs_legados.sql");
      expect(src).toMatch(/CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS/);
      expect(src).toMatch(/conteudo_renderizado IS NOT NULL/);
      expect(src).toMatch(/original_pdf_path = NULL/);
      expect(src).toMatch(/company_signed_pdf_path = NULL/);
      expect(src).toMatch(/customer_signed_pdf_path IS NULL/);
    });

    it("migration atualiza fontes normativas do contrato principal", () => {
      const src = r("supabase/migrations/20260620103000_qa_contract_template_fontes_normativas.sql");
      expect(src).toMatch(/Lei nº 10\.826\/2003/);
      expect(src).toMatch(/Decreto nº 11\.615\/2023/);
      expect(src).toMatch(/Decreto nº 12\.345\/2024/);
      expect(src).toMatch(/Instruções Normativas DG\/PF nº 201 e 311/);
      expect(src).toMatch(/Portarias COLOG nº 166, 167 e 260/);
      expect(src).toMatch(/Ofício Circular nº 08\/DELEARM/);
      expect(src).toMatch(/CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS/);
    });

    it("edge usa protocolo canônico como número do contrato, sem gerador aleatório", () => {
      const src = r("supabase/functions/qa-generate-contract/index.ts");
      expect(src).toMatch(/qa_gerar_protocolo/);
      expect(src).toMatch(/const contractNumber = String\(protocolNumber\)/);
      expect(src).not.toMatch(/nowYearSeq/);
      expect(src).not.toMatch(/Date\.now\(\)\.toString\(36\)/);
      expect(src).not.toMatch(/QA-\$\{d\.getFullYear\(\)\}/);
    });

    it("card registra evento contrato_disponibilizado_portal", () => {
      const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
      expect(src).toMatch(/contrato_disponibilizado_portal/);
    });

    it("migração canônica fixa protocolo sem traço com sequência de 4 dígitos", () => {
      const src = r("supabase/migrations/20260619153000_qa_protocolos_seq4_contratos_canonicos.sql");
      expect(src).toMatch(/QACR20260001/);
      expect(src).toMatch(/LPAD\(v_seq::TEXT, 4, '0'\)/);
      expect(src).toMatch(/LPAD\(sequencia_ano::TEXT, 4, '0'\)/);
      expect(src).toMatch(/contract_number_corrigido|qa_contracts/);
      expect(src).not.toMatch(/SEQ3/);
    });
  });
});
