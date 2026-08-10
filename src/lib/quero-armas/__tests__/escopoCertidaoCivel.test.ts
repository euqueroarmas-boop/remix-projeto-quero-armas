import { describe, it, expect } from "vitest";
import { detectarEscopoCertidao } from "../escopoCertidao";
import { identificarOrgao, parseCertidao } from "../parsersCertidoes";
import { conferirCertidao } from "../conferenciaCertidao";

const CADASTRO = {
  nome_completo: "PEDRO LOBATO DE LIMA",
  cpf: "248.756.118-11",
};

const CRIMINAL = `TRIBUNAL DE JUSTIÇA MILITAR DO ESTADO DE SÃO PAULO
CERTIDÃO DE ANTECEDENTES CRIMINAIS
EXPEDIDA PARA FINS CRIMINAIS E SÓ TEM VALIDADE NO SEU ORIGINAL
emite certidão NADA CONSTA, nas três Auditorias Criminais, em nome de:
PEDRO LOBATO DE LIMA
CPF: 248.756.118-11
São Paulo, 10 de agosto de 2026.`;

const CIVEL = `PODER JUDICIÁRIO
Tribunal de Justiça Militar do Estado de São Paulo
A COORDENADORIA DO CARTÓRIO CÍVEL DO TRIBUNAL DE JUSTIÇA MILITAR DO ESTADO DE SÃO PAULO
CERTIFICA E DÁ FÉ que, em pesquisa aos registros eletrônicos de distribuição de AÇÕES
CÍVEIS, verificou NADA CONSTAR contra a pessoa a respeito da qual foi solicitada
(réu/requerido):
PEDRO LOBATO DE LIMA, CPF: 248.756.118-11, conforme indicação constante do pedido de certidão.
Certidão solicitada em 10 de agosto de 2026 16:24:36`;

describe("trava de escopo cível", () => {
  it("classifica os dois documentos do TJM/SP", () => {
    expect(detectarEscopoCertidao(CRIMINAL)).toBe("criminal");
    expect(detectarEscopoCertidao(CIVEL)).toBe("civel");
    expect(identificarOrgao(CRIMINAL)).toBe("tjm_sp");
    expect(identificarOrgao(CIVEL)).toBe("tjm_sp_civel");
  });

  it("aprova a criminal e rejeita a cível", () => {
    const crim = parseCertidao(CRIMINAL)!;
    expect(conferirCertidao(crim, CADASTRO, CRIMINAL).veredicto).toBe("aprovado");

    const civ = parseCertidao(CIVEL)!;
    const conf = conferirCertidao(civ, CADASTRO, CIVEL);
    expect(conf.veredicto).toBe("rejeitado");
    expect(conf.mensagemCliente).toMatch(/CÍVEL/i);
  });
});
