import { describe, expect, it } from "vitest";

import {
  aplicarUfEmTexto,
  getLinksAntecedentesPorUf,
  normalizarUf,
  resolveLinkAntecedentePorUf,
} from "@/lib/quero-armas/linksAntecedentesPorUf";

// ============================================================================
// Regra do titular (21/08/2026): o cliente recebe os links das certidões do
// SEU estado e as da União. Nada de mandar o cliente do Paraná ao TJM, que só
// existe em SP, MG e RS.
//
// Estes testes travam o espelho TypeScript da regra que vive no banco em
// qa_uf_normalizar / qa_certidao_texto_por_uf / qa_certidao_link_por_uf.
// ============================================================================

describe("normalizarUf", () => {
  it("aceita sigla, nome por extenso, sem acento e em caixa alta", () => {
    expect(normalizarUf("PR")).toBe("PR");
    expect(normalizarUf("pr")).toBe("PR");
    expect(normalizarUf("Paraná")).toBe("PR");
    expect(normalizarUf("parana")).toBe("PR");
    expect(normalizarUf("PARANÁ")).toBe("PR");
    expect(normalizarUf("São Paulo")).toBe("SP");
    expect(normalizarUf("Distrito Federal")).toBe("DF");
  });

  it("devolve null quando não reconhece — e null não filtra nada", () => {
    expect(normalizarUf(null)).toBeNull();
    expect(normalizarUf("")).toBeNull();
    expect(normalizarUf("   ")).toBeNull();
    expect(normalizarUf("XX")).toBeNull();
  });
});

describe("getLinksAntecedentesPorUf", () => {
  it("resolve o estado escrito por extenso, não só a sigla", () => {
    const porExtenso = getLinksAntecedentesPorUf("Paraná");
    const porSigla = getLinksAntecedentesPorUf("PR");
    expect(porExtenso).not.toBeNull();
    expect(porExtenso?.tj).toBe(porSigla?.tj);
    expect(porExtenso?.trfSigla).toBe("TRF4");
  });

  it("só SP, MG e RS têm Tribunal de Justiça Militar", () => {
    expect(getLinksAntecedentesPorUf("SP")?.tjm).toBeTruthy();
    expect(getLinksAntecedentesPorUf("MG")?.tjm).toBeTruthy();
    expect(getLinksAntecedentesPorUf("RS")?.tjm).toBeTruthy();
    for (const uf of ["PR", "BA", "RJ", "DF", "AM", "CE"]) {
      expect(getLinksAntecedentesPorUf(uf)?.tjm).toBeUndefined();
    }
  });
});

describe("resolveLinkAntecedentePorUf — códigos canônicos do catálogo", () => {
  it("manda o cliente do Paraná ao tribunal do Paraná", () => {
    expect(resolveLinkAntecedentePorUf("antecedentes_estadual_distribuicao", "PR"))
      .toContain("tjpr.jus.br");
    expect(resolveLinkAntecedentePorUf("antecedentes_estadual_execucoes", "PR"))
      .toContain("tjpr.jus.br");
    expect(resolveLinkAntecedentePorUf("antecedentes_criminais", "PR"))
      .toContain("policiacivil.pr.gov.br");
    expect(resolveLinkAntecedentePorUf("antecedentes_federal_trf3_regional", "PR"))
      .toContain("trf4.jus.br");
    // Regional e Seção Judiciária saem do mesmo portal, mudando a abrangência.
    expect(resolveLinkAntecedentePorUf("antecedentes_federal_sjsp_jef", "PR"))
      .toContain("trf4.jus.br");
  });

  it("certidão da União não tem link por estado", () => {
    expect(resolveLinkAntecedentePorUf("antecedentes_militar", "PR")).toBeNull();
    expect(resolveLinkAntecedentePorUf("antecedentes_eleitoral", "PR")).toBeNull();
  });

  it("TJM devolve link só onde o tribunal existe", () => {
    expect(resolveLinkAntecedentePorUf("antecedentes_militar_estadual", "SP"))
      .toContain("tjmsp.jus.br");
    expect(resolveLinkAntecedentePorUf("antecedentes_militar_estadual", "PR")).toBeNull();
  });

  it("NÃO captura os códigos por UF do cofre — eles guardam certidão de OUTRO estado", () => {
    // `antecedentes_estadual_mg` é a certidão de Minas guardada no cofre de um
    // cliente que hoje mora no Paraná. Devolver o link do TJPR para ela seria
    // mandar o cliente emitir no tribunal errado.
    expect(resolveLinkAntecedentePorUf("antecedentes_estadual_mg", "PR")).toBeNull();
    expect(resolveLinkAntecedentePorUf("antecedentes_estadual_sp", "PR")).toBeNull();
  });
});

describe("aplicarUfEmTexto", () => {
  it("não escreve TJPARANÁ quando o cadastro guarda o estado por extenso", () => {
    const texto = aplicarUfEmTexto("Emita a certidão no TJSP", "Paraná");
    expect(texto).toBe("Emita a certidão no TJPR");
    expect(texto).not.toContain("PARANÁ");
  });

  it("no Distrito Federal o tribunal é o TJDFT", () => {
    expect(aplicarUfEmTexto("Emita no TJSP", "DF")).toBe("Emita no TJDFT");
  });

  it("não inventa tribunal militar onde não existe", () => {
    // Fora de SP/MG/RS o item nem é pedido; o texto não deve inventar
    // um "TJ Militar/PR", que não existe.
    expect(aplicarUfEmTexto("Certidão do TJM-SP", "PR")).not.toContain("TJ Militar/PR");
    expect(aplicarUfEmTexto("Certidão do TJM-SP", "MG")).toBe("Certidão do TJM-MG");
    expect(aplicarUfEmTexto("Certidão do TJM-SP", "RS")).toBe("Certidão do TJM-RS");
  });

  it("troca o número da região federal pelo do estado do cliente", () => {
    expect(aplicarUfEmTexto("Certidão do TRF3", "Paraná")).toBe("Certidão do TRF4");
    expect(aplicarUfEmTexto("Certidão do TRF3", "Bahia")).toBe("Certidão do TRF1");
    expect(aplicarUfEmTexto("Certidão do TRF3", "Minas Gerais")).toBe("Certidão do TRF6");
  });

  it("para o cliente de São Paulo nada muda", () => {
    const original = "Emita no TJSP a certidão do TRF3, Polícia Civil/SP";
    expect(aplicarUfEmTexto(original, "SP")).toBe(original);
    expect(aplicarUfEmTexto(original, "São Paulo")).toBe(original);
  });
});
