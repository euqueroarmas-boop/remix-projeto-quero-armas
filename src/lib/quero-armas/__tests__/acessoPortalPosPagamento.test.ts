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
      // Sem imports / invokes para módulos WMTi proibidos
      expect(src).not.toMatch(/from\s+["'][^"']*post-purchase[^"']*["']/);
      expect(src).not.toMatch(/invoke\(["']post-purchase/);
      expect(src).not.toMatch(/\bensureClientAccess\s*\(/);
      expect(src).not.toMatch(/invoke\(["']ensure-client-access/);
      expect(src).not.toMatch(/from\s+["'][^"']*ensureClientAccess[^"']*["']/);
    });

    it("usa qa_clientes como fonte de verdade", () => {
      expect(src).toMatch(/from\(\s*["']qa_clientes["']/);
    });

    it("é idempotente: respeita portal_provisionado_em e LGPD", () => {
      expect(src).toMatch(/portal_provisionado_em/);
      expect(src).toMatch(/excluido_lgpd/);
    });

    it("não reseta senha de Auth User existente no pós-pagamento", () => {
      expect(src).not.toMatch(/updateUserById\([\s\S]*password:\s*tempPwd/);
      expect(src).toMatch(/NUNCA resetamos a senha automaticamente/);
    });

    /**
     * DECISÃO DE PRODUTO (14/08/2026): a senha provisória VAI no e-mail de
     * boas-vindas (template credenciais-portal), para o cliente entrar em um
     * clique. A regra antiga — "nunca enviar senha em texto puro" — foi
     * revertida de propósito, e este bloco passou a vigiar o que torna esse
     * envio aceitável, em vez de proibi-lo:
     *
     *   1. a senha é DESCARTÁVEL: troca obrigatória no primeiro acesso;
     *   2. a senha guardada no banco tem TTL e some sozinha;
     *   3. quem já tem conta no Auth nunca tem a senha resetada;
     *   4. login social não usa essa senha.
     *
     * Se um dia a decisão voltar atrás, é este bloco que muda.
     */
    it("a senha provisória do e-mail é descartável: troca obrigatória no 1º acesso", () => {
      // Sem esta flag no metadata, a senha enviada por e-mail valeria por tempo
      // indeterminado na caixa de entrada do cliente.
      expect(src).toMatch(/password_change_required:\s*true/);

      // E o portal precisa realmente travar com base nela.
      const portal = r("src/pages/quero-armas/QAClientePortalPage.tsx");
      expect(portal).toMatch(/function deveForcarTrocaSenha/);
      expect(portal).toMatch(/user_metadata\?\.password_change_required !== true/);
      expect(portal).toMatch(/setMustChangePassword\(true\)/);
      expect(portal).toMatch(/ForcePasswordChangeModal/);

      // Login social não usa a senha temporária do Arsenal.
      expect(portal).toMatch(/google|apple/i);

      // Depois da troca, a flag é limpa — o cliente não fica preso no modal.
      const modal = r("src/components/quero-armas/clientes/ForcePasswordChangeModal.tsx");
      expect(modal).toMatch(/password_change_required:\s*false/);
    });

    it("a senha provisória guardada no banco expira sozinha", () => {
      expect(src).toMatch(/senha_temporaria_expira_em/);
      expect(src).toMatch(/24 \* 60 \* 60 \* 1000/);
    });

    it("o e-mail de credenciais só sai com senha temporária, nunca com a definitiva", () => {
      // O único caminho de senha para o e-mail é a coluna senha_temporaria.
      expect(src).toMatch(/templateName: "credenciais-portal"/);
      expect(src).toMatch(/senhaProvisoria: clienteAtualizado\?\.senha_temporaria/);
      // Cliente que já tinha conta não recebe senha nenhuma: cai no fallback.
      expect(src).toMatch(/\(use Esqueci minha senha\)/);
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
      // A URL invocada NÃO é create-client-user; só pode aparecer em
      // comentário SQL "--", nunca dentro de v_function_url.
      const fnUrlLine = sql.match(/v_function_url\s*:=\s*'[^']+'/);
      expect(fnUrlLine).not.toBeNull();
      expect(fnUrlLine![0]).toMatch(/qa-provisionar-acesso-portal/);
      expect(fnUrlLine![0]).not.toMatch(/create-client-user/);
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

    it("popup de contrato pendente leva para a seção de contratos", () => {
      const src = r("src/pages/quero-armas/QAClientePortalPage.tsx");
      expect(src).toMatch(/goContractsSection/);
      expect(src).toMatch(/\/area-do-cliente\?secao=contratos/);
      expect(src).toMatch(/id="qa-portal-contratos"/);
    });

    it("portal prioriza obrigações antes do assistente de compra", () => {
      const src = r("src/pages/quero-armas/QAClientePortalPage.tsx");
      expect(src).toMatch(/portalStartupAction/);
      expect(src).toMatch(/pendingContractsLoaded/);
      // O contador de contratos pendentes virou `pendingSignatureCount`; o que
      // este teste garante é a PRIORIDADE, não o nome da variável — por isso a
      // asserção olha o retorno `type: "contrato"` como primeira saída da
      // função, e não uma linha literal que qualquer refactor derruba.
      expect(src).toMatch(/if \(pendingSignatureCount > 0\) return \{ type: "contrato"/);
      expect(src).toMatch(/entrada_wizard/);
      expect(src.indexOf('type: "contrato"')).toBeLessThan(src.indexOf('type: "entrada_wizard"'));
      expect(src).toMatch(/Obrigações do cliente sempre aparecem antes do assistente de compra/);
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
