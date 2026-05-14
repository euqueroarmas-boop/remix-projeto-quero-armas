/**
 * FASE 2C-7 — Liberação operacional após contrato validado.
 *
 * Testes de regressão por inspeção de fonte (sem DB):
 *  - Edge function qa-liberar-servicos-contrato existe e respeita pré-condições;
 *  - Só libera quando contract.status = 'validated' E venda PAGO + cobranca confirmada;
 *  - É idempotente (não duplica solicitação/processo/checklist);
 *  - Cria qa_solicitacoes_servico, qa_processos e usa RPC canônica para checklist;
 *  - Item sem servico_id NÃO cria processo;
 *  - Catálogo (qa_servicos_catalogo.gera_processo) decide criação de processo;
 *  - NÃO toca WMTi (customers/payments/contracts/quotes), nem post-purchase, nem ensureClientAccess;
 *  - Arsenal Inteligente NÃO é bloqueado nem tratado como premium;
 *  - Migração troca unicidade venda_id por (venda_id, servico_id) e religa trigger.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const r = (p: string) => readFileSync(join(ROOT, p), "utf8");
const FN = "supabase/functions/qa-liberar-servicos-contrato/index.ts";

function latestMigrationContaining(token: string): string {
  const dir = "supabase/migrations";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".sql")).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const txt = readFileSync(join(ROOT, dir, files[i]), "utf8");
    if (txt.includes(token)) return txt;
  }
  throw new Error(`migração com token ${token} não encontrada`);
}

describe("FASE 2C-7 — qa-liberar-servicos-contrato", () => {
  it("edge function existe e exige contract_id", () => {
    const src = r(FN);
    expect(src).toMatch(/contract_id_required/);
    expect(src).toMatch(/qa_contracts/);
  });

  it("autoriza apenas via x-trigger-source qa_contract_validated ou x-internal-token", () => {
    const src = r(FN);
    expect(src).toMatch(/qa_contract_validated/);
    expect(src).toMatch(/x-internal-token/);
    expect(src).toMatch(/timingSafeEqual/);
  });

  it("recusa contrato que não está validated", () => {
    const src = r(FN);
    expect(src).toMatch(/contract\.status\s*!==\s*"validated"/);
    expect(src).toMatch(/liberacao_recusada_status_invalido/);
  });

  it("recusa quando venda não está PAGO ou cobrança não confirmada", () => {
    const src = r(FN);
    expect(src).toMatch(/PAGO/);
    expect(src).toMatch(/cobranca_status\s*!==\s*"confirmada"/);
    expect(src).toMatch(/liberacao_recusada_pagamento_invalido/);
  });

  it("é idempotente — checa contrato_validado_liberacao_concluida antes de liberar", () => {
    const src = r(FN);
    expect(src).toMatch(/contrato_validado_liberacao_concluida/);
    expect(src).toMatch(/liberacao_idempotente_ignorada/);
    expect(src).toMatch(/already_released/);
  });

  it("item sem servico_id NÃO cria processo (registra liberacao_falhou)", () => {
    const src = r(FN);
    expect(src).toMatch(/item_sem_servico_id/);
  });

  it("consulta qa_servicos_catalogo.gera_processo para decidir criação de processo", () => {
    const src = r(FN);
    expect(src).toMatch(/qa_servicos_catalogo/);
    expect(src).toMatch(/gera_processo/);
  });

  it("upsert de qa_solicitacoes_servico por cliente_id+service_slug (idempotente)", () => {
    const src = r(FN);
    expect(src).toMatch(/qa_solicitacoes_servico/);
    expect(src).toMatch(/service_slug/);
    expect(src).toMatch(/origem:\s*"contrato_validado"/);
  });

  it("idempotência de qa_processos por (venda_id, servico_id)", () => {
    const src = r(FN);
    expect(src).toMatch(/from\("qa_processos"\)/);
    expect(src).toMatch(/\.eq\("venda_id",\s*venda\.id\)/);
    expect(src).toMatch(/\.eq\("servico_id",\s*servicoId\)/);
  });

  it("delega checklist à RPC canônica qa_confirmar_pagamento_processo", () => {
    const src = r(FN);
    expect(src).toMatch(/qa_confirmar_pagamento_processo/);
    expect(src).toMatch(/checklist_criado_por_contrato_validado/);
  });

  it("registra eventos canônicos de auditoria", () => {
    const src = r(FN);
    [
      "contrato_validado_liberacao_iniciada",
      "servico_liberado_por_contrato_validado",
      "solicitacao_servico_criada",
      "processo_criado_por_contrato_validado",
      "checklist_criado_por_contrato_validado",
      "contrato_validado_liberacao_concluida",
    ].forEach((ev) => expect(src).toMatch(new RegExp(ev)));
  });

  it("NUNCA registra eventos de Arsenal liberado/bloqueado", () => {
    const src = r(FN);
    expect(src).not.toMatch(/arsenal_liberado/);
    expect(src).not.toMatch(/arsenal_bloqueado/);
    expect(src).not.toMatch(/ArsenalGate/);
    expect(src).not.toMatch(/ArsenalBlockedPanel/);
    expect(src).not.toMatch(/qa_arsenal_access_gate/);
  });

  it("NÃO toca WMTi (customers/payments/contracts/quotes) nem post-purchase/ensureClientAccess", () => {
    const src = r(FN);
    expect(src).not.toMatch(/from\(["']customers["']\)/);
    expect(src).not.toMatch(/from\(["']payments["']\)/);
    expect(src).not.toMatch(/from\(["']contracts["']\)/);
    expect(src).not.toMatch(/from\(["']quotes["']\)/);
    expect(src).not.toMatch(/post-purchase/);
    expect(src).not.toMatch(/ensureClientAccess/);
  });
});

describe("FASE 2C-7 — migração de banco", () => {
  it("substitui unique de qa_processos por (venda_id, servico_id)", () => {
    const sql = latestMigrationContaining("uq_qa_processos_venda_servico");
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS uq_qa_processos_venda_id/);
    expect(sql).toMatch(/uq_qa_processos_venda_servico[\s\S]*venda_id, servico_id/);
  });

  it("trigger qa_contracts_after_validated chama qa-liberar-servicos-contrato via pg_net", () => {
    const sql = latestMigrationContaining("qa-liberar-servicos-contrato");
    expect(sql).toMatch(/CREATE TRIGGER qa_contracts_after_validated/);
    expect(sql).toMatch(/qa-liberar-servicos-contrato/);
    expect(sql).toMatch(/x-trigger-source['"\s,:]+qa_contract_validated/);
    // Pré-condição financeira no trigger
    expect(sql).toMatch(/upper\(btrim\(v_venda\.status\)\)\s*<>\s*'PAGO'/);
    expect(sql).toMatch(/cobranca_status IS DISTINCT FROM 'confirmada'/);
  });
});

describe("FASE 2C-7 — Arsenal permanece gratuito", () => {
  it("portal e Arsenal não importam gates condicionados a contrato", () => {
    const portal = r("src/pages/quero-armas/QAClientePortalPage.tsx");
    expect(portal).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
    const arsenal = r("src/pages/quero-armas/QAArsenalDigitalGratuitoPage.tsx");
    expect(arsenal).not.toMatch(/ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate/);
  });
});
