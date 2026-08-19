import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CERTIDOES_90_DIAS,
  CERTIDOES_UM_MES,
  prazoCatalogoCertidao,
  regraValidadeCertidao,
} from "../validadeCertidoes";

/* =============================================================================
 * O critério do usuário (19/08/2026): certidão que TRAZ validade impressa vale
 * 90 dias; certidão que NÃO traz vale um mês.
 *
 * Os quatro tipos de 90 dias são exatamente os que têm parser lendo o prazo de
 * dentro do PDF. Este teste amarra as duas pontas — se alguém adicionar um tipo
 * à tabela dos 90 sem que exista leitura correspondente, ou vice-versa, quebra.
 * ========================================================================== */

const PARSERS = readFileSync(resolve(__dirname, "../parsersCertidoes.ts"), "utf8");

describe("tabela de validade das certidões", () => {
  it("as que declaram prazo no PDF valem 90 dias", () => {
    for (const tipo of [
      "antecedentes_federal_trf3_regional",
      "antecedentes_federal_sjsp_jef",
      "antecedentes_militar",
      "antecedentes_militar_estadual",
    ]) {
      expect(regraValidadeCertidao(tipo)).toBe("90_dias");
      expect(prazoCatalogoCertidao(tipo)).toBe(90);
    }
  });

  it("as que não declaram prazo valem um mês", () => {
    for (const tipo of [
      "antecedentes_criminais",
      "antecedentes_estadual_distribuicao",
      "antecedentes_estadual_execucoes",
      "antecedentes_eleitoral",
    ]) {
      expect(regraValidadeCertidao(tipo)).toBe("um_mes");
      expect(prazoCatalogoCertidao(tipo)).toBe(30);
    }
  });

  it("SJSP/JEF e TRF3 Regional andam juntas — são a mesma certidão do mesmo tribunal", () => {
    // O defeito de origem: a SJSP/JEF estava no grupo de um mês enquanto a
    // Regional, do mesmo parser, estava no de 90. Cinco arquivos no acervo
    // ficaram com 90 e dois com 31, decidido por o PDF ter saído legível.
    expect(regraValidadeCertidao("antecedentes_federal_sjsp_jef")).toBe(
      regraValidadeCertidao("antecedentes_federal_trf3_regional"),
    );
  });

  it("os dois grupos não se sobrepõem", () => {
    for (const t of CERTIDOES_90_DIAS) {
      expect(CERTIDOES_UM_MES.has(t)).toBe(false);
    }
  });

  it("o que não é certidão de antecedentes não recebe regra", () => {
    for (const tipo of ["comprovante_residencia", "renda_holerite_mes_atual", "cr", "", null]) {
      expect(regraValidadeCertidao(tipo)).toBeNull();
      expect(prazoCatalogoCertidao(tipo)).toBeNull();
    }
  });

  it("aceita variação de caixa e espaço", () => {
    expect(regraValidadeCertidao("  ANTECEDENTES_MILITAR  ")).toBe("90_dias");
  });
});

describe("a tabela dos 90 dias corresponde ao que os parsers leem", () => {
  // Três parsers extraem `validade_dias` do texto do PDF. O do TRF cobre AS
  // DUAS certidões federais (SJSP/JEF e Regional) — daí os quatro tipos.
  it("existem exatamente três leituras de prazo nos parsers", () => {
    const leituras = PARSERS.match(/validade_dias:\s*numOrUndef/g) ?? [];
    expect(leituras).toHaveLength(3);
  });

  it("o parser do TRF produz os dois tipos federais", () => {
    expect(PARSERS).toContain('"antecedentes_federal_sjsp_jef"');
    expect(PARSERS).toContain('"antecedentes_federal_trf3_regional"');
  });

  it("SSP, TJSP e TSE não leem prazo — por isso são o grupo de um mês", () => {
    // Se algum dia um desses ganhar leitura de prazo, este teste cai e a
    // tabela precisa ser revista junto.
    for (const trecho of ['tipoDocumento: "antecedentes_criminais"', 'orgao: "tse"']) {
      const i = PARSERS.indexOf(trecho);
      expect(i).toBeGreaterThan(-1);
      const bloco = PARSERS.slice(i, i + 900);
      expect(bloco).not.toContain("validade_dias");
    }
  });
});

describe("o Hub usa a tabela, e não uma segunda lista", () => {
  const MODAL = readFileSync(
    resolve(__dirname, "../../../components/quero-armas/clientes/ClienteDocsHubModal.tsx"),
    "utf8",
  );

  it("calcularValidadeHubPorTipo consulta regraValidadeCertidao", () => {
    expect(MODAL).toContain("regraValidadeCertidao(tipo)");
  });

  it("não sobrou lista de certidões escrita à mão dentro do componente", () => {
    // A lista antiga colocava sjsp_jef junto das de um mês. Se voltar, some
    // com a única fonte da tabela e o defeito volta calado.
    expect(MODAL).not.toContain('"antecedentes_estadual_distribuicao",\n      "antecedentes_estadual_execucoes",');
  });

  it("o prazo lido do PDF continua tendo precedência sobre a tabela", () => {
    // No ramo da certidão: doc.validade_dias vem do PDF e ganha do fallback.
    expect(MODAL).toMatch(/doc\.data_emissao && doc\.validade_dias/);
  });
});
