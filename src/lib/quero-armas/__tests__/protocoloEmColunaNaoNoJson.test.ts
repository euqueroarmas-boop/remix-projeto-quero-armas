// ============================================================================
// O número do protocolo vive em COLUNA, não dentro do JSON compartilhado.
// ----------------------------------------------------------------------------
// `respostas_questionario_json` é reescrito inteiro (ler → alterar → gravar,
// sem trava) por dez pontos do sistema. O protocolo morava lá dentro, e a tela
// ainda montava o objeto a partir do estado carregado quando a gaveta abriu.
// Duas perdas silenciosas possíveis: some o protocolo, ou somem as respostas do
// checklist — e resposta apagada RESSUSCITA pendência num processo que já está
// na delegacia.
//
// Desde a migration 20260818110000 a verdade são as colunas `protocolo_*`. O
// JSON continua sendo lido como retaguarda para processo antigo.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { protocoloDoProcesso } from "@/components/quero-armas/processos/processoConstants";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("leitura do protocolo", () => {
  it("prefere a coluna quando ela existe", () => {
    const p = protocoloDoProcesso({
      protocolo_numero: "2026.0001234-56",
      protocolo_orgao: "POLICIA_FEDERAL",
      protocolo_data: "2026-08-18",
      respostas_questionario_json: { protocolo: { numero_protocolo: "VELHO-999" } },
    });
    expect(p.numero).toBe("2026.0001234-56");
    expect(p.orgao).toBe("POLICIA_FEDERAL");
    expect(p.data).toBe("2026-08-18");
  });

  it("cai no JSON legado quando a coluna ainda está vazia", () => {
    const p = protocoloDoProcesso({
      respostas_questionario_json: {
        protocolo: {
          numero_protocolo: "LEGADO-123",
          orgao: "EXERCITO",
          data_protocolo: "2026-01-05",
          observacao: "DELEARM/SP",
        },
      },
    });
    expect(p.numero).toBe("LEGADO-123");
    expect(p.orgao).toBe("EXERCITO");
    expect(p.data).toBe("2026-01-05");
    expect(p.observacao).toBe("DELEARM/SP");
  });

  it("aceita a chave antiga `numero` além de `numero_protocolo`", () => {
    expect(
      protocoloDoProcesso({ respostas_questionario_json: { protocolo: { numero: "ANTIGO-1" } } }).numero,
    ).toBe("ANTIGO-1");
  });

  it("string vazia não vale como número", () => {
    const p = protocoloDoProcesso({
      protocolo_numero: "   ",
      respostas_questionario_json: { protocolo: { numero_protocolo: "" } },
    });
    expect(p.numero).toBeNull();
  });

  it("processo sem protocolo nenhum devolve tudo nulo, sem estourar", () => {
    for (const entrada of [null, undefined, {}, { respostas_questionario_json: null }]) {
      const p = protocoloDoProcesso(entrada as never);
      expect(p.numero).toBeNull();
      expect(p.orgao).toBeNull();
      expect(p.data).toBeNull();
    }
  });
});

describe("gravação do protocolo", () => {
  const src = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");
  const bloco = src.slice(
    src.indexOf("const confirmarMarcarProtocolado"),
    src.indexOf("const confirmarPagamentoManual"),
  );

  it("escreve nas colunas", () => {
    for (const col of [
      "protocolo_numero",
      "protocolo_orgao",
      "protocolo_data",
      "protocolo_observacao",
      "protocolo_registrado_em",
      "protocolo_registrado_por",
    ]) {
      expect(bloco, `não grava ${col}`).toContain(`${col}:`);
    }
  });

  it("NÃO reescreve respostas_questionario_json a partir do estado da tela", () => {
    expect(bloco).not.toContain("respostas_questionario_json:");
    expect(bloco).not.toContain("...respostasAtuais");
  });

  it("exige número, ou a marcação explícita de que o órgão não forneceu", () => {
    expect(bloco).toMatch(/!protocoloForm\.numero\.trim\(\) && !protocoloSemNumero/);
  });

  it("o rótulo do campo deixou de dizer OPCIONAL", () => {
    expect(src).not.toContain("NÚMERO DO PROTOCOLO (OPCIONAL)");
  });
});

describe("a migration cria as colunas e faz o backfill", () => {
  const sql = r("supabase/migrations/20260818110000_protocolo_pf_em_colunas.sql");

  it("adiciona as seis colunas de forma reexecutável", () => {
    for (const col of [
      "protocolo_numero",
      "protocolo_orgao",
      "protocolo_data",
      "protocolo_observacao",
      "protocolo_registrado_em",
      "protocolo_registrado_por",
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${col}`);
    }
  });

  it("faz backfill sem sobrescrever o que já estiver preenchido", () => {
    expect(sql).toContain("UPDATE public.qa_processos");
    expect(sql).toMatch(/COALESCE\(\s*\n?\s*p\.protocolo_numero/);
  });

  it("não apaga a chave legada do JSON", () => {
    expect(sql).not.toMatch(/respostas_questionario_json\s*(-|#-)\s*'protocolo'/);
  });
});
