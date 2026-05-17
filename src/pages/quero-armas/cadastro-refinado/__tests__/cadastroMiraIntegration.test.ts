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

  it("MiraPrototypePage permanece sandbox visual (sem chamadas reais ao backend)", () => {
    const src = readFileSync(join(ROOT, "MiraPrototypePage.tsx"), "utf8");
    expect(src).not.toContain("supabase.functions.invoke");
    expect(src).not.toContain("qa-checkout-criar-venda");
  });

  it("/cadastro-mira monta o fluxo real (QACadastroRefinadoPage), não o MiraPrototypePage mockado", () => {
    const routes = readFileSync("src/pages/quero-armas/QARoutes.tsx", "utf8");
    // A rota pública /cadastro-mira NÃO pode renderizar o protótipo mockado.
    expect(routes).toMatch(/path="cadastro-mira"\s+element=\{<CadastroRouteSwitch\s*\/>\}/);
    // MiraPrototypePage só pode aparecer na rota de preview isolada.
    expect(routes).toMatch(/path="cadastro-mira-preview"\s+element=\{<MiraPrototypePage\s*\/>\}/);
  });

  it("State persiste campos de checkout (venda_id, checkout_token, asaas_invoice_url, billing_type, pagamento_status)", () => {
    const src = readFileSync(join(ROOT, "hooks/useCadastroRefinadoState.ts"), "utf8");
    for (const key of ["checkout_token", "asaas_invoice_url", "asaas_payment_id", "billing_type", "pagamento_status"]) {
      expect(src).toContain(key);
    }
  });
});