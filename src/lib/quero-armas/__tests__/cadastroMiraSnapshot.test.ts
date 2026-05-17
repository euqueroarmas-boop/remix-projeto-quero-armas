/**
 * Cadastro Mira → snapshot operacional em qa_cadastro_publico.
 * Testes de regressão por inspeção de fonte (sem DB), garantindo que:
 *  - existe edge function qa-cadastro-mira-snapshot;
 *  - valida payload com zod (status enum, dados pessoais mínimos);
 *  - grava origem_cadastro='cadastro_mira' e usa service_role;
 *  - faz dedupe por CPF/email em status em andamento;
 *  - grava paths de documentos (identidade/comprovante/selfie);
 *  - grava cliente_id_vinculado quando informado;
 *  - é chamada nas Etapas 02 (documentos_enviados), 03 (revisao_cliente)
 *    e 04 (aguardando_pagamento) do /cadastro Mira;
 *  - NÃO toca qa-checkout-*, qa-asaas-webhook, qa-generate-contract,
 *    qa-provisionar-acesso-portal, post-purchase, ensureClientAccess;
 *  - NÃO toca WMTi (customers/payments/contracts/quotes);
 *  - NÃO bloqueia Arsenal (Arsenal continua gratuito);
 *  - filtros da Equipe (MonitorCadastrosDocumentos, QAClientesPage)
 *    incluem cadastro_mira porque não filtram por origem_cadastro.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const r = (p: string) => readFileSync(join(ROOT, p), "utf8");

const FN = "supabase/functions/qa-cadastro-mira-snapshot/index.ts";
const HELPER = "src/lib/quero-armas/cadastroMiraSnapshot.ts";
const E02 = "src/pages/quero-armas/cadastro-refinado/steps/Etapa02Documentos.tsx";
const E03 = "src/pages/quero-armas/cadastro-refinado/steps/Etapa03Revisao.tsx";
const E04 = "src/pages/quero-armas/cadastro-refinado/steps/Etapa04Pagamento.tsx";
const MONITOR = "src/components/quero-armas/clientes/MonitorCadastrosDocumentos.tsx";
const QACLI = "src/pages/quero-armas/QAClientesPage.tsx";

describe("FASE Mira — snapshot operacional em qa_cadastro_publico", () => {
  describe("Edge function qa-cadastro-mira-snapshot", () => {
    const src = r(FN);
    it("existe e usa service_role + supabase-js", () => {
      expect(existsSync(join(ROOT, FN))).toBe(true);
      expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(src).toMatch(/@supabase\/supabase-js/);
    });
    it("valida payload com zod (status enum + dados mínimos)", () => {
      expect(src).toMatch(/from\s+["']https:\/\/deno\.land\/x\/zod/);
      expect(src).toMatch(/em_preenchimento/);
      expect(src).toMatch(/documentos_enviados/);
      expect(src).toMatch(/revisao_cliente/);
      expect(src).toMatch(/aguardando_pagamento/);
      expect(src).toMatch(/concluido/);
      expect(src).toMatch(/abandonado/);
      expect(src).toMatch(/nome_completo:\s*z\.string/);
      expect(src).toMatch(/cpf:\s*z\.string/);
      expect(src).toMatch(/email:\s*z\.string\(\)\.email/);
      expect(src).toMatch(/telefone_principal:\s*z\.string/);
    });
    it("retorna 400 quando payload inválido", () => {
      expect(src).toMatch(/invalid_payload[\s\S]*?400/);
    });
    it("grava origem_cadastro='cadastro_mira'", () => {
      expect(src).toMatch(/origem_cadastro["']?\s*:\s*["']cadastro_mira["']/);
    });
    it("faz dedupe por CPF/email em status em andamento", () => {
      expect(src).toMatch(/STATUS_EM_ANDAMENTO/);
      expect(src).toMatch(/cpf\.eq\.\$\{cpf\},email\.eq\.\$\{email\}/);
      expect(src).toMatch(/\.in\(["']status["']/);
      expect(src).toMatch(/updated_existing/);
    });
    it("atualiza por snapshot_id quando fornecido (idempotente)", () => {
      expect(src).toMatch(/snapshot_id:\s*z\.string\(\)\.uuid\(\)\.optional/);
      expect(src).toMatch(/\.update\(rowForUpdate\)[\s\S]*?\.eq\(["']id["'],\s*p\.snapshot_id\)/);
    });
    it("grava paths de documentos (identidade/comprovante/selfie)", () => {
      expect(src).toMatch(/documento_identidade_path/);
      expect(src).toMatch(/comprovante_endereco_path/);
      expect(src).toMatch(/selfie_path/);
    });
    it("grava cliente_id_vinculado quando informado", () => {
      expect(src).toMatch(/cliente_id_vinculado:\s*p\.cliente_id_vinculado/);
    });
    it("NÃO altera qa_clientes nem chama checkout/contract/processo/checklist", () => {
      expect(src).not.toMatch(/from\(["']qa_clientes["']\)/);
      // Garante que NÃO há invocações/imports para esses módulos
      // (referências em comentários de documentação são permitidas).
      expect(src).not.toMatch(/invoke\(["']qa-checkout-/);
      expect(src).not.toMatch(/invoke\(["']qa-asaas-webhook/);
      expect(src).not.toMatch(/invoke\(["']qa-generate-contract/);
      expect(src).not.toMatch(/invoke\(["']qa-provisionar-acesso-portal/);
      expect(src).not.toMatch(/import[\s\S]*?post-purchase/);
      expect(src).not.toMatch(/import[\s\S]*?ensureClientAccess/);
    });
    it("NÃO toca WMTi (customers/payments/contracts/quotes)", () => {
      expect(src).not.toMatch(/from\(["'](?:customers|payments|contracts|quotes)["']\)/);
    });
    it("NÃO bloqueia Arsenal", () => {
      expect(src).not.toMatch(/arsenal_plano/);
      expect(src).not.toMatch(/qa_arsenal_access_gate/);
    });
  });

  describe("Helper client + integração nas Etapas", () => {
    it("helper existe e nunca rejeita o fluxo", () => {
      const src = r(HELPER);
      expect(src).toMatch(/qa-cadastro-mira-snapshot/);
      expect(src).toMatch(/try\s*{[\s\S]*?invoke/);
      expect(src).toMatch(/catch[\s\S]*?console\.warn/);
    });
    it("Etapa02 dispara snapshot com status 'documentos_enviados'", () => {
      const src = r(E02);
      expect(src).toMatch(/enviarSnapshotCadastroMira/);
      expect(src).toMatch(/documentos_enviados/);
    });
    it("Etapa03 dispara snapshot com status 'revisao_cliente'", () => {
      const src = r(E03);
      expect(src).toMatch(/enviarSnapshotCadastroMira/);
      expect(src).toMatch(/revisao_cliente/);
    });
    it("Etapa04 dispara snapshot com status 'aguardando_pagamento' + cliente_id_vinculado + venda_id", () => {
      const src = r(E04);
      expect(src).toMatch(/enviarSnapshotCadastroMira/);
      expect(src).toMatch(/aguardando_pagamento/);
      expect(src).toMatch(/cliente_id_vinculado:\s*clienteIdFinal/);
      expect(src).toMatch(/venda_id:\s*vendaId/);
    });
  });

  describe("Painel da Equipe inclui cadastro_mira sem quebrar legado", () => {
    it("MonitorCadastrosDocumentos não filtra por origem_cadastro='cadastro_publico'", () => {
      const src = r(MONITOR);
      expect(src).not.toMatch(/origem_cadastro["']?\s*,\s*["']cadastro_publico["']/);
      expect(src).not.toMatch(/\.eq\(\s*["']origem_cadastro["']\s*,\s*["']cadastro_publico["']/);
    });
    it("QAClientesPage não filtra por origem_cadastro='cadastro_publico'", () => {
      const src = r(QACLI);
      expect(src).not.toMatch(/\.eq\(\s*["']origem_cadastro["']\s*,\s*["']cadastro_publico["']/);
    });
  });
});