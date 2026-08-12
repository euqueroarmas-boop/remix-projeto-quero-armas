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
      nome_civil: "FABIO CORREIA DE MELO",
      nome_empresarial: "68.472.983 FABIO CORREIA DE MELO",
      situacao_cadastral: "ATIVA",
      ocupacao_principal: "COMERCIANTE",
      cnae_principal: "COMERCIO VAREJISTA",
    });
  });

  it("extrai a referência empresarial completa do modelo oficial", () => {
    const texto = `
Certificado da Condição de
Microempreendedor Individual
Nome Civil
FABIO CORREIA DE MELO
CPF
343.170.468-90
CNPJ Data de Abertura
68.472.983/0001-00 09/08/2026
Nome Empresarial
68.472.983 FABIO CORREIA DE MELO
Situação Cadastral Vigente Data da Situação Cadastral
ATIVA 09/08/2026
Ocupação Principal
Salgadeiro(a) independente
Atividade Principal (CNAE)
5620-1/04 - Fornecimento de alimentos preparados preponderantemente para consumo domiciliar
`;

    expect(parseCcmei(texto)).toMatchObject({
      nome_civil: "FABIO CORREIA DE MELO",
      cpf: "343.170.468-90",
      cnpj: "68.472.983/0001-00",
      nome_empresarial: "68.472.983 FABIO CORREIA DE MELO",
      situacao_cadastral: "ATIVA",
      ocupacao_principal: "SALGADEIRO(A) INDEPENDENTE",
      cnae_principal: "5620-1/04 - FORNECIMENTO DE ALIMENTOS PREPARADOS PREPONDERANTEMENTE PARA CONSUMO DOMICILIAR",
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