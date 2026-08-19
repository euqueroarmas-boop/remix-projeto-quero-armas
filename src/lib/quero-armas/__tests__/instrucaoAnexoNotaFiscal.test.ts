import { describe, expect, it } from "vitest";
import {
  acceptPorTipo,
  instrucaoAnexoPorTipo,
  mensagemSomentePdf,
  MSG_SOMENTE_PDF_ORIGINAL,
  tipoAceitaXmlNotaFiscal,
} from "../somentePdfOriginal";

/**
 * CASO REAL — 19/08/2026, 23h36.
 *
 * A importação de XML já estava pronta e o cliente continuava tentando o PDF,
 * apanhando do "salve de novo". Motivo: NENHUM texto da tela dizia que o XML
 * servia. A instrução do topo mandava "Anexe o PDF ORIGINAL", e a recusa de
 * arquivo não-PDF repetia a mesma coisa.
 *
 * Função pronta que ninguém sabe que existe é função que não existe. Estes
 * testes prendem o texto ao comportamento: onde o XML é aceito, a tela diz.
 */

describe("tipoAceitaXmlNotaFiscal", () => {
  it("reconhece os slots de nota fiscal", () => {
    expect(tipoAceitaXmlNotaFiscal("renda_nf_empresa")).toBe(true);
    expect(tipoAceitaXmlNotaFiscal("nota_fiscal_arma")).toBe(true);
    expect(tipoAceitaXmlNotaFiscal("renda_nf_autonomo")).toBe(true);
  });

  it("não vale para os demais documentos", () => {
    expect(tipoAceitaXmlNotaFiscal("cr")).toBe(false);
    expect(tipoAceitaXmlNotaFiscal("comprovante_residencia")).toBe(false);
    expect(tipoAceitaXmlNotaFiscal("foto_3x4")).toBe(false);
    expect(tipoAceitaXmlNotaFiscal("")).toBe(false);
    expect(tipoAceitaXmlNotaFiscal(null)).toBe(false);
  });
});

describe("instrução do topo do Hub", () => {
  it("no slot de nota fiscal, avisa que o XML serve", () => {
    const texto = instrucaoAnexoPorTipo("renda_nf_empresa");
    expect(texto).toContain("XML");
    expect(texto).toContain("DANFE");
  });

  it("nos demais documentos, continua pedindo o PDF original", () => {
    const texto = instrucaoAnexoPorTipo("cr");
    expect(texto).toContain("PDF ORIGINAL");
    expect(texto).not.toContain("XML");
  });

  it("na foto 3x4, continua pedindo imagem", () => {
    expect(instrucaoAnexoPorTipo("foto_3x4")).toContain("JPG ou PNG");
  });
});

describe("recusa de arquivo que não é PDF", () => {
  it("no slot de nota fiscal, aponta a saída: o XML", () => {
    const texto = mensagemSomentePdf("renda_nf_empresa");
    expect(texto).toContain(".xml");
    expect(texto).not.toBe(MSG_SOMENTE_PDF_ORIGINAL);
  });

  it("nos demais documentos, a regra do PDF original não mudou", () => {
    expect(mensagemSomentePdf("cr")).toBe(MSG_SOMENTE_PDF_ORIGINAL);
    expect(mensagemSomentePdf(null)).toBe(MSG_SOMENTE_PDF_ORIGINAL);
  });
});

describe("seletor de arquivo", () => {
  it("deixa escolher XML onde o Hub sabe converter", () => {
    expect(acceptPorTipo("renda_nf_empresa")).toContain(".xml");
  });

  it("a foto 3x4 continua só com imagem", () => {
    const accept = acceptPorTipo("foto_3x4");
    expect(accept).toContain("image/jpeg");
    expect(accept).not.toContain("xml");
  });
});
