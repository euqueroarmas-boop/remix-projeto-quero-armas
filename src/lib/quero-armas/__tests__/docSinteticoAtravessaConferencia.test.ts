// ============================================================================
// DOCUMENTO SINTÉTICO ATRAVESSA A CONFERÊNCIA COMO O DE VERDADE
// ----------------------------------------------------------------------------
// Pergunta que este teste responde: dá para exercitar a conferência sem ter o
// documento do cliente? Dá — porque a conferência não olha o arquivo, olha o
// TEXTO extraído dele. Aqui o texto vem do gerador de amostras
// (scripts/gerar-doc-teste.mjs), não de um PDF de cliente nenhum, e a decisão
// que sai é a mesma que saiu no caso real do Igor em 22/08/2026.
// ============================================================================

import { describe, it, expect } from "vitest";
import { slotEsperaCertidao, detectarEscopoCertidao } from "../escopoCertidao";

// Mesmo conteúdo dos modelos de scripts/gerar-doc-teste.mjs. Dados fictícios.
const CTPS_SINTETICA = [
  "REPUBLICA FEDERATIVA DO BRASIL",
  "MINISTERIO DO TRABALHO E EMPREGO",
  "CARTEIRA DE TRABALHO DIGITAL",
  "Nome: FULANO DE TAL DA SILVA",
  "CPF: 000.000.000-00",
  "CONTRATOS DE TRABALHO",
  "Empregador: EMPRESA FICTICIA DE TESTE LTDA",
  "Situacao: CONTRATO EM VIGOR",
].join(" ");

const CIVEL_SINTETICA = [
  "PODER JUDICIARIO",
  "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO",
  "CERTIDAO ESTADUAL DE DISTRIBUICOES CIVEIS",
  "verifiquei NADA CONSTAR em nome de FULANO DE TAL DA SILVA",
].join(" ");

const CRIMINAL_SINTETICA = [
  "PODER JUDICIARIO",
  "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO",
  "CERTIDAO ESTADUAL DE DISTRIBUICAO DE ACOES CRIMINAIS",
  "verifiquei NADA CONSTAR em nome de FULANO DE TAL DA SILVA",
].join(" ");

describe("amostra sintética vale como insumo de teste da conferência", () => {
  it("CTPS sintética no slot da CTPS não é barrada pela trava de certidão", () => {
    // Este é o caso do Igor, reproduzido sem a CTPS do Igor.
    expect(slotEsperaCertidao("ctps")).toBe(false);
    expect(detectarEscopoCertidao(CTPS_SINTETICA)).not.toBe("civel");
  });

  it("certidão cível sintética continua barrada no slot de certidão", () => {
    expect(slotEsperaCertidao("antecedentes_estadual_distribuicao")).toBe(true);
    expect(detectarEscopoCertidao(CIVEL_SINTETICA)).toBe("civel");
  });

  it("certidão criminal sintética passa no slot de certidão", () => {
    expect(detectarEscopoCertidao(CRIMINAL_SINTETICA)).toBe("criminal");
  });
});
