import { describe, expect, it } from "vitest";
import {
  avaliarPdfIdentidade,
  avaliarQrVisualIdentidade,
  temAssinaturaDigitalOficial,
} from "@/lib/quero-armas/identidadePdfQrCode";

// Camada de texto REAL de uma CNH-e baixada no app Carteira Digital de
// Trânsito (Producer "CDT"). É só isto: o documento inteiro é imagem. Este
// arquivo era recusado com "não reconhecemos as características de CIN, RG ou
// CNH" porque procurávamos DENATRAN e o PDF diz SENATRAN.
const TEXTO_CNH_E = `REPÚBLICA FEDERATIVA DO BRASIL
MINISTÉRIO DOS TRANSPORTES
SECRETARIA NACIONAL DE TRÂNSITO - SENATRAN

QR-CODE

Documento assinado com certificado digital em conformidade
com a Medida Provisória nº 2200-2/2001. Sua validade poderá
ser confirmada por meio do programa Assinador Serpro.

As orientações para instalar o Assinador Serpro e realizar a
validação do documento digital estão disponíveis em:
https://www.serpro.gov.br/assinador-digital.`;

// Mesmo emissor, mesmo rodapé — mas é documento de veículo.
const TEXTO_CRLV_E = `REPÚBLICA FEDERATIVA DO BRASIL
MINISTÉRIO DOS TRANSPORTES
SECRETARIA NACIONAL DE TRÂNSITO - SENATRAN
CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO - CRLV-e
QR-CODE
Documento assinado com certificado digital. Assinador Serpro.`;

describe("trava do documento de identidade com QR Code", () => {
  it("aceita a CNH-e do app Carteira Digital de Trânsito", () => {
    const veredicto = avaliarPdfIdentidade(TEXTO_CNH_E);
    expect(veredicto.ok).toBe(true);
    expect(veredicto.tipoDetectado).toBe("cnh");
  });

  it("continua aceitando os layouts já conhecidos", () => {
    expect(
      avaliarPdfIdentidade(
        "CARTEIRA DE IDENTIDADE NACIONAL\nvalidar.estaleiro.serpro.gov.br",
      ).tipoDetectado,
    ).toBe("cin");
    expect(
      avaliarPdfIdentidade("SECRETARIA DE SEGURANÇA PÚBLICA\nREGISTRO GERAL\ngov.br").tipoDetectado,
    ).toBe("rg_com_cpf");
    expect(
      avaliarPdfIdentidade("CARTEIRA NACIONAL DE HABILITAÇÃO\nDENATRAN\nRENACH\ngov.br")
        .tipoDetectado,
    ).toBe("cnh");
  });

  it("recusa PDF sem texto, sem QR Code e de outro documento", () => {
    expect(avaliarPdfIdentidade("").ok).toBe(false);
    expect(avaliarPdfIdentidade("CARTEIRA NACIONAL DE HABILITACAO\nfulano de tal").ok).toBe(false);
    expect(avaliarPdfIdentidade("COMPROVANTE DE ENDERECO\nENEL\nQR Code gov.br").ok).toBe(false);
  });

  it("não deixa o CRLV-e passar como identidade", () => {
    // Sem esta exclusão o marcador SENATRAN sozinho classificaria como CNH.
    expect(avaliarPdfIdentidade(TEXTO_CRLV_E).ok).toBe(false);
  });

  it("compara por palavra inteira: sigla curta não casa dentro de outra palavra", () => {
    expect(avaliarPdfIdentidade("VACINA CINTO PRINCIPAL gov.br QR Code").ok).toBe(false);
  });
});

describe("aceite pelo QR Code lido no pixel", () => {
  // O QR da CNH-e é modo byte (~530 bytes de assinatura ECDSA do Serpro):
  // o jsQR devolve `data` vazio e o payload em `binaryData`.
  const qrBinario = { encontrado: true, oficial: false, binario: true };

  it("aprova QR binário quando o PDF traz a assinatura digital do órgão", () => {
    expect(avaliarQrVisualIdentidade(qrBinario, TEXTO_CNH_E)).toBe(true);
  });

  it("recusa QR binário sem assinatura no texto (foto/print reimpressa)", () => {
    expect(avaliarQrVisualIdentidade(qrBinario, "documento")).toBe(false);
  });

  it("aprova QR com URL de domínio oficial", () => {
    expect(
      avaliarQrVisualIdentidade({ encontrado: true, oficial: true, binario: false }, ""),
    ).toBe(true);
  });

  it("recusa quando nenhum QR foi encontrado", () => {
    expect(
      avaliarQrVisualIdentidade({ encontrado: false, oficial: false, binario: false }, TEXTO_CNH_E),
    ).toBe(false);
  });

  it("reconhece a marca da assinatura digital oficial", () => {
    expect(temAssinaturaDigitalOficial(TEXTO_CNH_E)).toBe(true);
    expect(temAssinaturaDigitalOficial("boleto do condomínio")).toBe(false);
  });
});
