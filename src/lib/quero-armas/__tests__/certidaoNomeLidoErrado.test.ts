/**
 * CASO REAL (20/08/2026, TRF3): a leitura local pescou a frase institucional
 * "o nome INDICADO PARA A CONSULTA SERA DE RESPONSABILIDADE DO interessado"
 * como se fosse o NOME DO TITULAR e recusou a certidão por "nome diferente do
 * cadastro" — com o nome correto E o CPF do cliente impressos na certidão.
 *
 * Duas defesas, válidas para TODAS as certidões:
 *  1. `pareceNomePessoa` rejeita recorte de frase institucional (termina em
 *     preposição, contém palavras de boilerplate).
 *  2. `conferirCertidao` nunca acusa divergência de nome/CPF quando o valor
 *     do CADASTRO está impresso, literal, no texto do próprio PDF — leitura
 *     errada é problema nosso, não do cliente.
 */
import { describe, expect, it } from "vitest";
import { pareceNomePessoa } from "../leituraCamposPdf";
import { conferirCertidao } from "../conferenciaCertidao";

const BOILERPLATE_TRF3 = "INDICADO PARA A CONSULTA SERA DE RESPONSABILIDADE DO";

const TEXTO_TRF3 = `PODER JUDICIÁRIO
JUSTIÇA FEDERAL
TRIBUNAL REGIONAL FEDERAL DA 3a REGIÃO
CERTIDÃO JUDICIAL CRIMINAL NEGATIVA
Certidão nº 2026/00005818543
Certificamos que, consultados os registros de distribuição de ações e execuções CRIMINAIS,
em nome das pessoas abaixo indicadas, NÃO CONSTAM, até a presente data e hora:
MARCIO GERALDO FREIRE DE ALMEIDA ou CPF nº 186.237.458-92.
Esta certidão é válida por 90 (noventa) dias.
Não tendo sido informado o número do CPF, o nome indicado para a consulta será de
responsabilidade do interessado e destinatário.
Emitida em 20/08/2026.`;

describe("frase institucional não é nome de pessoa", () => {
  it("rejeita o recorte real do TRF3", () => {
    expect(pareceNomePessoa(BOILERPLATE_TRF3)).toBe(false);
  });

  it("rejeita recortes que terminam em preposição", () => {
    expect(pareceNomePessoa("RESPONSABILIDADE DO")).toBe(false);
    expect(pareceNomePessoa("SOLICITADO PARA")).toBe(false);
  });

  it("continua aceitando nomes reais, inclusive com partículas", () => {
    expect(pareceNomePessoa("MARCIO GERALDO FREIRE DE ALMEIDA")).toBe(true);
    expect(pareceNomePessoa("MARIA DO CARMO SOUZA")).toBe(true);
    expect(pareceNomePessoa("JOAO DE DEUS")).toBe(true);
  });
});

describe("conferirCertidao — leitura errada não é divergência", () => {
  const cadastro = {
    nome_completo: "MARCIO GERALDO FREIRE DE ALMEIDA",
    cpf: "186.237.458-92",
  };

  it("nome lido errado + nome do cadastro impresso no PDF → NÃO rejeita", () => {
    const r = conferirCertidao(
      {
        orgao: "trf_regional",
        tipoDocumento: "antecedentes_federal_trf3_regional",
        nome_titular: BOILERPLATE_TRF3,
        resultado: "NADA_CONSTA",
        data_emissao: "2026-08-20",
      } as any,
      cadastro as any,
      TEXTO_TRF3,
    );
    expect(r.veredicto).not.toBe("rejeitado");
    expect(r.achados.some((a) => a.campo === "nome_titular" && a.problema === "divergente")).toBe(false);
  });

  it("nome realmente de OUTRA pessoa (e ausente do PDF) continua rejeitando", () => {
    const r = conferirCertidao(
      {
        orgao: "trf_regional",
        tipoDocumento: "antecedentes_federal_trf3_regional",
        nome_titular: "JOSE FREIRE DE ALMEIDA NETO",
        resultado: "NADA_CONSTA",
        data_emissao: "2026-08-20",
      } as any,
      cadastro as any,
      TEXTO_TRF3.replace(/MARCIO GERALDO FREIRE DE ALMEIDA/g, "JOSE FREIRE DE ALMEIDA NETO"),
    );
    expect(r.veredicto).toBe("rejeitado");
  });
});
