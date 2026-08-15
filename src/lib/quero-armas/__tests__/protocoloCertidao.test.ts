import { describe, it, expect } from "vitest";
import {
  detectarProtocoloCertidao,
  ehProtocoloDeCertidao,
  mensagemProtocoloCertidao,
} from "../protocoloCertidao";
import { identificarOrgao, parseCertidao } from "../parsersCertidoes";

/**
 * Documento REAL do caso Mizael (15/08/2026): o e-SAJ devolve esta página
 * quando o pedido de certidão é cadastrado. Ela foi aceita no slot de
 * Execuções Criminais e deu a exigência por cumprida.
 */
const PROTOCOLO_ESAJ = `07/08/2026, 20:16
e-SAJ
Tribunal de Justiça de São Paulo
Poder Judiciário
e-SAJ Portal de Serviços
Bem-vindo > Certidões > Certidões de 1º Grau > Cadastro de Pedido de Certidão
Cadastro de Pedido de Certidão
Orientações
O seu pedido foi cadastrado com sucesso. Para emissão da Certidão, serão encaminhadas instruções no e-mail informado, ou anote o Número e a Data do seu Pedido, para posterior emissão da Certidão.
Prazo máximo para liberação da Certidão 05 dias.
Dados para Emissão da Certidão
Número do Pedido : 99256611
Data do Pedido : 07/08/2026
Resumo do Pedido
Modelo : CERTIDÃO DE EXECUÇÃO CRIMINAL
Nome Completo : MIZAEL GONÇALVES VIALI
Pessoa : Física
Documentos : CPF: 256.908.548-08 RG: 286455821
Gênero : Masculino
Nome da mãe : ELIANA GONÇALVES VIALI
Nome do pai : SEBASTIÃO FERREIRA VIALI
Data de nascimento : 09/01/1975
Naturalidade : Faxinal ( PR )
E-mail informado para envio das instruções`;

/** A certidão de verdade — a que o protocolo acima promete para dali a 5 dias. */
const CERTIDAO_TJSP_EXECUCOES = `PODER JUDICIÁRIO
TRIBUNAL DE JUSTIÇA DO ESTADO DE SÃO PAULO
CERTIDÃO ESTADUAL DE DISTRIBUIÇÕES CRIMINAIS
CERTIDÃO N.: 99256611
A autenticidade desta certidão poderá ser confirmada pela internet.
CERTIFICO E DOU FÉ que, consultando os registros de distribuições de EXECUÇÕES CRIMINAIS
do Estado de São Paulo, NADA CONSTAR contra: MIZAEL GONÇALVES VIALI, RG: 286455821,
CPF: 256.908.548-08, nascido em 09/01/1975, natural de Faxinal - PR, filho de SEBASTIÃO
FERREIRA VIALI e ELIANA GONÇALVES VIALI, conforme indicação constante do pedido de certidão.
São Paulo, 14 de agosto de 2026.`;

/** Certidão do TJM/SP: cita "pedido de certidão" no fecho, como a do TJSP. */
const CERTIDAO_TJM = `TRIBUNAL DE JUSTIÇA MILITAR DO ESTADO DE SÃO PAULO
CERTIDÃO DE ANTECEDENTES CRIMINAIS
CERTIFICA E DÁ FÉ que emite certidão NADA CONSTA, nas três Auditorias Criminais,
em nome de PEDRO LOBATO DE LIMA, CPF: 248.756.118-11, conforme indicação constante
do pedido de certidão.
São Paulo, 10 de agosto de 2026.`;

/** Certidão do TRF3: "Certidão emitida em", código de segurança. */
const CERTIDAO_TRF3 = `PODER JUDICIÁRIO
JUSTIÇA FEDERAL
TRIBUNAL REGIONAL FEDERAL DA 3a REGIÃO
CERTIDÃO JUDICIAL CRIMINAL
Abrangência - Regional
CERTIFICAMOS, na forma da lei, que NÃO CONSTAM, até a presente data e hora, PROCESSOS
de classes CRIMINAIS em tramitação contra: FABIO CORREIA DE MELO ou CPF nº 343.170.468-90.
Certidão emitida em: 11/08/2026, às 16:27:34 (data e hora de Brasília).
A autenticidade desta certidão poderá ser verificada com base no código de segurança 4E8DC573C50683B4.`;

describe("protocolo de pedido de certidão", () => {
  it("reconhece o comprovante de pedido do e-SAJ", () => {
    const p = detectarProtocoloCertidao(PROTOCOLO_ESAJ);
    expect(p.ehProtocolo).toBe(true);
    expect(p.numero_pedido).toBe("99256611");
    expect(p.data_pedido).toBe("07/08/2026");
    expect(p.modelo_solicitado).toBe("CERTIDAO DE EXECUCAO CRIMINAL");
    expect(p.marcadores).toContain("cadastro de pedido de certidão");
  });

  it("explica ao cliente o que ele mandou e o que falta", () => {
    const msg = mensagemProtocoloCertidao(PROTOCOLO_ESAJ);
    expect(msg).toMatch(/COMPROVANTE DO PEDIDO/);
    expect(msg).toMatch(/99256611/);
    expect(msg).toMatch(/não a certidão/i);
  });

  it("NÃO marca como protocolo as certidões emitidas que citam o pedido", () => {
    expect(ehProtocoloDeCertidao(CERTIDAO_TJSP_EXECUCOES)).toBe(false);
    expect(ehProtocoloDeCertidao(CERTIDAO_TJM)).toBe(false);
    expect(ehProtocoloDeCertidao(CERTIDAO_TRF3)).toBe(false);
  });

  it("ignora texto vazio ou irrelevante", () => {
    expect(ehProtocoloDeCertidao("")).toBe(false);
    expect(ehProtocoloDeCertidao("CONTA DE ENERGIA ELÉTRICA — EDP SÃO PAULO")).toBe(false);
  });

  it("documenta o buraco original: nenhum parser reconhecia o protocolo", () => {
    // É por isso que a decisão caía na leitura probabilística — e ela via
    // "TJSP + CERTIDÃO DE EXECUÇÃO CRIMINAL" e classificava como certidão.
    expect(identificarOrgao(PROTOCOLO_ESAJ)).toBeNull();
    expect(parseCertidao(PROTOCOLO_ESAJ)).toBeNull();
    // A certidão de verdade continua sendo reconhecida normalmente.
    expect(identificarOrgao(CERTIDAO_TJSP_EXECUCOES)).toBe("tjsp_execucoes");
  });
});
