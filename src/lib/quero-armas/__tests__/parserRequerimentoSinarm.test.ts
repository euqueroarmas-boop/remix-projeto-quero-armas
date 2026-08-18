import { describe, expect, it } from "vitest";
import {
  parseRequerimentoSinarm,
  textoIndicaRequerimentoSinarm,
} from "@/lib/quero-armas/parserRequerimentoSinarm";

// ============================================================================
// Texto REAL extraído do PDF que o cliente enviou e o Hub carimbou REPROVADO
// ("o documento foi identificado como Protocolo do processo"). Nomes, CPF e RG
// preservados de propósito: o caso só está fechado se ESTE arquivo passar.
// A ordem das palavras é a que o pdf.js devolve — rótulos depois dos valores,
// "Vencimento" perdido no cabeçalho. É exatamente aí que a leitura quebrava.
// ============================================================================
const REQUERIMENTO_REAL = `
MJ - POLÍCIA FEDERAL SERVIÇO PÚBLICO FEDERAL DIVISÃO NACIONAL DE CONTROLE DE ARMAS DE FOGO  REQUERIMENTO DE AQUISIÇÃO DE ARMA DE FOGO  202608181300111745   18/09/2026 Data de NÚMERO DO REQUERIMENTO:  REQUERIMENTO DE  ANTHONY NELSON FERREIRA DE SOUZA, RG: 34.110.404-8, CPF: 303.727.088-89, vem por meio deste, REQUERER com base na lei nº. 10.826/03, a aquisição da arma de fogo descrita pelos motivos abaixo especificados.  DECLARAÇÃO DE EFETIVA NECESSIDADE  Declaro possuir lugar seguro para armazenamento das armas de fogo (cofre), nos termos do disposto no art. 13 da Lei nº 10.826, de 2003.  Via Polícia Federal  Complemento: Titulo de Eleitor: Tipo de Formulário: Município:  IDENTIFICAÇÃO  Numero do RG: UF de Nascimento: Bairro: Numero: Órgão Exp. RG: Nome: Email: Tipo: Nome da Mãe: Nome do Pai: Profissão: Categoria: CEP: Aposentado: CPF: Data de Expedição: UF de Exp. RG: Telefone Celular: Sexo: País de UF: Município: Telefone Fixo: Estado Civil: Data de Nascimento: Logradouro:  Requerimento de Aquisição de Arma de Fogo Cidadão 303.727.088-89 ANTHONY NELSON FERREIRA DE SOUZA SILVIA CRISTINA FERREIRA DE SOUZA NELSON FERREIRA DE SOUZA 04/08/1981   Masculino Brasil SP  Mogi das Cruzes  34.110.404-8  09/04/2019  ssp  SP  Casado
202608181300111745   18/09/2026 Data de NÚMERO DO REQUERIMENTO:  UF: Complemento: Numero: Logradouro: Razão Social: Tipo: Bairro: CEP: CNPJ Empresa: Telefone Município:  04.198.514/0041-41 POLÍCIA MILITAR DO ESTADO DE SÃO PAULO 02377000 Rua do Horto Comercial 931 Horto Florestal São Paulo EDIFÍCIO - 2 SP  Espécie: Pistola   .38 TPC Calibre:  DADOS DA ARMA TERMO DE RESPONSABILIDADE  Assinatura do Requerente São Paulo/SP, 18 de Agosto de 2026
202608181300111745  USO EXCLUSIVO DA POLÍCIA FEDERAL - SINARM  88,00 SR/PF/SP Departamento da Polícia Federal Governo Federal - Guia de Recolhimento da União – GRU – Cobrança V.2.7  Espécie Docum. 1 - Registro de arma de fogo Vencimento: 17/09/2026
`;

describe("parseRequerimentoSinarm — o PDF que foi reprovado indevidamente", () => {
  const lido = parseRequerimentoSinarm(REQUERIMENTO_REAL);

  it("reconhece o requerimento (antes ia parar na IA e virava Protocolo do processo)", () => {
    expect(lido).not.toBeNull();
    expect(lido!.finalidade).toBe("aquisicao");
  });

  it("lê o número de 18 dígitos e a emissão que vem dele", () => {
    expect(lido!.numero_requerimento).toBe("202608181300111745");
    expect(lido!.data_emissao).toBe("2026-08-18");
  });

  it("lê o vencimento colado ao número, mesmo sem o rótulo sobreviver", () => {
    expect(lido!.data_vencimento).toBe("2026-09-18");
  });

  it("lê o titular sem arrastar os rótulos do formulário", () => {
    expect(lido!.nome_completo).toBe("ANTHONY NELSON FERREIRA DE SOUZA");
    expect(lido!.cpf).toBe("303.727.088-89");
    expect(lido!.rg).toBe("34.110.404-8");
    expect(lido!.data_nascimento).toBe("1981-08-04");
  });

  it("lê a arma pretendida sem confundir com a Espécie da GRU", () => {
    expect(lido!.especie_arma).toBe("PISTOLA");
    expect(lido!.calibre).toBe(".38");
  });
});

describe("parseRequerimentoSinarm — o que NÃO pode ser lido como requerimento", () => {
  it("recusa texto curto", () => {
    expect(parseRequerimentoSinarm("REQUERIMENTO DE AQUISIÇÃO DE ARMA DE FOGO")).toBeNull();
  });

  it("recusa o requerimento de PORTE — é outra exigência, com outro slot", () => {
    const porte = REQUERIMENTO_REAL.replace(/AQUISIÇÃO DE ARMA DE FOGO/g, "PORTE DE ARMA DE FOGO");
    expect(parseRequerimentoSinarm(porte)).toBeNull();
  });

  it("recusa documento da PF sem o número de 18 dígitos", () => {
    const semNumero = REQUERIMENTO_REAL.replace(/202608181300111745/g, "12345");
    expect(parseRequerimentoSinarm(semNumero)).toBeNull();
  });

  it("recusa protocolo genérico de processo administrativo", () => {
    const protocolo = `POLÍCIA FEDERAL — Comprovante de protocolo do processo administrativo
      08455.000123/2026-11 registrado em 18/08/2026 em nome de ANTHONY NELSON FERREIRA DE SOUZA,
      CPF 303.727.088-89. Acompanhe o andamento no site da Polícia Federal.`;
    expect(parseRequerimentoSinarm(protocolo)).toBeNull();
  });
});

describe("textoIndicaRequerimentoSinarm", () => {
  it("aceita o título impresso citado pela leitura de visão", () => {
    expect(
      textoIndicaRequerimentoSinarm(
        "FORMULARIO OFICIAL DA POLICIA FEDERAL SINARM INTITULADO REQUERIMENTO DE AQUISICAO DE ARMA DE FOGO",
      ),
    ).toBe(true);
  });

  // Justificativa REAL que a IA devolveu ao reprovar o documento do cliente,
  // já passada pelo normalizador do Hub (pontuação virou espaço).
  it("aceita a justificativa que a IA escreveu ao classificar como protocolo", () => {
    expect(
      textoIndicaRequerimentoSinarm(
        "O DOCUMENTO E UM FORMULARIO OFICIAL DA POLICIA FEDERAL SINARM INTITULADO REQUERIMENTO DE AQUISICAO DE ARMA DE FOGO CONTENDO NUMERO DE PROTOCOLO DADOS DE IDENTIFICACAO DO REQUERENTE E A ESPECIE DA ARMA",
      ),
    ).toBe(true);
  });

  it("aceita a lei 10 826 com a pontuação já removida pelo Hub", () => {
    expect(
      textoIndicaRequerimentoSinarm("REQUERIMENTO DE AQUISICAO DE ARMA DE FOGO LEI N 10 826 03"),
    ).toBe(true);
  });

  it("não reage a menção solta de arma de fogo", () => {
    expect(textoIndicaRequerimentoSinarm("CERTIDAO NEGATIVA POLICIA FEDERAL ARMA DE FOGO")).toBe(false);
  });
});
