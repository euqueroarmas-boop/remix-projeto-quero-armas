import { describe, expect, it } from "vitest";
import { descricaoDoArquivo } from "../rastroTentativas";

/**
 * CASO REAL — Gilson, 19/08/2026.
 *
 * Duas recusas seguidas, com 21 minutos de diferença. Em nenhuma das duas
 * telas aparecia QUAL arquivo tinha sido anexado. Levou uma conversa inteira
 * para descobrir que na primeira ele mandou o PDF e na segunda o XML — dado
 * que estava na mão do sistema e ele simplesmente não mostrava.
 *
 * O que esta função produz vai para DOIS lugares ao mesmo tempo: a mensagem na
 * tela do cliente e a trilha no banco. É isso que faz a foto de tela provar
 * sozinha o que foi enviado.
 */

describe("descricaoDoArquivo — o que distingue PDF de XML na tela", () => {
  it("separa o PDF do XML, que foi o nó do caso real", () => {
    // Os dois arquivos são os do caso real, com os tamanhos que eles têm.
    expect(descricaoDoArquivo({ name: "Danfe_Ricardo.pdf", type: "application/pdf", size: 1044480 }))
      .toBe("Arquivo enviado: Danfe_Ricardo.pdf — PDF, 1020 KB.");

    expect(
      descricaoDoArquivo({
        name: "35260831837713000138550010000000011300000020.xml",
        type: "text/xml",
        size: 11744,
      }),
    ).toBe("Arquivo enviado: 35260831837713000138550010000000011300000020.xml — XML, 11 KB.");
  });

  it("reconhece o formato pela extensão quando o celular não informa o tipo", () => {
    // Android costuma mandar MIME vazio ou genérico — o nome é o que sobra.
    expect(descricaoDoArquivo({ name: "nota.xml", type: "", size: 2048 })).toContain("XML");
    expect(descricaoDoArquivo({ name: "nota.pdf", type: "application/octet-stream", size: 2048 }))
      .toContain("PDF");
  });

  it("reconhece imagem, que é o print recusado em todo o processo", () => {
    expect(descricaoDoArquivo({ name: "IMG_2031.JPG", type: "image/jpeg", size: 3200000 }))
      .toBe("Arquivo enviado: IMG_2031.JPG — imagem JPG, 3,1 MB.");
    expect(descricaoDoArquivo({ name: "print", type: "image/png", size: 900 })).toContain("imagem");
  });

  it("não esconde o arquivo quando não sabe o formato", () => {
    expect(descricaoDoArquivo({ name: "documento.docx", type: "", size: 500 }))
      .toBe("Arquivo enviado: documento.docx — DOCX, 500 B.");
    expect(descricaoDoArquivo({ name: "arquivo", type: "", size: 0 }))
      .toBe("Arquivo enviado: arquivo — formato desconhecido.");
  });

  /**
   * REGRESSÃO 19/08/2026, 00h08. A trilha do próprio caso registrou:
   *
   *     Arquivo enviado: Nota.gilson — GILSON, 235 KB.
   *
   * O ponto no meio do nome não é extensão, e anunciar o sobrenome do cliente
   * como formato de arquivo confunde quem lê e não informa nada.
   */
  it("ponto no meio do nome não vira formato", () => {
    expect(descricaoDoArquivo({ name: "Nota.gilson", type: "", size: 240708 }))
      .toBe("Arquivo enviado: Nota.gilson — formato desconhecido, 235 KB.");
    expect(descricaoDoArquivo({ name: "Contrato.assinado", type: "", size: 1024 }))
      .toBe("Arquivo enviado: Contrato.assinado — formato desconhecido, 1 KB.");
  });

  it("extensão de verdade continua sendo mostrada", () => {
    expect(descricaoDoArquivo({ name: "planilha.xlsx", type: "", size: 10 })).toContain("XLSX");
    expect(descricaoDoArquivo({ name: "assinatura.p7s", type: "", size: 10 })).toContain("P7S");
  });

  it("o conteúdo real vence o nome — nome enganoso com MIME certo", () => {
    // O celular pode entregar nome torto, mas quando informa o tipo, ele manda.
    expect(descricaoDoArquivo({ name: "Nota.gilson", type: "application/pdf", size: 10 }))
      .toContain("PDF");
    expect(descricaoDoArquivo({ name: "Documento de gilson", type: "text/xml", size: 10 }))
      .toContain("XML");
  });

  it("aguenta arquivo sem nome e ausência de arquivo", () => {
    expect(descricaoDoArquivo({ name: "", type: "application/pdf", size: 10 }))
      .toContain("sem nome");
    expect(descricaoDoArquivo(null)).toBe("");
    expect(descricaoDoArquivo(undefined)).toBe("");
  });

  it("o tamanho sai em unidade que o cliente lê, não em bytes crus", () => {
    expect(descricaoDoArquivo({ name: "a.pdf", type: "application/pdf", size: 512 })).toContain("512 B");
    expect(descricaoDoArquivo({ name: "a.pdf", type: "application/pdf", size: 51200 })).toContain("50 KB");
    expect(descricaoDoArquivo({ name: "a.pdf", type: "application/pdf", size: 5242880 })).toContain("5,0 MB");
  });

  it("sempre começa pelo nome — é ele que identifica na foto de tela", () => {
    expect(
      descricaoDoArquivo({ name: "Danfe_Ricardo.pdf", type: "application/pdf", size: 1 }),
    ).toMatch(/^Arquivo enviado: Danfe_Ricardo\.pdf/);
  });
});
