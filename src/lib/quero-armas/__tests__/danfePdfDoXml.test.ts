import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gerarDanfePdfDoXml, nomeArquivoDanfe } from "../danfePdfDoXml";
import { lerNotaFiscalXml, type NotaFiscalXml } from "../notaFiscalXml";

/**
 * A ÚNICA COISA QUE IMPORTA NESTE ARQUIVO: o PDF gerado tem CAMADA DE TEXTO.
 *
 * O defeito que originou tudo isto foi um DANFE de 1 MB, visualmente perfeito,
 * do qual o pdf.js extraiu ZERO caractere — porque o botão "Compartilhar" do
 * celular converteu cada letra em traço vetorial. Se o PDF que nós geramos
 * caísse no mesmo problema, o cliente continuaria travado e nada teria mudado.
 *
 * Por isso o teste abaixo não confere layout: ele abre o PDF gerado com o
 * MESMO leitor que o Hub usa (pdf.js) e exige encontrar, em texto, a chave de
 * acesso, as partes, os itens e o total.
 */

const XML_NFE = readFileSync(
  resolve(__dirname, "fixtures/nfe-mod55-autorizada.xml"),
  "utf8",
);

function nota(): NotaFiscalXml {
  const r = lerNotaFiscalXml(XML_NFE);
  if (r.ok === false) throw new Error(`fixture deveria ser lida: ${r.motivo}`);
  return r.nota;
}

/** Extrai o texto do PDF como o Hub extrai: pdf.js, página a página. */
async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const conteudo = await pagina.getTextContent();
    const itens = conteudo.items as Array<{ str?: string }>;
    paginas.push(itens.map((it) => it.str ?? "").join(" "));
  }
  return paginas.join("\n");
}

async function textoDoDanfe(): Promise<string> {
  const bytes = new Uint8Array(gerarDanfePdfDoXml(nota()).output("arraybuffer"));
  expect(bytes.length).toBeGreaterThan(1000);
  return textoDoPdf(bytes);
}

describe("DANFE gerado do XML", () => {
  it("produz um PDF válido", () => {
    const bytes = new Uint8Array(gerarDanfePdfDoXml(nota()).output("arraybuffer"));
    // "%PDF" — o arquivo é um PDF de verdade, não um blob vazio.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it("o texto é extraível pelo pdf.js — o defeito original não se repete", async () => {
    const texto = await textoDoDanfe();
    expect(texto.replace(/\s/g, "").length).toBeGreaterThan(300);
  });

  it("imprime a chave de acesso e o protocolo de autorização", async () => {
    const texto = (await textoDoDanfe()).replace(/\s+/g, " ");
    // A chave sai em blocos de 4, como no DANFE oficial.
    expect(texto.replace(/\s/g, "")).toContain("35260811222333000181550010000000011300000020");
    expect(texto).toContain("135263375224149");
  });

  it("imprime emitente e destinatário com CNPJ mascarado", async () => {
    const texto = (await textoDoDanfe()).replace(/\s+/g, " ");
    expect(texto).toContain("METALURGICA EXEMPLO LTDA ME");
    expect(texto).toContain("11.222.333/0001-81");
    expect(texto).toContain("COMERCIO DE METAIS EXEMPLO LTDA");
    expect(texto).toContain("44.555.666/0001-77");
  });

  it("imprime todos os itens da nota", async () => {
    const texto = (await textoDoDanfe()).replace(/\s+/g, " ");
    for (const item of nota().itens) {
      expect(texto).toContain(item.descricao);
    }
  });

  it("imprime o total exatamente como está no XML", async () => {
    const texto = (await textoDoDanfe()).replace(/\s+/g, " ");
    expect(texto).toContain("2.961,05");
  });

  it("nomeia o arquivo pela chave, para nunca colidir com outra nota", () => {
    expect(nomeArquivoDanfe(nota())).toBe(
      "DANFE-35260811222333000181550010000000011300000020.pdf",
    );
  });
});
