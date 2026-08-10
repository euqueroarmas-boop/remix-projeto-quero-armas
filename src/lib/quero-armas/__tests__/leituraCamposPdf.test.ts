/* =============================================================================
 * Regressão das rejeições "a certidão não traz Nome".
 *
 * Os textos abaixo reproduzem os dois defeitos reais observados na certidão do
 * TSE de um mesmo cliente: nome colado no campo seguinte e nome não localizado.
 * ============================================================================= */
import { describe, it, expect } from "vitest";
import {
  reconstruirLinhasPdf,
  lerNomeRotulado,
  pareceNomePessoa,
  cortarValorCampo,
  valorDoCadastroPresenteNoTexto,
  type ItemTextoPdf,
} from "../leituraCamposPdf";
import { parseCertidao } from "../parsersCertidoes";

const frag = (str: string, x: number, y: number, width = str.length * 4, hasEOL = false): ItemTextoPdf =>
  ({ str, width, hasEOL, transform: [1, 0, 0, 1, x, y] });

describe("reconstruirLinhasPdf", () => {
  it("mantém uma linha por linha impressa, mesmo sem hasEOL", () => {
    const texto = reconstruirLinhasPdf([
      frag("Eleitor(a):", 40, 700),
      frag("PEDRO LOBATO DE LIMA", 110, 700),
      frag("Ocupação declarada pelo(a) eleitor(a):", 40, 680),
      frag("ESTUDANTE", 260, 680),
    ]);
    expect(texto.split("\n")).toHaveLength(2);
    expect(texto.split("\n")[0]).toContain("PEDRO LOBATO DE LIMA");
  });

  it("marca salto de coluna com espaço duplo", () => {
    const texto = reconstruirLinhasPdf([
      frag("Mãe: ELIANA SOUZA", 40, 700, 90),
      frag("Pai: JOAO SOUZA", 300, 700, 80),
    ]);
    expect(texto).toMatch(/ELIANA SOUZA {2,}Pai/);
  });
});

describe("cortarValorCampo", () => {
  it("encerra o valor no rótulo vizinho grudado", () => {
    expect(cortarValorCampo("PEDRO LOBATO DE LIMA Ocupação declarada pelo(a) eleitor(a): X"))
      .toBe("PEDRO LOBATO DE LIMA");
  });
  it("encerra no salto de coluna", () => {
    expect(cortarValorCampo("ELIANA SOUZA   Pai: JOAO")).toBe("ELIANA SOUZA");
  });
});

describe("pareceNomePessoa", () => {
  it("aceita nome de pessoa", () => {
    expect(pareceNomePessoa("PEDRO LOBATO DE LIMA")).toBe(true);
  });
  it("recusa texto institucional lido como nome", () => {
    expect(pareceNomePessoa("OCUPACAO DECLARADA PELO ELEITOR")).toBe(false);
    expect(pareceNomePessoa("TRIBUNAL SUPERIOR ELEITORAL")).toBe(false);
    expect(pareceNomePessoa("NADA CONSTA")).toBe(false);
    expect(pareceNomePessoa("DA PESSOA PESQUISADA E O RESPECTIVO NUMERO DE")).toBe(false);
  });
});

describe("lerNomeRotulado", () => {
  it("lê valor na mesma linha", () => {
    const r = lerNomeRotulado("Eleitor(a): PEDRO LOBATO DE LIMA\nInscrição: 1234", ["Eleitor\\(a\\)"]);
    expect(r.valor).toBe("PEDRO LOBATO DE LIMA");
    expect(r.fonte).toBe("rotulo_mesma_linha");
  });

  it("lê valor na linha de baixo (layout de formulário)", () => {
    const r = lerNomeRotulado("NOME COMPLETO\nPEDRO LOBATO DE LIMA\nCPF", ["Nome completo"]);
    expect(r.valor).toBe("PEDRO LOBATO DE LIMA");
    expect(r.fonte).toBe("rotulo_linha_seguinte");
  });

  it("lê valor na coluna ao lado", () => {
    const r = lerNomeRotulado("Nome:   PEDRO LOBATO DE LIMA", ["Nome"]);
    expect(r.valor).toBe("PEDRO LOBATO DE LIMA");
  });

  it("não devolve rótulo vizinho como se fosse nome", () => {
    const r = lerNomeRotulado("Nome:\nOcupação declarada pelo(a) eleitor(a): ESTUDANTE", ["Nome"]);
    expect(r.valor).toBeUndefined();
  });
});

describe("parseCertidao — resgate do titular", () => {
  const cabecalho = "TRIBUNAL SUPERIOR ELEITORAL\nCERTIDÃO DE QUITAÇÃO ELEITORAL\n";

  it("resgata o nome quando o regex do órgão não casa", () => {
    // Layout em que o rótulo do TSE saiu como "Nome" em vez de "Eleitor(a)".
    const texto = `${cabecalho}Nome: PEDRO LOBATO DE LIMA\nInscrição: 123456789012\nNADA CONSTA`;
    const c = parseCertidao(texto);
    expect(c?.nome_titular).toBe("PEDRO LOBATO DE LIMA");
    expect(c?.leitura?.nome_resgatado).toBe(true);
  });

  it("não deixa o campo vizinho virar titular", () => {
    const texto = `${cabecalho}Eleitor(a): PEDRO LOBATO DE LIMA Ocupação declarada pelo(a) eleitor(a): ESTUDANTE\nNADA CONSTA`;
    expect(parseCertidao(texto)?.nome_titular).toBe("PEDRO LOBATO DE LIMA");
  });

  it("registra campo vazio em vez de inventar nome", () => {
    const texto = `${cabecalho}Inscrição: 123456789012\nNADA CONSTA`;
    const c = parseCertidao(texto);
    expect(c?.nome_titular).toBeUndefined();
    expect(c?.leitura?.campos_vazios).toContain("nome_titular");
  });
});

describe("valorDoCadastroPresenteNoTexto", () => {
  it("confirma o nome do cadastro impresso no documento", () => {
    expect(valorDoCadastroPresenteNoTexto("... em nome de Pedro Lobato de Lima ...", "PEDRO LOBATO DE LIMA")).toBe(true);
  });
  it("não confirma nome ausente", () => {
    expect(valorDoCadastroPresenteNoTexto("... JOAO DA SILVA ...", "PEDRO LOBATO DE LIMA")).toBe(false);
  });
});
describe("regressão TSE: rótulo dentro de palavra", () => {
  it("não lê 'ELEITORAIS E EXPEDIDA GRATUITAMENTE' como nome", () => {
    const texto = [
      "TRIBUNAL SUPERIOR ELEITORAL",
      "CERTIDAO DE CRIMES ELEITORAIS E EXPEDIDA GRATUITAMENTE",
      "Eleitor(a): PEDRO LOBATO DE LIMA",
      "OCUPACAO DECLARADA PELO(A) ELEITOR(A): AUTONOMO",
    ].join("\n");
    expect(lerNomeRotulado(texto, ["Eleitor\\(a\\)", "Eleitor", "Nome"]).valor).toBe(
      "PEDRO LOBATO DE LIMA",
    );
  });

  it("recusa fragmento institucional como nome de pessoa", () => {
    expect(pareceNomePessoa("AIS E EXPEDIDA GRATUITAMENTE")).toBe(false);
  });
});

describe("Justiça Militar estadual — qualificação opcional", () => {
  it("descarta texto institucional e extrai os campos existentes", () => {
    const texto = [
      "TRIBUNAL DE JUSTIÇA MILITAR DO ESTADO DE SÃO PAULO",
      "CERTIDÃO DE ANTECEDENTES CRIMINAIS",
      "certifica em nome de: DA PESSOA PESQUISADA E O RESPECTIVO NÚMERO DE",
      "Nome: PEDRO LOBATO DE LIMA",
      "CPF: 123.456.789-01",
      "RG: 12.345.678-9",
      "Data de Nascimento: 05/12/1974",
      "Mãe: NECI LOBATO DE LIMA",
      "Pai: MANOEL ZUZA DE LIMA",
      "NÃO CONSTAM registros",
    ].join("\n");
    const c = parseCertidao(texto);
    expect(c?.nome_titular).toBe("PEDRO LOBATO DE LIMA");
    expect(c?.cpf).toBe("12345678901");
    expect(c?.rg).toBe("123456789");
    expect(c?.data_nascimento).toBe("1974-12-05");
    expect(c?.nome_mae).toBe("NECI LOBATO DE LIMA");
    expect(c?.nome_pai).toBe("MANOEL ZUZA DE LIMA");
    expect(c?.resultado).toBe("NADA_CONSTA");
  });
});
