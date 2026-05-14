/**
 * FASE 2C-8 — Homologação ponta a ponta (sem DB real).
 *
 * Cobre, por inspeção de fonte, a cadeia completa pós-checkout do módulo
 * Quero Armas e prova as proibições invioláveis em todas as etapas:
 *
 *   1) qa-checkout-criar-venda           → cria qa_vendas
 *   2) trigger qa_vendas → PAGO
 *      2a) qa_vendas_after_pago_invoke_contract → qa-generate-contract
 *      2b) qa_vendas_provisionar_portal_on_pago → qa-provisionar-acesso-portal
 *   3) cliente faz upload do PDF assinado via qa-upload-signed-contract
 *   4) trigger qa_contracts_after_validated → qa-liberar-servicos-contrato
 *      → cria qa_solicitacoes_servico, qa_processos e checklist
 *
 * Este arquivo NÃO duplica os testes específicos de cada fase; ele garante
 * que o pipeline inteiro permanece coerente e fechado contra:
 *   - WMTi (customers/payments/contracts/quotes)
 *   - post-purchase.ts / ensureClientAccess
 *   - Qualquer bloqueio de Arsenal Inteligente (gratuito por contrato)
 *   - Criação de processo/checklist antes de contrato validated
 *   - Reuso indevido de solicitação de outra venda (recompra)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const r = (p: string) => readFileSync(join(ROOT, p), "utf8");

const EDGE_FUNCTIONS_PIPELINE = [
  "supabase/functions/qa-checkout-criar-venda/index.ts",
  "supabase/functions/qa-generate-contract/index.ts",
  "supabase/functions/qa-provisionar-acesso-portal/index.ts",
  "supabase/functions/qa-upload-signed-contract/index.ts",
  "supabase/functions/qa-liberar-servicos-contrato/index.ts",
] as const;

function latestMigrationContaining(token: string): { file: string; src: string } {
  const dir = "supabase/migrations";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".sql")).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const src = readFileSync(join(ROOT, dir, files[i]), "utf8");
    if (src.includes(token)) return { file: files[i], src };
  }
  throw new Error(`migração com token ${token} não encontrada`);
}

describe("FASE 2C-8 — Homologação: pipeline completo existe", () => {
  it("todas as edge functions do pipeline estão presentes", () => {
    for (const f of EDGE_FUNCTIONS_PIPELINE) {
      const src = r(f);
      expect(src.length, `${f} deve existir`).toBeGreaterThan(100);
      expect(src).toMatch(/Deno\.serve|serve\(/);
    }
  });
});

describe("FASE 2C-8 — Homologação: proibições globais (todas as etapas)", () => {
  it("nenhuma edge do pipeline toca tabelas WMTi", () => {
    for (const f of EDGE_FUNCTIONS_PIPELINE) {
      const src = r(f);
      expect(src, `${f} não pode usar customers`).not.toMatch(/from\(["']customers["']\)/);
      expect(src, `${f} não pode usar payments`).not.toMatch(/from\(["']payments["']\)/);
      expect(src, `${f} não pode usar contracts (WMTi)`).not.toMatch(/from\(["']contracts["']\)/);
      expect(src, `${f} não pode usar quotes`).not.toMatch(/from\(["']quotes["']\)/);
    }
  });

  it("nenhuma edge do pipeline importa post-purchase.ts ou chama ensureClientAccess", () => {
    for (const f of EDGE_FUNCTIONS_PIPELINE) {
      const src = r(f);
      // Comentários mencionando "não use post-purchase" são permitidos; banimos APENAS o import real.
      expect(src, `${f} não pode importar post-purchase`).not.toMatch(/from\s+["'][^"']*post-purchase[^"']*["']/);
      // ensureClientAccess: só falha se for invocada (chamada de função), não em comentários.
      expect(src, `${f} não pode invocar ensureClientAccess`).not.toMatch(/\bensureClientAccess\s*\(/);
    }
  });

  it("nenhuma edge do pipeline registra eventos de Arsenal liberado/bloqueado", () => {
    for (const f of EDGE_FUNCTIONS_PIPELINE) {
      const src = r(f);
      expect(src, `${f} não pode liberar/bloquear Arsenal`).not.toMatch(/arsenal_(liberado|bloqueado|premium)/i);
      expect(src, `${f} não pode referenciar qa_arsenal_access_gate`).not.toMatch(/qa_arsenal_access_gate/);
    }
  });
});

describe("FASE 2C-8 — Homologação: cadeia de triggers", () => {
  it("PAGO dispara qa-generate-contract (FASE 2C-4)", () => {
    // A função e o trigger podem viver em migrações distintas (rewrite recente da função).
    const fn = latestMigrationContaining("qa_vendas_after_pago_invoke_contract");
    expect(fn.src).toMatch(/qa-generate-contract/);
    // Trigger CREATE TRIGGER pode estar em outra migração — basta existir alguma migração que o crie.
    const triggerMig = readdirSync(join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(ROOT, "supabase/migrations", f), "utf8"))
      .find((s) => /CREATE TRIGGER[\s\S]{0,200}qa_vendas_after_pago_invoke_contract/.test(s)
        || /qa_vendas_after_pago_invoke_contract\s*\(\s*\)\s*;[\s\S]*ON public\.qa_vendas/i.test(s));
    expect(triggerMig, "deve existir migração que crie o TRIGGER em qa_vendas").toBeTruthy();
  });

  it("PAGO dispara qa-provisionar-acesso-portal (FASE 2C-5) — NÃO usa create-client-user", () => {
    const { src } = latestMigrationContaining("qa_vendas_provisionar_portal_on_pago");
    expect(src).toMatch(/qa-provisionar-acesso-portal/);
    // Garante que o trigger de provisionamento foi reescrito para não usar a edge legada WMTi.
    const fnBlock = src.split("qa_vendas_provisionar_portal_on_pago()")[1] ?? "";
    expect(fnBlock).not.toMatch(/create-client-user/);
  });

  it("contrato validated dispara qa-liberar-servicos-contrato com x-internal-token do Vault (FASE 2C-7 + 2C-7.2)", () => {
    const { src } = latestMigrationContaining("qa_contracts_after_validated_release");
    expect(src).toMatch(/qa-liberar-servicos-contrato/);
    expect(src).toMatch(/vault\.decrypted_secrets/);
    expect(src).toMatch(/QA_CONTRACT_RELEASE_TOKEN/);
    expect(src).toMatch(/'x-internal-token'/);
    // Pré-condição financeira garante que liberação só ocorre com venda PAGO + cobrança confirmada.
    expect(src).toMatch(/upper\(btrim\(v_venda\.status\)\)\s*<>\s*'PAGO'/);
    expect(src).toMatch(/cobranca_status IS DISTINCT FROM 'confirmada'/);
  });
});

describe("FASE 2C-8 — Homologação: ordem causal venda → contrato → portal → upload → liberação", () => {
  it("liberação operacional EXIGE contract.status = 'validated' (não basta PAGO)", () => {
    const src = r("supabase/functions/qa-liberar-servicos-contrato/index.ts");
    expect(src).toMatch(/contract\.status\s*!==\s*"validated"/);
    expect(src).toMatch(/liberacao_recusada_status_invalido/);
  });

  it("upload assinado NÃO pode criar processo/checklist (responsabilidade da 2C-7)", () => {
    const src = r("supabase/functions/qa-upload-signed-contract/index.ts");
    expect(src).not.toMatch(/from\(["']qa_processos["']\)\s*[\s\S]{0,80}\.insert/);
    expect(src).not.toMatch(/qa_confirmar_pagamento_processo/);
  });

  it("provisionamento de portal NÃO cria processo/checklist nem libera serviço", () => {
    const src = r("supabase/functions/qa-provisionar-acesso-portal/index.ts");
    // Pode LER qa_processos para anexar eventos de auditoria, mas nunca INSERIR.
    expect(src).not.toMatch(/from\(["']qa_processos["']\)\s*\.insert\(/);
    expect(src).not.toMatch(/from\(["']qa_solicitacoes_servico["']\)/);
    expect(src).not.toMatch(/qa_confirmar_pagamento_processo/);
  });

  it("geração de contrato NÃO cria processo/checklist nem libera serviço", () => {
    const src = r("supabase/functions/qa-generate-contract/index.ts");
    expect(src).not.toMatch(/from\(["']qa_processos["']\)/);
    expect(src).not.toMatch(/from\(["']qa_solicitacoes_servico["']\)\s*[\s\S]{0,200}\.insert/);
    expect(src).not.toMatch(/qa_confirmar_pagamento_processo/);
  });
});

describe("FASE 2C-8 — Homologação: idempotência (recompra do mesmo serviço)", () => {
  it("liberação usa lookup por item_venda_id e fallback (venda_id, servico_id) — sem reuso indevido por slug", () => {
    const src = r("supabase/functions/qa-liberar-servicos-contrato/index.ts");
    expect(src).toMatch(/\.eq\("item_venda_id",\s*it\.item_venda_id\)/);
    expect(src).toMatch(/\.eq\("venda_id",\s*venda\.id\)[\s\S]*?\.eq\("servico_id",\s*servicoId\)/);
    expect(src).toMatch(/mesmaVenda\s*=\s*existSol\.venda_id\s*===\s*venda\.id/);
    expect(src).toMatch(/solicitacao_manual_slug_cliente_ignorada_por_venda_diferente/);
  });

  it("índices únicos garantem 1 solicitação por item_venda e por (venda_id, servico_id)", () => {
    const { src } = latestMigrationContaining("uq_qa_solicitacoes_item_venda");
    expect(src).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_solicitacoes_item_venda[\s\S]*item_venda_id/);
    expect(src).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_solicitacoes_venda_servico[\s\S]*\(venda_id, servico_id\)/);
  });

  it("processo é único por (venda_id, servico_id) — recompra cria processo novo", () => {
    const { src } = latestMigrationContaining("uq_qa_processos_venda_servico");
    expect(src).toMatch(/uq_qa_processos_venda_servico[\s\S]*venda_id, servico_id/);
  });

  it("liberação é idempotente — guarda contrato_validado_liberacao_concluida", () => {
    const src = r("supabase/functions/qa-liberar-servicos-contrato/index.ts");
    expect(src).toMatch(/contrato_validado_liberacao_concluida/);
    expect(src).toMatch(/already_released/);
  });
});

describe("FASE 2C-8 — Homologação: segurança da liberação (FASE 2C-7.2)", () => {
  it("x-trigger-source NÃO autoriza — token interno é obrigatório (ou JWT staff QA)", () => {
    const src = r("supabase/functions/qa-liberar-servicos-contrato/index.ts");
    const authBlock = src.split("async function authorize")[1]?.split("\n}")[0] ?? "";
    expect(authBlock).not.toMatch(/x-trigger-source/);
    expect(authBlock).not.toMatch(/qa_contract_validated/);
    expect(src).toMatch(/QA_CONTRACT_RELEASE_TOKEN/);
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).toMatch(/requireQAStaff/);
  });
});

describe("FASE 2C-8 — Homologação: portal e Arsenal permanecem livres", () => {
  it("portal do cliente exibe ContratosPosPagamentoCard sem gate de Arsenal", () => {
    const portal = r("src/pages/quero-armas/QAClientePortalPage.tsx");
    expect(portal).toMatch(/ContratosPosPagamentoCard/);
    expect(portal).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
  });

  it("página do Arsenal Inteligente NÃO tem gate por contrato", () => {
    const arsenal = r("src/pages/quero-armas/QAArsenalDigitalGratuitoPage.tsx");
    expect(arsenal).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
    expect(arsenal).not.toMatch(/arsenal_plano\s*===?\s*['"]premium['"]/);
  });

  it("ContratosPosPagamentoCard expõe upload assinado e não importa gates de Arsenal", () => {
    const card = r("src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx");
    expect(card).toMatch(/AGUARDANDO CONTRATO ASSINADO|aguardando.*assinad/i);
    expect(card).toMatch(/qa-upload-signed-contract|upload.*assinad/i);
    expect(card).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
  });
});

describe("FASE 2C-8 — Homologação: regra-mãe (Arsenal gratuito + cadeia operacional)", () => {
  it("apenas qa-liberar-servicos-contrato libera execução operacional do serviço contratado", () => {
    // Garante que nenhuma OUTRA edge do pipeline cria qa_solicitacoes_servico ou processo
    // — concentrando a regra de liberação em um único ponto auditável.
    const liberador = "supabase/functions/qa-liberar-servicos-contrato/index.ts";
    expect(r(liberador)).toMatch(/from\(["']qa_solicitacoes_servico["']\)/);
    expect(r(liberador)).toMatch(/from\(["']qa_processos["']\)/);
    for (const f of EDGE_FUNCTIONS_PIPELINE.filter((p) => p !== liberador)) {
      const src = r(f);
      // Permitido LER qa_processos (auditoria); proibido INSERIR.
      expect(src, `${f} NÃO pode inserir em qa_processos`).not.toMatch(/from\(["']qa_processos["']\)\s*\.insert\(/);
      expect(src, `${f} NÃO pode inserir em qa_solicitacoes_servico`).not.toMatch(/from\(["']qa_solicitacoes_servico["']\)\s*\.insert\(/);
    }
  });
});
