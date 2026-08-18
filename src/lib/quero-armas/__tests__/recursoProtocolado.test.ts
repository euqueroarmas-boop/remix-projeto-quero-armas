// ============================================================================
// F10 — o recurso ganha número, data e fim
// ----------------------------------------------------------------------------
// Achado da auditoria, 18/08/2026: `qa_processo_recursos.numero_protocolo` e
// `protocolado_em` existem desde que a tabela nasceu e NENHUM código jamais
// escreveu neles. O ciclo do recurso terminava em `enviado_equipe`: o cliente
// aprovava o relato, a equipe protocolava na delegacia — e para ele a tela
// dizia "aprovado" para sempre, sem número, sem data, sem nada que ele pudesse
// conferir no site da PF.
//
// E havia um segundo furo escondido nesse: `qa_itens_venda
// .data_recurso_administrativo` — a coluna que FECHA o prazo de 10 dias no
// motor de alertas — só era preenchida quando alguém lembrava de colar uma
// manifestação com status "recurso protocolado". Passo manual, fácil de
// esquecer, e o preço era o cliente recebendo "prazo VENCIDO" num processo em
// que a equipe já tinha recorrido dentro do prazo.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("a edge registra o protocolo do recurso", () => {
  const src = r("supabase/functions/qa-recurso-protocolar/index.ts");

  it("é ação de equipe", () => {
    expect(src).toMatch(/requireQAStaff/);
  });

  it("grava enfim as duas colunas que nunca foram escritas", () => {
    expect(src).toMatch(/numero_protocolo: numero/);
    expect(src).toMatch(/protocolado_em: agora/);
    expect(src).toMatch(/status: "protocolado"/);
  });

  it("o número é obrigatório — sem ele o cliente volta a não ter o que conferir", () => {
    expect(src).toMatch(/numero_protocolo_obrigatorio/);
  });

  it("não protocola recurso que o cliente ainda não aprovou", () => {
    expect(src).toMatch(/recurso_nao_aprovado_pelo_cliente/);
    expect(src).toMatch(/\["aprovado", "enviado_equipe"\]\.includes\(statusAtual\)/);
  });

  it("é idempotente", () => {
    expect(src).toMatch(/if \(statusAtual === "protocolado"\)/);
    expect(src).toMatch(/ja_protocolado: true/);
  });

  it("o processo volta para a análise da PF", () => {
    expect(src).toMatch(/status: "recurso_administrativo"/);
  });
});

describe("protocolar o recurso FECHA o prazo de 10 dias no mesmo ato", () => {
  const src = r("supabase/functions/qa-recurso-protocolar/index.ts");

  it("grava data_recurso_administrativo na venda", () => {
    expect(src).toMatch(/data_recurso_administrativo: dataProtocolo/);
    expect(src).toMatch(/from\("qa_itens_venda"\)/);
  });

  it("faz a tradução venda_id → id_legado, que quebra silenciosamente sem ela", () => {
    // qa_processos.venda_id aponta para qa_vendas.id; qa_itens_venda.venda_id
    // aponta para qa_vendas.id_legado. Comparar direto casa nos clientes novos
    // e falha justo nos vindos do sistema antigo.
    expect(src).toMatch(/id_legado/);
    expect(src).toMatch(/const fkVenda/);
  });

  it("usa a data informada, não a de hoje — o prazo corre do protocolo real", () => {
    expect(src).toMatch(/\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(dataInformada\)/);
  });

  it("falha no prazo NÃO derruba o protocolo — devolve aviso", () => {
    expect(src).toMatch(/prazo_fechado/);
    expect(src).toMatch(/prazo_aviso/);
  });

  it("o resultado do lançamento fica na auditoria", () => {
    expect(src).toMatch(/tipo_evento: "recurso_protocolado"/);
    expect(src).toMatch(/prazo_fechado: prazoFechado/);
  });
});

describe("a equipe registra pelo painel", () => {
  const src = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");

  it("carrega o recurso do processo", () => {
    expect(src).toContain('from("qa_processo_recursos")');
    expect(src).toMatch(/carregarRecurso/);
  });

  it("o botão só aparece depois da aprovação do cliente", () => {
    expect(src).toMatch(/\["aprovado", "enviado_equipe"\]\.includes\(String\(recurso\.status\)\)/);
    expect(src).toContain("REGISTRAR PROTOCOLO DO RECURSO");
  });

  it("já protocolado mostra número e data em vez do botão", () => {
    expect(src).toMatch(/recurso\.status === "protocolado"/);
    expect(src).toMatch(/recurso\.numero_protocolo/);
  });

  it("avisa quando o prazo não foi lançado — senão o contador segue correndo", () => {
    expect(src).toMatch(/if \(!resp\.prazo_fechado\)/);
    expect(src).toMatch(/prazo não foi lançado na venda/);
  });

  it("explica que a data é a do protocolo real, não a de hoje", () => {
    expect(src).toMatch(/USE A DATA REAL DO PROTOCOLO/);
  });
});

describe("o cliente vê o número", () => {
  const linha = r("src/components/quero-armas/portal/LinhaDoTempoProcessoPF.tsx");
  const portal = r("src/pages/quero-armas/QAClientePortalPage.tsx");

  it("a linha do tempo aceita e mostra o protocolo do recurso", () => {
    expect(linha).toMatch(/recursoProtocolo\?: \{ numero: string \| null; protocoladoEm: string \| null \}/);
    expect(linha).toContain("Recurso protocolado sob o nº");
  });

  it("o portal busca as colunas e repassa", () => {
    expect(portal).toMatch(/numero_protocolo, protocolado_em/);
    expect(portal).toMatch(/recursoProtocolo=\{/);
  });

  it("o e-mail de recurso protocolado existe e está registrado", () => {
    const tpl = r("supabase/functions/_shared/transactional-email-templates/recurso-protocolado.tsx");
    expect(tpl).toMatch(/Nº do protocolo/);
    expect(tpl).toMatch(/status="(critico|alerta|ok)"/);
    const reg = r("supabase/functions/_shared/transactional-email-templates/registry.ts");
    expect(reg).toMatch(/'recurso-protocolado': recursoProtocolado,/);
  });
});
