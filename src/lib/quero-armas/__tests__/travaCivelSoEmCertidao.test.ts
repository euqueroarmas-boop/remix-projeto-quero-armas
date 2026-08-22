// ============================================================================
// A TRAVA DE CERTIDÃO CÍVEL SÓ VALE ONDE O SLOT ESPERA CERTIDÃO
// ----------------------------------------------------------------------------
// Caso real (22/08/2026): o Igor enviou a Carteira de Trabalho Digital no slot
// da CTPS e recebeu "VOCÊ ENVIOU A CERTIDÃO CÍVEL. O PROCESSO EXIGE A CERTIDÃO
// CRIMINAL". A trava rodava em TODO envio, antes de olhar o que o slot pedia:
// bastava o texto do arquivo tropeçar num marcador para o cliente ser barrado
// num documento que não é certidão nenhuma — e ele fica sem saber o que fazer,
// porque a instrução ("volte ao site do órgão e emita a certidão criminal")
// não tem nada a ver com carteira de trabalho.
// ============================================================================

import { describe, it, expect } from "vitest";
import { slotEsperaCertidao, detectarEscopoCertidao } from "../escopoCertidao";

describe("trava de escopo cível — alcance", () => {
  it("vale nos slots de certidão", () => {
    for (const tipo of [
      "antecedentes_criminais",
      "antecedentes_estadual_distribuicao",
      "antecedentes_federal_trf3_regional",
      "antecedentes_militar",
      "certidao_civel_nao_aceita",
    ]) {
      expect(slotEsperaCertidao(tipo), tipo).toBe(true);
    }
  });

  it("NÃO vale nos slots que não são certidão", () => {
    for (const tipo of [
      "ctps",
      "renda_holerite_mes_atual",
      "renda_extrato_inss",
      "comprovante_residencia",
      "foto_3x4",
      "cin",
      "gru",
    ]) {
      expect(slotEsperaCertidao(tipo), tipo).toBe(false);
    }
  });

  it("envio livre ao Hub (sem slot) mantém a proteção antiga", () => {
    expect(slotEsperaCertidao(null)).toBe(true);
    expect(slotEsperaCertidao("")).toBe(true);
    expect(slotEsperaCertidao(undefined)).toBe(true);
  });

  it("certidão cível de verdade continua sendo barrada no slot de certidão", () => {
    const civel =
      "PODER JUDICIARIO TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO " +
      "CERTIDAO ESTADUAL DE DISTRIBUICOES CIVEIS NADA CONSTA";
    expect(detectarEscopoCertidao(civel)).toBe("civel");
    expect(slotEsperaCertidao("antecedentes_estadual_distribuicao")).toBe(true);
  });

  it("certidão criminal continua passando", () => {
    const criminal =
      "PODER JUDICIARIO CERTIDAO ESTADUAL DE DISTRIBUICAO DE ACOES CRIMINAIS " +
      "NADA CONSTA";
    expect(detectarEscopoCertidao(criminal)).toBe("criminal");
  });
});
