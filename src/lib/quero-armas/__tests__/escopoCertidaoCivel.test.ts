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

// ── TRF3 (11/08/2026): certidão CÍVEL passou como aprovada ───────────────────
const TRF3_CIVEL = `PODER JUDICIÁRIO
JUSTIÇA FEDERAL
TRIBUNAL REGIONAL FEDERAL DA 3a REGIÃO
CERTIDÃO JUDICIAL CÍVEL
Abrangência - Regional
N. 2026/000005575104
CERTIFICAMOS, na forma da lei, que, consultando os sistemas processuais abaixo indicados, NÃO CONSTAM, até a presente data e hora, PROCESSOS de
classes CÍVEIS em tramitação contra: FABIO CORREIA DE MELO ou CPF nº 343.170.468-90.
Certidão emitida em: 11/08/2026, às 16:27:34 (data e hora de Brasília).
a) A autenticidade desta certidão poderá ser verificada no site do TRIBUNAL REGIONAL FEDERAL DA 3a REGIÃO, endereço
https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/VerificarAutenticidade, com base no código de segurança 4E8DC573C50683B4.`;

const TRF3_CRIMINAL = `PODER JUDICIÁRIO
JUSTIÇA FEDERAL
TRIBUNAL REGIONAL FEDERAL DA 3a REGIÃO
CERTIDÃO JUDICIAL CRIMINAL
Abrangência - Regional
CERTIFICAMOS que NÃO CONSTAM PROCESSOS de classes CRIMINAIS em tramitação contra: FABIO CORREIA DE MELO ou CPF nº 343.170.468-90.
a) verificada no endereço https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/VerificarAutenticidade.`;

describe("TRF3 — cível x criminal", () => {
  it("rejeita a certidão judicial cível do TRF3", () => {
    expect(detectarEscopoCertidao(TRF3_CIVEL)).toBe("civel");
  });

  it("mantém a certidão judicial criminal do TRF3 como criminal", () => {
    expect(detectarEscopoCertidao(TRF3_CRIMINAL)).toBe("criminal");
  });

  it("URL do rodapé não decide o escopo", () => {
    expect(
      detectarEscopoCertidao(
        "CERTIDÃO DE ANTECEDENTES CRIMINAIS https://web.trf3.jus.br/CertidaoCivelEleitoralCriminal/x",
      ),
    ).toBe("criminal");
  });
});
