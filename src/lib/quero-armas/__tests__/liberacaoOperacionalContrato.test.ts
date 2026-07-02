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

function anyMigrationMatches(re: RegExp): boolean {
  const dir = "supabase/migrations";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const txt = readFileSync(join(ROOT, dir, f), "utf8");
    if (re.test(txt)) return true;
  }
  return false;
}

function anyMigrationContainingAll(tokens: RegExp[]): boolean {
  const dir = "supabase/migrations";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const txt = readFileSync(join(ROOT, dir, f), "utf8");
    if (tokens.every((token) => token.test(txt))) return true;
  }
  return false;
}

describe("FASE 2C-7 — qa-liberar-servicos-contrato", () => {
  it("edge function existe e exige contract_id", () => {
    const src = r(FN);
    expect(src).toMatch(/contract_id_required/);
    expect(src).toMatch(/qa_contracts/);
  });

  it("FASE 2C-7.2 — x-trigger-source NÃO autoriza sozinho; exige x-internal-token (release/internal) ou JWT QA", () => {
    const src = r(FN);
    // x-internal-token validado em tempo constante contra QA_CONTRACT_RELEASE_TOKEN
    // (preferencial) ou INTERNAL_FUNCTION_TOKEN (fallback admin/manual).
    expect(src).toMatch(/QA_CONTRACT_RELEASE_TOKEN/);
    expect(src).toMatch(/INTERNAL_FUNCTION_TOKEN/);
    expect(src).toMatch(/timingSafeEqual/);
    // Chamada manual exige staff QA.
    expect(src).toMatch(/requireQAStaff/);
    // x-trigger-source aparece apenas como metadado — NÃO no caminho de autorização.
    const authBlock = src.split("async function authorize")[1]?.split("\n}")[0] ?? "";
    expect(authBlock).not.toMatch(/x-trigger-source/);
    expect(authBlock).not.toMatch(/qa_contract_validated/);
    // Comentário explícito de que trigger-source é metadado.
    expect(src).toMatch(/metadado de auditoria|apenas metadado|NUNCA autoriza/i);
  });

  it("FASE 2C-7.2 — trigger envia x-internal-token vindo do Vault", () => {
    const sql = latestMigrationContaining("qa_contracts_after_validated_release");
    expect(sql).toMatch(/vault\.decrypted_secrets/);
    expect(sql).toMatch(/QA_CONTRACT_RELEASE_TOKEN/);
    expect(sql).toMatch(/'x-internal-token'/);
    expect(sql).toMatch(/qa_contract_release_token_ausente_no_vault/);
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

  it("lookup primário por item_venda_id, fallback por (venda_id, servico_id)", () => {
    const src = r(FN);
    expect(src).toMatch(/qa_solicitacoes_servico/);
    expect(src).toMatch(/\.eq\("item_venda_id",\s*it\.item_venda_id\)/);
    expect(src).toMatch(/\.eq\("venda_id",\s*venda\.id\)[\s\S]*?\.eq\("servico_id",\s*servicoId\)[\s\S]*?\.is\("cadastro_publico_id",\s*null\)/);
    expect(src).toMatch(/origem:\s*"contrato_validado"/);
  });

  it("não sobrescreve solicitação de outra venda; recompra cria nova", () => {
    const src = r(FN);
    // O reuso só atualiza status quando mesmaVenda; e nunca altera venda_id/item_venda_id/servico_id/service_name no UPDATE.
    expect(src).toMatch(/mesmaVenda\s*=\s*existSol\.venda_id\s*===\s*venda\.id/);
    expect(src).toMatch(/liberacao_recompra_mesmo_servico_detectada/);
    expect(src).toMatch(/solicitacao_manual_slug_cliente_ignorada_por_venda_diferente/);
    // Não pode existir UPDATE setando venda_id/item_venda_id de uma solicitação encontrada
    expect(src).not.toMatch(/\.update\(\{[^}]*venda_id:\s*venda\.id[^}]*\}\)\s*\.eq\("id",\s*existSol\.id\)/);
  });

  it("registra eventos de reuso por item_venda e venda_servico", () => {
    const src = r(FN);
    expect(src).toMatch(/solicitacao_servico_reutilizada_por_item_venda/);
    expect(src).toMatch(/solicitacao_servico_reutilizada_por_venda_servico/);
    expect(src).toMatch(/solicitacao_servico_criada_por_item_venda/);
  });

  it("idempotência de qa_processos por (venda_id, servico_id)", () => {
    const src = r(FN);
    expect(src).toMatch(/from\("qa_processos"\)/);
    expect(src).toMatch(/\.eq\("venda_id",\s*venda\.id\)/);
    expect(src).toMatch(/\.eq\("servico_id",\s*servicoId\)/);
  });

  it("resolve cliente canônico real antes de criar solicitação/processo/checklist", () => {
    const src = r(FN);
    expect(src).toMatch(/clienteCanonicoId/);
    expect(src).toMatch(/from\("qa_clientes"\)/);
    expect(src).toMatch(/id_legado\.eq/);
    expect(src).toMatch(/cliente_id:\s*clienteCanonicoId/);
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
    // CREATE TRIGGER e CREATE OR REPLACE FUNCTION podem estar em migrations diferentes
    // (a função é recriada em migration mais recente; o trigger permanece da migration original).
    expect(
      anyMigrationMatches(/CREATE OR REPLACE FUNCTION\s+public\.qa_contracts_after_validated_release/),
    ).toBe(true);
    expect(anyMigrationMatches(/CREATE TRIGGER\s+qa_contracts_after_validated/)).toBe(true);

    // A função pode ser recriada depois por migrations de RLS/compatibilidade;
    // basta existir uma migration completa que configure chamada via pg_net
    // com token interno e pré-condição financeira.
    expect(anyMigrationContainingAll([
      /qa-liberar-servicos-contrato/,
      /pg_net\.http_post|net\.http_post/,
      /x-internal-token/,
      /x-trigger-source['"\s,:]+qa_contract_validated/,
      /upper\(btrim\(v_venda\.status\)\)\s*<>\s*'PAGO'/,
      /cobranca_status IS DISTINCT FROM 'confirmada'/,
    ])).toBe(true);
  });
});

describe("FASE 2C-7.1 — migração de idempotência de solicitações", () => {
  it("cria índices únicos por item_venda_id e (venda_id, servico_id) e restringe legado", () => {
    const sql = latestMigrationContaining("uq_qa_solicitacoes_item_venda");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_solicitacoes_item_venda[\s\S]*item_venda_id[\s\S]*WHERE item_venda_id IS NOT NULL/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_solicitacoes_venda_servico[\s\S]*\(venda_id, servico_id\)[\s\S]*cadastro_publico_id IS NULL/);
    expect(sql).toMatch(/DROP INDEX IF EXISTS public\.uq_qa_solicitacoes_cli_slug_manual/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX uq_qa_solicitacoes_cli_slug_manual[\s\S]*venda_id IS NULL/);
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
