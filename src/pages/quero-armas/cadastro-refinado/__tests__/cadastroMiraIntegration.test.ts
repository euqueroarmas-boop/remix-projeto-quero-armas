/**
 * Grep guard — garante que o fluxo /cadastro (cadastro-refinado) não importe
 * artefatos legados WMTi nem bloqueie o Arsenal, e que os endpoints reais 2C
 * estejam efetivamente chamados pelas etapas.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/pages/quero-armas/cadastro-refinado";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (f === "__tests__") continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx)$/.test(f)) {
      out.push(p);
    }
  }
  return out;
}

const FORBIDDEN = [
  'from("customers")',
  'from("payments")',
  'from("quotes")',
  "post-purchase",
  "ensureClientAccess",
  "create-asaas-payment",
  "create-asaas-subscription",
  "ArsenalGate",
  "ArsenalBlockedPanel",
  "qa_arsenal_access_gate",
];

describe("cadastro-refinado · constraints", () => {
  const files = walk(ROOT);

  it("não importa nenhum artefato WMTi/Arsenal-bloqueio proibido", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const needle of FORBIDDEN) {
        if (src.includes(needle)) offenders.push(`${f} :: ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Etapa04Pagamento chama os 3 endpoints reais do checkout 2C", () => {
    const src = readFileSync(join(ROOT, "steps/Etapa04Pagamento.tsx"), "utf8");
    expect(src).toContain("qa-cliente-criar-conta-publica");
    expect(src).toContain("qa-checkout-criar-venda");
    expect(src).toContain("qa-checkout-iniciar-pagamento");
    expect(src).toContain("qa-checkout-status");
    expect(src).toContain("qa-contract-aceite-registrar");
  });

  it("Etapa05Conclusao não declara 'Pagamento confirmado' incondicionalmente", () => {
    const src = readFileSync(join(ROOT, "steps/Etapa05Conclusao.tsx"), "utf8");
    // O literal só pode aparecer como label dentro de STATUS_META — não como
    // afirmação direta sem checar pagamento_status real.
    expect(src).toContain("STATUS_META");
    expect(src).toContain("aguardando_pagamento");
    expect(src).not.toMatch(/<strong>Acesso enviado<\/strong>\s*—\s*verifique/);
  });

  it("/cadastro-mira renderiza o mesmo componente real de /cadastro (sem dados fake)", () => {
    const routes = readFileSync("src/pages/quero-armas/QARoutes.tsx", "utf8");
    // Não importa nem monta MiraPrototypePage
    expect(routes).not.toMatch(/import\([^)]*MiraPrototypePage[^)]*\)/);
    expect(routes).not.toMatch(/<MiraPrototypePage\s*\/>/);
    // /cadastro-mira usa CadastroRouteSwitch (fluxo real)
    expect(routes).toMatch(/path="cadastro-mira"\s+element=\{<CadastroRouteSwitch\s*\/>\}/);
  });

  it("nenhum arquivo do cadastro-refinado contém dados fake do protótipo Mira", () => {
    const FAKE = [
      "João Carlos da Silva",
      "123.456.789-00",
      "12.345.678-9",
      "Maria Aparecida Silva",
      "Antônio Pedro Silva",
      "Av. Paulista, 1578",
      "01310-100",
      "QA-2026-04891",
    ];
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const needle of FAKE) {
        if (src.includes(needle)) offenders.push(`${f} :: ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("State persiste campos de checkout (venda_id, checkout_token, asaas_invoice_url, billing_type, pagamento_status)", () => {
    const src = readFileSync(join(ROOT, "hooks/useCadastroRefinadoState.ts"), "utf8");
    for (const key of ["checkout_token", "asaas_invoice_url", "asaas_payment_id", "billing_type", "pagamento_status"]) {
      expect(src).toContain(key);
    }
  });

  it("State expõe campos do fluxo 'já tenho conta no Arsenal'", () => {
    const src = readFileSync(join(ROOT, "hooks/useCadastroRefinadoState.ts"), "utf8");
    for (const key of [
      "modo_cliente",
      "cliente_existente_id",
      "dados_carregados_do_arsenal",
      "documentos_reaproveitados",
      "documentos_vencidos",
      "servicos_anteriores",
      "arsenal_resumo",
    ]) {
      expect(src).toContain(key);
    }
  });

  it("QACadastroRefinadoPage monta Etapa00Identificacao antes do wizard quando modo é indefinido", () => {
    const src = readFileSync(join(ROOT, "QACadastroRefinadoPage.tsx"), "utf8");
    expect(src).toContain("Etapa00Identificacao");
    expect(src).toContain("Etapa00bClienteEncontrado");
    expect(src).toMatch(/modo_cliente\s*===\s*"indefinido"/);
  });

  it("Etapa00Identificacao usa OTP do portal existente e não consulta CPF/e-mail diretamente", () => {
    const src = readFileSync(
      join(ROOT, "steps/Etapa00Identificacao.tsx"),
      "utf8",
    );
    expect(src).toContain("cliente-portal-request-otp");
    expect(src).toContain("cliente-portal-verify-otp");
    expect(src).toContain("qa-cadastro-carregar-cliente");
    // anti-enumeração: mensagem genérica
    expect(src).toMatch(/Se encontrarmos uma conta/);
    // não chama tabelas diretas por CPF/email
    expect(src).not.toMatch(/\.from\(["']qa_clientes["']\)/);
  });

  it("Edge function qa-cadastro-carregar-cliente exige Authorization Bearer", () => {
    const src = readFileSync(
      "supabase/functions/qa-cadastro-carregar-cliente/index.ts",
      "utf8",
    );
    expect(src).toContain("Authorization");
    expect(src).toContain("getClaims");
    expect(src).toMatch(/Unauthorized.*401|401.*Unauthorized/s);
  });
});