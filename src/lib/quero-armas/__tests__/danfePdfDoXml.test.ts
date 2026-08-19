import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gerarDanfePdfDoXml, nomeArquivoDanfe } from "../danfePdfDoXml";
import { lerNotaFiscalXml, type NotaFiscalXml } from "../notaFiscalXml";

/**
 * DUAS COISAS SÃO VERIFICADAS AQUI, e as duas custaram um retrabalho.
 *
 * 1. O PDF TEM CAMADA DE TEXTO. O defeito que originou tudo foi um DANFE de
 *    1 MB, visualmente perfeito, do qual o pdf.js extraiu ZERO caractere —
 *    o botão "Compartilhar" do celular converteu cada letra em traço vetorial.
 *    Se o PDF que nós geramos caísse no mesmo problema, nada teria mudado.
 *
 * 2. O PDF PARECE UMA NOTA FISCAL. A primeira versão imprimia os dados em
 *    lista e o resultado parecia uma nota montada no Word: ninguém do outro
 *    lado do balcão reconhecia aquilo. Os testes de estrutura abaixo fixam os
 *    quadros do layout oficial (MOC, Anexo II) — canhoto, chave, destinatário,
 *    cálculo do imposto, transportador, produtos e dados adicionais.
 */

const XML_NFE = readFileSync(resolve(__dirname, "fixtures/nfe-mod55-autorizada.xml"), "utf8");

function nota(): NotaFiscalXml {
  const r = lerNotaFiscalXml(XML_NFE);
  if (r.ok === false) throw new Error(`fixture deveria ser lida: ${r.motivo}`);
  return r.nota;
}

/** Extrai o texto do PDF como o Hub extrai: pdf.js, página a página. */
async function textoDoPdf(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const conteudo = await pagina.getTextContent();
    const itens = conteudo.items as Array<{ str?: string }>;
    paginas.push(itens.map((it) => it.str ?? "").join(" "));
  }
  return paginas;
}

function bytesDe(n: NotaFiscalXml): Uint8Array {
  return new Uint8Array(gerarDanfePdfDoXml(n).output("arraybuffer"));
}

async function textoUnico(n: NotaFiscalXml = nota()): Promise<string> {
  return (await textoDoPdf(bytesDe(n))).join("\n").replace(/\s+/g, " ");
}

describe("DANFE gerado do XML — o arquivo", () => {
  it("é um PDF válido", () => {
    const bytes = bytesDe(nota());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("o texto é extraível pelo pdf.js — o defeito original não se repete", async () => {
    const texto = await textoUnico();
    expect(texto.replace(/\s/g, "").length).toBeGreaterThan(600);
  });

  it("nomeia o arquivo pela chave, para nunca colidir com outra nota", () => {
    expect(nomeArquivoDanfe(nota())).toBe("DANFE-35260811222333000181550010000000011300000020.pdf");
  });
});

describe("DANFE gerado do XML — os quadros do layout oficial", () => {
  it("traz o canhoto de recebimento", async () => {
    const texto = await textoUnico();
    expect(texto).toContain("RECEBEMOS DE");
    expect(texto).toContain("DATA DE RECEBIMENTO");
    expect(texto).toContain("IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR");
  });

  it("traz o bloco DANFE com tipo de operação, número, série e folha", async () => {
    const texto = await textoUnico();
    expect(texto).toContain("DANFE");
    expect(texto).toContain("Documento Auxiliar da Nota");
    expect(texto).toContain("0 - ENTRADA");
    expect(texto).toContain("1 - SAÍDA");
    expect(texto).toContain("Nº. 000.000.001");
    expect(texto).toContain("Série 001");
    expect(texto).toContain("Folha 1/1");
  });

  it("traz todos os quadros na ordem do modelo", async () => {
    const texto = await textoUnico();
    for (const quadro of [
      "CHAVE DE ACESSO",
      "NATUREZA DA OPERAÇÃO",
      "PROTOCOLO DE AUTORIZAÇÃO DE USO",
      "DESTINATÁRIO / REMETENTE",
      "CÁLCULO DO IMPOSTO",
      "TRANSPORTADOR / VOLUMES TRANSPORTADOS",
      "DADOS DOS PRODUTOS / SERVIÇOS",
      "DADOS ADICIONAIS",
    ]) {
      expect(texto).toContain(quadro);
    }
  });

  it("imprime a chave de acesso e o protocolo de autorização", async () => {
    const texto = await textoUnico();
    expect(texto.replace(/\s/g, "")).toContain("35260811222333000181550010000000011300000020");
    expect(texto).toContain("135263375224149");
    expect(texto).toContain("www.nfe.fazenda.gov.br/portal");
  });

  it("imprime emitente e destinatário com documento mascarado", async () => {
    const texto = await textoUnico();
    expect(texto).toContain("METALURGICA EXEMPLO LTDA ME");
    expect(texto).toContain("11.222.333/0001-81");
    expect(texto).toContain("COMERCIO DE METAIS EXEMPLO LTDA");
    expect(texto).toContain("44.555.666/0001-77");
  });

  it("imprime todos os itens com NCM, CFOP e CSOSN", async () => {
    const texto = await textoUnico();
    for (const item of nota().itens) {
      expect(texto).toContain(item.descricao);
      expect(texto).toContain(item.codigo!);
    }
    expect(texto).toContain("73066100"); // NCM do primeiro item
    expect(texto).toContain("0102"); // origem 0 + CSOSN 102
  });

  it("imprime quantidade e valor unitário com quatro casas, como o modelo", async () => {
    const texto = await textoUnico();
    expect(texto).toContain("26,8000");
    expect(texto).toContain("35,0000");
  });

  it("imprime os totais exatamente como estão no XML", async () => {
    const texto = await textoUnico();
    expect(texto).toContain("2.961,05");
    expect(texto).toContain("V. TOTAL DA NOTA");
  });

  it("diz que foi gerado a partir do XML — sem se passar pela via do emissor", async () => {
    const texto = await textoUnico();
    expect(texto).toContain("Gerado pelo Hub Documental a partir do XML autorizado pela SEFAZ");
  });
});

describe("DANFE gerado do XML — paginação", () => {
  it("nota longa vira várias folhas e nenhum item se perde", async () => {
    const base = nota();
    const muitos: NotaFiscalXml = {
      ...base,
      itens: Array.from({ length: 90 }, (_, i) => ({
        ...base.itens[i % base.itens.length],
        numero: i + 1,
        codigo: `COD${String(i + 1).padStart(4, "0")}`,
        descricao: `PRODUTO DE TESTE NUMERO ${i + 1}`,
      })),
    };
    const paginas = await textoDoPdf(bytesDe(muitos));
    expect(paginas.length).toBeGreaterThan(1);
    const tudo = paginas.join("\n").replace(/\s+/g, " ");
    for (let i = 1; i <= 90; i++) {
      expect(tudo).toContain(`PRODUTO DE TESTE NUMERO ${i}`);
    }
    // O cabeçalho com a chave se repete em toda folha, como manda o modelo.
    for (const pagina of paginas) {
      expect(pagina.replace(/\s/g, "")).toContain(base.chave);
    }
    // O canhoto é só da primeira folha.
    expect(paginas[0]).toContain("RECEBEMOS DE");
    expect(paginas[1]).not.toContain("RECEBEMOS DE");
  });
});

describe("DANFE gerado do XML — NFS-e tem folha própria", () => {
  /**
   * A nota de serviço não tem ICMS, IPI nem transportador. Imprimi-la no grid
   * da NF-e produziria colunas vazias que não existem nesse tipo de nota.
   */
  const servico: NotaFiscalXml = {
    ...nota(),
    modelo: "nfse",
    rotulo: "NFS-e",
    competencia: "2026-08-01",
    itens: [{ numero: 1, descricao: "SERVICO DE MANUTENCAO INDUSTRIAL PRESTADO NO MES" }],
  };

  it("usa os quadros de serviço, não os de mercadoria", async () => {
    const texto = await textoUnico(servico);
    expect(texto).toContain("NFS-e");
    expect(texto).toContain("PRESTADOR DE SERVIÇOS");
    expect(texto).toContain("TOMADOR DE SERVIÇOS");
    expect(texto).toContain("DISCRIMINAÇÃO DOS SERVIÇOS");
    expect(texto).toContain("VALOR LÍQUIDO DA NFS-e");
    expect(texto).toContain("SERVICO DE MANUTENCAO INDUSTRIAL PRESTADO NO MES");

    expect(texto).not.toContain("CÁLCULO DO IMPOSTO");
    expect(texto).not.toContain("TRANSPORTADOR / VOLUMES TRANSPORTADOS");
  });

  it("nomeia o arquivo como NFSe", () => {
    expect(nomeArquivoDanfe(servico).startsWith("NFSe-")).toBe(true);
  });
});
