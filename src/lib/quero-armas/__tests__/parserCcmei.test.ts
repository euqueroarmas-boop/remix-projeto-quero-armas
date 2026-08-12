import { describe, expect, it } from "vitest";
import { ehCcmei, parseCcmei } from "../parserCcmei";

describe("parserCcmei", () => {
  it("prioriza o certificado mesmo quando o PDF contém o Cartão CNPJ anexo", () => {
    const texto = `
CERTIFICADO DA CONDIÇÃO DE
MICROEMPREENDEDOR INDIVIDUAL
Nome Civil
FABIO CORREIA DE MELO
CPF
343.170.468-90
CNPJ Data de Abertura
68.472.983/0001-00 01/08/2025
Nome Empresarial
68.472.983 FABIO CORREIA DE MELO
Situação Cadastral Vigente Data da Situação Cadastral
ATIVA 01/08/2025
Ocupação Principal
COMERCIANTE
Atividade Principal (CNAE)
COMERCIO VAREJISTA
COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL
`;

    expect(ehCcmei(texto)).toBe(true);
    expect(parseCcmei(texto)).toMatchObject({
      tipoDocumento: "renda_ccmei",
      cpf: "343.170.468-90",
      cnpj: "68.472.983/0001-00",
      situacao_cadastral: "ATIVA",
    });
  });

  it("não transforma um Cartão CNPJ comum em CCMEI", () => {
    const texto = `
REPÚBLICA FEDERATIVA DO BRASIL
COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL
CNPJ 12.345.678/0001-90
NOME EMPRESARIAL EMPRESA EXEMPLO LTDA
SITUAÇÃO CADASTRAL ATIVA
`;

    expect(ehCcmei(texto)).toBe(false);
    expect(parseCcmei(texto)).toBeNull();
  });
});