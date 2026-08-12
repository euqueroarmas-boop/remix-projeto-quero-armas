import { describe, expect, it } from "vitest";
import {
  calcularValidadeEfetiva,
  isDocumentoVencido,
  isTipoSemVencimento,
} from "../validadeDocumento";
import { parseCcmei } from "../parserCcmei";
import { situacaoCadastralAprovada, exigeDatasOcupacao } from "../ocupacaoLicitaConferencia";

/**
 * REGRESSÃO — falsa validade do CCMEI.
 *
 * Cenário real: o cliente anexou um Cartão CNPJ (emissão 10/07/2026 → validade
 * 09/08/2026) e, no MESMO modal, trocou o arquivo por um CCMEI. A data residual
 * 09/08/2026 sobreviveu no formulário e a trava genérica de vencimento carimbou
 * "REPROVADO — VENCIDO" num certificado que não tem validade nenhuma.
 */
const CCMEI_FABIO = `
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

const HOJE = "2026-08-12";
const VALIDADE_RESIDUAL = "2026-08-09"; // sobra do Cartão CNPJ anexado antes

describe("CCMEI — documento constitutivo não tem validade", () => {
  it("classifica CCMEI, contrato social e requerimento como tipos sem vencimento", () => {
    expect(isTipoSemVencimento("renda_ccmei")).toBe(true);
    expect(isTipoSemVencimento("renda_contrato_social")).toBe(true);
    expect(isTipoSemVencimento("renda_ficha_cadastral_jucesp")).toBe(true);
    expect(isTipoSemVencimento("renda_requerimento_empresario")).toBe(true);
  });

  it("mantém Cartão CNPJ e QSA COM vencimento (regra estável de 30 dias)", () => {
    expect(isTipoSemVencimento("renda_cartao_cnpj")).toBe(false);
    expect(isTipoSemVencimento("renda_qsa")).toBe(false);
    expect(calcularValidadeEfetiva("renda_cartao_cnpj", "2026-07-10")).toBe("2026-08-09");
    expect(calcularValidadeEfetiva("renda_qsa", "2026-07-10")).toBe("2026-08-09");
  });

  it("nunca infere validade para o CCMEI, mesmo recebendo uma data de emissão", () => {
    expect(calcularValidadeEfetiva("renda_ccmei", "2026-07-10")).toBeNull();
  });

  it("não reprova o CCMEI por uma data residual do documento anterior", () => {
    // Antes da correção: 2026-08-09 < 2026-08-12 → "REPROVADO — VENCIDO".
    expect(isDocumentoVencido("renda_ccmei", VALIDADE_RESIDUAL, { hoje: HOJE })).toBe(false);
    expect(isDocumentoVencido("renda_contrato_social", VALIDADE_RESIDUAL, { hoje: HOJE })).toBe(false);
  });

  it("continua reprovando documento que realmente venceu", () => {
    expect(isDocumentoVencido("renda_cartao_cnpj", VALIDADE_RESIDUAL, { hoje: HOJE })).toBe(true);
    expect(isDocumentoVencido("renda_qsa", VALIDADE_RESIDUAL, { hoje: HOJE })).toBe(true);
    expect(isDocumentoVencido("antecedentes_federal", "2026-08-11", { hoje: HOJE })).toBe(true);
  });

  it("não reprova documento válido nem documento sem data", () => {
    expect(isDocumentoVencido("renda_cartao_cnpj", "2026-08-12", { hoje: HOJE })).toBe(false);
    expect(isDocumentoVencido("renda_cartao_cnpj", "2026-09-01", { hoje: HOJE })).toBe(false);
    expect(isDocumentoVencido("renda_cartao_cnpj", null, { hoje: HOJE })).toBe(false);
    expect(isDocumentoVencido("renda_cartao_cnpj", "", { hoje: HOJE })).toBe(false);
  });

  it("respeita a validade indeterminada declarada no próprio documento", () => {
    expect(
      isDocumentoVencido("renda_carteira_funcional", VALIDADE_RESIDUAL, {
        hoje: HOJE,
        validadeIndeterminada: true,
      }),
    ).toBe(false);
  });

  it("aprova o CCMEI do cliente por nome + CPF + situação ATIVA, sem datas", () => {
    const ccmei = parseCcmei(CCMEI_FABIO);
    expect(ccmei).not.toBeNull();
    expect(ccmei!.nome_civil).toBe("FABIO CORREIA DE MELO");
    expect(ccmei!.cpf).toBe("343.170.468-90");
    expect(situacaoCadastralAprovada(ccmei!.situacao_cadastral)).toBe(true);
    // O tipo não pede emissão nem validade — o Hub grava as duas como null.
    expect(exigeDatasOcupacao("renda_ccmei")).toBe(false);
    expect(isDocumentoVencido("renda_ccmei", VALIDADE_RESIDUAL, { hoje: HOJE })).toBe(false);
  });

  it("a data de abertura/situação do CCMEI nunca vira emissão ou validade", () => {
    const ccmei = parseCcmei(CCMEI_FABIO) as Record<string, unknown>;
    expect(ccmei.data_emissao).toBeUndefined();
    expect(ccmei.data_validade).toBeUndefined();
  });
});
