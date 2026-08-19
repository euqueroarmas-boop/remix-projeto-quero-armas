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
