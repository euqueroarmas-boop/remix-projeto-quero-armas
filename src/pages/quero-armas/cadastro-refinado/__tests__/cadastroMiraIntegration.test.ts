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
    // Nova regra: identificação só é pulada com flag explícita na sessão,
    // autenticação carregada ou ?retomar=1.
    expect(src).toContain("identificacao_confirmada");
    expect(src).toContain('params.get("retomar")');
    expect(src).toMatch(/modo_cliente\s*===\s*"autenticado"/);
    expect(src).toContain("dados_carregados_do_arsenal");
    // Não pode mais pular identificação só porque há ?servico= na URL.
    expect(src).not.toMatch(/if\s*\(\s*params\.get\(["']servico["']\)\s*\)\s*return\s+1\s*;/);
  });

  it("Estado expõe flag identificacao_confirmada e ela começa em false", () => {
    const src = readFileSync(join(ROOT, "hooks/useCadastroRefinadoState.ts"), "utf8");
    expect(src).toContain("identificacao_confirmada");
    expect(src).toMatch(/identificacao_confirmada:\s*false/);
  });

  it("Etapa00Escolha aceita atalho onAbrirIdentificacao e renderiza 'Já tenho conta no Arsenal'", () => {
    const src = readFileSync(join(ROOT, "steps/Etapa00Escolha.tsx"), "utf8");
    expect(src).toContain("onAbrirIdentificacao");
    expect(src).toContain("Já tenho conta no Arsenal");
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

  it("Etapa02Documentos expõe CTAs de substituição (Substituir / Enviar novo / Enviar outro)", () => {
    const src = readFileSync(join(ROOT, "steps/Etapa02Documentos.tsx"), "utf8");
    expect(src).toContain("qa-cadastro-substituir-documento");
    expect(src).toContain("Substituir");
    expect(src).toContain("Enviar novo");
    expect(src).toContain("Enviar outro");
    // Não pode deletar doc do servidor a partir da substituição
    expect(src).not.toMatch(/\.from\(["']qa_documentos_cliente["']\)\.delete\(\)/);
    // 20MB hard cap
    expect(src).toContain("20 * 1024 * 1024");
  });

  it("Edge function qa-cadastro-substituir-documento é não-destrutiva e auditada", () => {
    const src = readFileSync(
      "supabase/functions/qa-cadastro-substituir-documento/index.ts",
      "utf8",
    );
    // Auth obrigatória
    expect(src).toContain("unauthorized");
    expect(src).toContain("Authorization");
    // Recusa ramificação
    expect(src).toContain("ja_substituido");
    // Insere novo com referência ao anterior + nova versão
    expect(src).toContain("substitui_documento_id");
    expect(src).toContain("versao");
    expect(src).toContain('status: "pendente_aprovacao"');
    expect(src).toContain('origem: "cliente"');
    // Anterior é apenas marcado, nunca deletado
    expect(src).toContain("substituido_por_documento_id");
    expect(src).toContain("substituido_em");
    expect(src).not.toMatch(/\.from\(["']qa_documentos_cliente["']\)\s*\.delete\(\)\s*\.eq\(["']id["'],\s*anterior/);
    // Auditoria
    expect(src).toContain("qa_status_eventos");
    expect(src).toContain("qa_logs_auditoria");
    expect(src).toContain("cadastro_mira");
    // Não toca checkout / contrato / processo / WMTi
    for (const forbidden of [
      "post-purchase",
      "ensureClientAccess",
      "qa-checkout-",
      "qa-generate-contract",
      "qa-provisionar-acesso-portal",
      "qa-liberar-servicos-contrato",
      "qa_arsenal_access_gate",
    ]) {
      expect(src).not.toContain(forbidden);
    }
  });
});