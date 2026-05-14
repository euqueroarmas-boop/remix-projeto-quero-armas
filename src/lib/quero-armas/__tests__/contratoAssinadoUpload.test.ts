/**
 * FASE 2C-6 — Upload e validação do contrato assinado.
 *
 * Cobre regras invioláveis (sem chamar DB):
 *  - Upload exige autenticação e resolve cliente do usuário (ownership).
 *  - Apenas PDF é aceito; tamanho máximo limitado.
 *  - Validação criptográfica (PAdES/PKCS#7) — OCR/IA não é prova final.
 *  - CPF/nome divergente NÃO valida automaticamente — vira revisao_manual.
 *  - Trigger de validação NÃO cria mais qa_solicitacoes_servico (fica para 2C-7).
 *  - Card do portal expõe upload, estados e nunca bloqueia Arsenal.
 *  - Edge functions não usam WMTi (payments/contracts/quotes/customers nem post-purchase/ensureClientAccess).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const r = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("FASE 2C-6 — Upload do contrato assinado", () => {
  it("qa-upload-signed-contract exige Authorization Bearer (JWT do cliente)", () => {
    const src = r("supabase/functions/qa-upload-signed-contract/index.ts");
    expect(src).toMatch(/Unauthorized/);
    expect(src).toMatch(/Authorization/);
    expect(src).toMatch(/auth\.getUser/);
  });

  it("verifica ownership do contrato (cliente_id == cliente do usuário)", () => {
    const src = r("supabase/functions/qa-upload-signed-contract/index.ts");
    expect(src).toMatch(/cliente_id/);
    expect(src).toMatch(/Acesso negado/);
  });

  it("aceita apenas PDF e limita tamanho (25MB)", () => {
    const src = r("supabase/functions/qa-upload-signed-contract/index.ts");
    expect(src).toMatch(/Apenas PDF/);
    expect(src).toMatch(/MAX_BYTES\s*=\s*25/);
    expect(src).toMatch(/%PDF/);
  });

  it("registra evento contrato_assinado_enviado e atualiza status", () => {
    const src = r("supabase/functions/qa-upload-signed-contract/index.ts");
    expect(src).toMatch(/contrato_assinado_enviado/);
    expect(src).toMatch(/customer_signature_uploaded/);
    expect(src).toMatch(/customer_signed_sha256/);
  });

  it("encadeia validação automaticamente após upload", () => {
    const src = r("supabase/functions/qa-upload-signed-contract/index.ts");
    expect(src).toMatch(/qa-validate-customer-signature/);
  });

  it("não usa WMTi (payments/contracts/quotes/customers/post-purchase/ensureClientAccess)", () => {
    const src = r("supabase/functions/qa-upload-signed-contract/index.ts");
    expect(src).not.toMatch(/from\(["']payments["']\)/);
    expect(src).not.toMatch(/from\(["']quotes["']\)/);
    expect(src).not.toMatch(/from\(["']customers["']\)/);
    expect(src).not.toMatch(/post-purchase/);
    expect(src).not.toMatch(/ensureClientAccess/);
  });
});

describe("FASE 2C-6 — Validação criptográfica", () => {
  it("usa parser PAdES/PKCS#7 compartilhado (não OCR)", () => {
    const src = r("supabase/functions/qa-validate-customer-signature/index.ts");
    expect(src).toMatch(/qaPdfSignatureValidate/);
    expect(src).toMatch(/validatePdfSignature/);
    // Não importa libs de OCR/transcrição como prova de assinatura.
    expect(src).not.toMatch(/tesseract|pdf2image|pytesseract|gemini.*vision/i);
    expect(src).not.toMatch(/import .*ocr/i);
  });

  it("CPF divergente sem ICP-Brasil → revisao_manual (indeterminate)", () => {
    const src = r("supabase/functions/qa-validate-customer-signature/index.ts");
    expect(src).toMatch(/pending_manual_review/);
    expect(src).toMatch(/indeterminate/);
    expect(src).toMatch(/cpfMatch\s*\|\|\s*meta\.icp_brasil/);
  });

  it("sem assinatura interpretada → invalid/rejected", () => {
    const src = r("supabase/functions/qa-validate-customer-signature/index.ts");
    expect(src).toMatch(/rejected/);
    expect(src).toMatch(/customer_signature_invalid/);
  });

  it("registra signatário em qa_contract_signatures", () => {
    const src = r("supabase/functions/qa-validate-customer-signature/index.ts");
    expect(src).toMatch(/qa_contract_signatures/);
    expect(src).toMatch(/signer_role.*customer/);
  });

  it("parser de assinatura detecta ICP-Brasil por CN do issuer", () => {
    const src = r("supabase/functions/_shared/qaPdfSignatureValidate.ts");
    expect(src).toMatch(/ICP-Brasil/i);
    expect(src).toMatch(/forge\.pkcs7\.messageFromAsn1/);
  });
});

describe("FASE 2C-6 — UI do portal", () => {
  it("ContratosPosPagamentoCard expõe botão de upload e estados de validação", () => {
    const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
    expect(src).toMatch(/ENVIAR CONTRATO ASSINADO/);
    expect(src).toMatch(/qa-upload-signed-contract/);
    expect(src).toMatch(/customer_signature_uploaded/);
    expect(src).toMatch(/validated/);
    expect(src).toMatch(/rejected/);
    expect(src).toMatch(/pending_manual_review/);
  });

  it("aceita apenas PDF no input file", () => {
    const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
    expect(src).toMatch(/accept="application\/pdf,\.pdf"/);
    expect(src).toMatch(/Apenas PDF/);
  });

  it("nunca bloqueia Arsenal (sem ArsenalGate/ArsenalBlockedPanel/qa_arsenal_access_gate)", () => {
    const src = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
    expect(src).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
    expect(src).toMatch(/Arsenal Inteligente continua\s+gratuito/);
  });
});

describe("FASE 2C-6 — Trigger de liberação operacional NÃO cria processo", () => {
  function latestMigration(): string {
    const dir = join(ROOT, "supabase/migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    return readFileSync(join(dir, files[files.length - 1]), "utf8");
  }

  it("migration mais recente substitui qa_contracts_after_validated_release sem inserir qa_solicitacoes_servico", () => {
    const sql = latestMigration();
    expect(sql).toMatch(/qa_contracts_after_validated_release/);
    expect(sql).toMatch(/contrato_assinado_apto_para_liberacao/);
    // O corpo da função não deve criar processo nesta fase.
    const bodyMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.qa_contracts_after_validated_release[\s\S]+?\$function\$/);
    expect(bodyMatch).toBeTruthy();
    expect(bodyMatch![0]).not.toMatch(/INSERT INTO public\.qa_solicitacoes_servico/);
  });
});

describe("FASE 2C-6 — Auditoria de eventos", () => {
  it("eventos esperados existem no fluxo de upload/validação", () => {
    const upload = r("supabase/functions/qa-upload-signed-contract/index.ts");
    const validate = r("supabase/functions/qa-validate-customer-signature/index.ts");
    expect(upload).toMatch(/contrato_assinado_enviado/);
    expect(validate).toMatch(/customer_signature_valid|customer_signature_invalid|customer_signature_manual_review/);
    // Nunca registrar bloqueio do Arsenal.
    expect(upload).not.toMatch(/arsenal_bloqueado/);
    expect(validate).not.toMatch(/arsenal_bloqueado/);
  });
});