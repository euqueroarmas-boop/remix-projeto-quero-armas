// ============================================================================
// A juntada tem que ser ALCANÇÁVEL. E protocolar exige que ela exista.
// ----------------------------------------------------------------------------
// Furo mais grave do fim do fluxo, medido em 18/08/2026:
//
//   `qa-montar-juntada` monta o PDF único que vai para a Polícia Federal (42,
//   55 e 106 páginas nos casos reais), sobe para o storage e gravava o caminho
//   APENAS dentro do `dados_json` de um evento. Nenhuma linha do front lia dali.
//   A equipe clicava, via o toast de sucesso, e não existia botão, link ou tela
//   que abrisse o arquivo — nem para ela, nem para o cliente. Só pelo console
//   do Supabase.
//
//   E o checklist tem o item `juntada_assinada`, em que o cliente precisa
//   assinar a juntada no gov.br: uma exigência impossível de cumprir, porque
//   ele nunca recebia o arquivo.
//
// Além disso, "MARCAR COMO PROTOCOLADO" não exigia nada: nem juntada montada,
// nem assinatura, nem número.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("a edge function registra a juntada numa tabela", () => {
  const src = r("supabase/functions/qa-montar-juntada/index.ts");

  it("insere em qa_processo_juntadas", () => {
    expect(src).toContain('from("qa_processo_juntadas")');
    expect(src).toMatch(/\.insert\(\{[\s\S]*storage_path: destino/);
  });

  it("guarda o que entrou e o que ficou de fora", () => {
    expect(src).toMatch(/itens_json:/);
    expect(src).toMatch(/ignorados_json:/);
  });

  it("versiona: remontar não sobrescreve a juntada anterior", () => {
    expect(src).toMatch(/\.order\("versao", \{ ascending: false \}\)/);
    expect(src).toMatch(/const versao = Number\(/);
  });

  it("devolve o id da juntada para quem chamou", () => {
    expect(src).toMatch(/juntada_id:/);
  });

  it("falha de registro não descarta o PDF já subido", () => {
    // O arquivo está no storage: devolver erro aqui perderia uma juntada que
    // existe. Avisa no log e no evento, e segue.
    expect(src).toMatch(/if \(juntadaErr\) \{/);
    expect(src).toMatch(/registro_ok/);
  });

  it("a juntada continua não entrando em si mesma", () => {
    expect(src).toMatch(/t === "juntada_assinada" \|\| t === "credencial_gov_br"/);
  });
});

describe("o painel da equipe consegue abrir a juntada", () => {
  const src = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");

  it("carrega a versão vigente do processo", () => {
    expect(src).toContain('from("qa_processo_juntadas")');
    expect(src).toMatch(/carregarJuntada/);
  });

  it("abre pelo visualizador interno, nunca por URL do Supabase", () => {
    // mem://constraints/no-supabase-url-leak — proibido window.open(signedUrl).
    expect(src).toMatch(/viewer\.abrirStorage\(juntada\.bucket, juntada\.storage_path/);
    expect(src).not.toMatch(/window\.open\([^)]*signed/i);
  });

  it("mostra o que ficou de fora do dossiê", () => {
    expect(src).toContain("FICOU DE FORA");
  });

  it("recarrega a juntada logo depois de montar", () => {
    const bloco = src.slice(src.indexOf("const montarJuntada"), src.indexOf("const confirmarMarcarProtocolado"));
    expect(bloco).toMatch(/await carregarJuntada\(\)/);
  });
});

describe("protocolar exige a juntada", () => {
  const src = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");
  const bloco = src.slice(
    src.indexOf("const confirmarMarcarProtocolado"),
    src.indexOf("const confirmarPagamentoManual"),
  );

  it("bloqueia quando não há juntada montada", () => {
    expect(bloco).toMatch(/!juntada && !protocoloSemJuntada/);
  });

  it("permite o escape consciente, e ele fica na auditoria", () => {
    expect(bloco).toMatch(/sem_juntada_no_sistema/);
    expect(bloco).toMatch(/juntada_versao/);
  });

  it("continua exigindo o número do protocolo", () => {
    expect(bloco).toMatch(/!protocoloForm\.numero\.trim\(\) && !protocoloSemNumero/);
  });
});

describe("a migration cria a tabela com as travas certas", () => {
  const sql = r("supabase/migrations/20260818120000_qa_processo_juntadas.sql");

  it("é reexecutável", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.qa_processo_juntadas");
    expect(sql).toContain("DROP POLICY IF EXISTS");
  });

  it("morre junto com o processo", () => {
    expect(sql).toMatch(/REFERENCES public\.qa_processos\(id\) ON DELETE CASCADE/);
  });

  it("não deixa duas juntadas com a mesma versão no mesmo processo", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[\s\S]*\(processo_id, versao\)/);
  });

  it("o cliente lê a juntada dele — é ela que ele assina no gov.br", () => {
    expect(sql).toContain("qa_juntadas_cliente_select");
    expect(sql).toMatch(/FOR SELECT TO authenticated/);
    expect(sql).toContain("qa_current_cliente_id");
  });

  it("cliente não escreve: quem monta é a edge com service role", () => {
    const bloco = sql.slice(sql.indexOf("qa_juntadas_cliente_select"), sql.indexOf("COMMIT;"));
    expect(bloco).not.toContain("FOR ALL");
    expect(bloco).not.toContain("WITH CHECK");
  });
});
