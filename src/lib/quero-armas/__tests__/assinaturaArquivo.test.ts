import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assinaturaDoArquivo,
  assinaturaDoConteudo,
  conteudoParecePdf,
  conteudoPareceXml,
  lerInicioDoArquivo,
} from "../assinaturaArquivo";
import { ehArquivoXml } from "../notaFiscalXml";
import { importarNotaFiscalXml } from "../notaFiscalXmlImport";

/**
 * CASO REAL — Gilson, 20/08/2026, 00h00.
 *
 * Ele anexou o XML da nota e o Hub recusou com "este arquivo não é um PDF".
 * A linha de identificação entregou o porquê:
 *
 *     Arquivo enviado: Documento de gilson — formato desconhecido, 11 KB.
 *
 * O celular passou o arquivo SEM extensão e SEM tipo MIME. O arquivo estava
 * certo — a identificação é que dependia do nome, e quem escolhe o nome é o
 * aplicativo por onde o arquivo passou, não o emissor.
 */

const XML_NFE = readFileSync(
  resolve(__dirname, "fixtures/nfe-mod55-autorizada.xml"),
  "utf8",
);
const XML_NFSE = readFileSync(resolve(__dirname, "fixtures/nfse-nacional.xml"), "utf8");

describe("o arquivo do caso real", () => {
  it("o nome não denuncia nada, e o conteúdo denuncia tudo", () => {
    const comoChegou = { name: "Documento de gilson", type: "" };
    // Foi exatamente aqui que o Hub errou: nome sem extensão, tipo vazio.
    expect(ehArquivoXml(comoChegou)).toBe(false);
    // E aqui que ele acerta agora.
    expect(assinaturaDoConteudo(XML_NFE)).toBe("xml");
  });

  it("reconhece o XML da nota de serviço do mesmo jeito", () => {
    expect(assinaturaDoConteudo(XML_NFSE)).toBe("xml");
  });
});

describe("conteudoPareceXml", () => {
  it("aceita XML com declaração, com BOM e com espaço antes", () => {
    expect(conteudoPareceXml('<?xml version="1.0"?><nfeProc/>')).toBe(true);
    expect(conteudoPareceXml('﻿<?xml version="1.0"?><nfeProc/>')).toBe(true);
    expect(conteudoPareceXml('\n  <?xml version="1.0"?><nfeProc/>')).toBe(true);
  });

  it("aceita XML que abre direto na raiz, sem declaração", () => {
    expect(conteudoPareceXml('<nfeProc versao="4.00"><NFe/></nfeProc>')).toBe(true);
    expect(conteudoPareceXml("<NFSe><infNFSe/></NFSe>")).toBe(true);
    expect(conteudoPareceXml("<ns2:nfeProc><a/></ns2:nfeProc>")).toBe(true);
  });

  it("NÃO aceita texto solto nem outros formatos — a regra não afrouxou", () => {
    expect(conteudoPareceXml("Nota fiscal numero 1")).toBe(false);
    expect(conteudoPareceXml("%PDF-1.4")).toBe(false);
    expect(conteudoPareceXml("")).toBe(false);
    expect(conteudoPareceXml("{\"nota\":1}")).toBe(false);
    // Abre com tag, mas não é nem declaração nem raiz de nota: fica de fora.
    expect(conteudoPareceXml("<html><body>oi</body></html>")).toBe(false);
  });
});

describe("conteudoParecePdf", () => {
  it("reconhece o PDF pela assinatura", () => {
    expect(conteudoParecePdf("%PDF-1.7\n%âãÏÓ")).toBe(true);
    expect(conteudoParecePdf("\n%PDF-1.4")).toBe(true);
  });

  it("foto, print e texto solto continuam sem passar", () => {
    // Assinatura de JPEG e de PNG — os prints que a regra sempre recusou.
    expect(conteudoParecePdf("\xFF\xD8\xFF\xE0")).toBe(false);
    expect(conteudoParecePdf("\x89PNG\r\n")).toBe(false);
    expect(conteudoParecePdf("documento em pdf")).toBe(false);
    expect(conteudoParecePdf("")).toBe(false);
  });
});

describe("assinaturaDoConteudo", () => {
  it("classifica os três casos", () => {
    expect(assinaturaDoConteudo("%PDF-1.7")).toBe("pdf");
    expect(assinaturaDoConteudo('<?xml version="1.0"?>')).toBe("xml");
    expect(assinaturaDoConteudo("\x89PNG\r\n")).toBe("desconhecido");
  });
});

describe("lerInicioDoArquivo", () => {
  it("lê só o começo, não o arquivo inteiro", async () => {
    const blob = new Blob([XML_NFE], { type: "" });
    const inicio = await lerInicioDoArquivo(blob, 64);
    expect(inicio.length).toBeLessThanOrEqual(64);
    expect(assinaturaDoConteudo(inicio)).toBe("xml");
  });

  it("arquivo ilegível não derruba nada — devolve vazio", async () => {
    const quebrado = { slice: () => { throw new Error("falhou"); } } as unknown as Blob;
    expect(await lerInicioDoArquivo(quebrado)).toBe("");
    expect(assinaturaDoConteudo("")).toBe("desconhecido");
  });
});

describe("a corrente inteira, como o Hub a percorre", () => {
  /**
   * Reproduz o arquivo exatamente como ele chegou do celular do Gilson: nome
   * "Documento de gilson", sem extensão, tipo MIME vazio — e o XML da nota
   * dentro. O Hub identifica pelo conteúdo, corrige o tipo mantendo o nome, e
   * a importação segue.
   */
  it("XML sem extensão e sem tipo chega até virar DANFE", async () => {
    const comoChegouDoCelular = new File([XML_NFE], "Documento de gilson", { type: "" });

    // 1) O nome não ajuda — era aqui que o Hub parava.
    expect(ehArquivoXml(comoChegouDoCelular)).toBe(false);

    // 2) O conteúdo resolve.
    expect(await assinaturaDoArquivo(comoChegouDoCelular)).toBe("xml");

    // 3) O tipo é corrigido SEM trocar o nome — o nome é a prova na trilha.
    const corrigido = new File([comoChegouDoCelular], comoChegouDoCelular.name, {
      type: "text/xml",
    });
    expect(corrigido.name).toBe("Documento de gilson");
    expect(ehArquivoXml(corrigido)).toBe(true);

    // 4) E a importação conclui: nota lida e DANFE gerado.
    const r = await importarNotaFiscalXml(corrigido, { cnpj: "11222333000181" });
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.importada.nota.chave).toHaveLength(44);
    expect(r.importada.papelDoCliente).toBe("emitente");
    expect(r.importada.pdf.type).toBe("application/pdf");
    expect(r.importada.pdf.size).toBeGreaterThan(1000);
  });

  it("PDF sem extensão e sem tipo também é reconhecido", async () => {
    const pdfCru = new File(["%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"], "Documento de gilson", {
      type: "",
    });
    expect(await assinaturaDoArquivo(pdfCru)).toBe("pdf");
  });

  it("print de tela continua recusado — a regra do PDF ORIGINAL não afrouxou", async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], "print", {
      type: "",
    });
    expect(await assinaturaDoArquivo(png)).toBe("desconhecido");
  });
});
