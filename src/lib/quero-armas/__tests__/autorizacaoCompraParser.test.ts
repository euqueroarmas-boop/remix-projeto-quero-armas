// ============================================================================
// AUTORIZAÇÃO DE COMPRA — golden tests com os dossiês DEFERIDOS
// ----------------------------------------------------------------------------
// As fixtures são o texto REAL extraído dos PDFs dos dossiês que a Polícia
// Federal e o Exército deferiram (Eduardo Rizek e Édson Campos; a GRU do
// Rivelino e o comprovante bancário do Édson). Se o parser regredir, ele
// regride contra documento que já passou no órgão — não contra exemplo
// inventado.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseAutorizacaoCompra,
  conferirAutorizacaoCompra,
  gruPertenceAAutorizacao,
  janelaAutorizacao,
  orgaoPeloNumero,
  ehAutorizacaoCompra,
} from "../autorizacaoCompra";

const fx = (n: string) =>
  readFileSync(resolve(process.cwd(), "src/lib/quero-armas/__tests__/fixtures", n), "utf-8");

const EXERCITO = fx("autorizacao-eduardo-exercito.txt");
const PF = fx("autorizacao-edson-pf.txt");
const GRU_RIVELINO = fx("gru-rivelino.txt");
const COMPROVANTE_EDSON = fx("comprovante-gru-edson.txt");

describe("parser — dossiê do Exército (Eduardo Rizek, deferido 16/03/2026)", () => {
  const c = parseAutorizacaoCompra(EXERCITO)!;

  it("âncora: número, órgão e datas", () => {
    expect(c).not.toBeNull();
    expect(c.numero_autorizacao).toBe("99234025002588");
    expect(c.orgao).toBe("exercito");
    expect(c.data_emissao).toBe("2026-03-16");
    expect(c.data_validade).toBe("2026-09-16");
  });

  it("o adquirente sai inteiro: nome, CPF e CR", () => {
    expect(c.adquirente_nome).toBe("EDUARDO RIZEK ELIAS");
    expect(c.adquirente_cpf).toBe("30164708880");
    expect(c.adquirente_cr).toBe("108081753");
  });

  it("a loja é identificada por registro SIGMA, não por CNPJ", () => {
    expect(c.fornecedor_registro_sigma).toBe("10003169");
    expect(c.fornecedor_cnpj).toBeNull();
    expect(c.fornecedor_razao_social).toContain("BLINSUL");
  });

  it("a arma: pistola Glock G25", () => {
    expect(c.arma_produto).toBe("PISTOLA");
    expect(c.arma_marca).toBe("GLOCK");
    expect(c.arma_modelo).toBe("G25");
  });
});

describe("parser — dossiê da Polícia Federal (Édson Campos, deferido 13/07/2026)", () => {
  const c = parseAutorizacaoCompra(PF)!;

  it("âncora: número, órgão e datas", () => {
    expect(c.numero_autorizacao).toBe("99181025026558");
    expect(c.orgao).toBe("policia_federal");
    expect(c.data_emissao).toBe("2026-07-13");
    expect(c.data_validade).toBe("2027-01-13");
  });

  it("o adquirente sai inteiro", () => {
    expect(c.adquirente_nome).toBe("EDSON CAMPOS");
    expect(c.adquirente_cpf).toBe("14644264814");
    expect(c.adquirente_cr).toBe("110405994");
  });

  it("a loja é identificada por CNPJ — e o CNPJ dela nunca vira CPF do cliente", () => {
    expect(c.fornecedor_cnpj).toBe("31468237000125");
    expect(c.fornecedor_registro_sigma).toBeNull();
    expect(c.adquirente_cpf).not.toBe("31468237000125");
  });

  it("mesmo com a tabela da arma embaralhada pelo PDF, marca e modelo saem", () => {
    // No PDF real a linha vem "1380 AutomaticG25GLOCKPISTOLA".
    expect(c.arma_marca).toBe("GLOCK");
    expect(c.arma_modelo).toBe("G25");
  });
});

describe("o que o parser se recusa a fazer", () => {
  it("documento que não é o formulário do SisGCorp devolve null", () => {
    expect(ehAutorizacaoCompra("CERTIDÃO ESTADUAL DE DISTRIBUIÇÕES CRIMINAIS")).toBe(false);
    expect(parseAutorizacaoCompra("qualquer outro papel")).toBeNull();
  });

  it("sem número legível não há âncora — devolve null em vez de inventar", () => {
    const semNumero = EXERCITO.replace(/99234025002588/g, "");
    expect(parseAutorizacaoCompra(semNumero)).toBeNull();
  });
});

describe("conferência — a autorização tem dono", () => {
  const c = parseAutorizacaoCompra(EXERCITO)!;

  it("aprova quando nome, CPF e CR batem com o cadastro", () => {
    const r = conferirAutorizacaoCompra(c, {
      nome_completo: "Eduardo Rizek Elias",
      cpf: "301.647.088-80",
      numero_cr: "108081753",
    });
    expect(r.veredicto).toBe("aprovado");
  });

  it("rejeita CPF de outra pessoa — autorização na pasta errada", () => {
    const r = conferirAutorizacaoCompra(c, {
      nome_completo: "Eduardo Rizek Elias",
      cpf: "146.442.648-14", // CPF do Édson
      numero_cr: "108081753",
    });
    expect(r.veredicto).toBe("rejeitado");
    expect(r.motivos.join(" ")).toContain("pasta errada");
  });

  it("rejeita CR divergente", () => {
    const r = conferirAutorizacaoCompra(c, {
      nome_completo: "Eduardo Rizek Elias",
      cpf: "30164708880",
      numero_cr: "999999999",
    });
    expect(r.veredicto).toBe("rejeitado");
  });

  it("falta de dado no cadastro é pendência NOSSA, não rejeição do documento", () => {
    const r = conferirAutorizacaoCompra(c, {
      nome_completo: "Eduardo Rizek Elias",
      cpf: "30164708880",
      numero_cr: null,
    });
    expect(r.veredicto).toBe("cadastro_pendente");
  });
});

describe("a GRU é filha da autorização", () => {
  it("a GRU do Rivelino referencia a autorização dele pelo número inteiro", () => {
    expect(gruPertenceAAutorizacao(GRU_RIVELINO, "99234025002548")).toBe(true);
  });

  it("o comprovante bancário do Édson referencia pela cauda do código de barras", () => {
    // No código de barras o número aparece sem os 3 primeiros dígitos.
    expect(gruPertenceAAutorizacao(COMPROVANTE_EDSON, "99181025026558")).toBe(true);
  });

  it("comprovante de OUTRA autorização é recusado", () => {
    expect(gruPertenceAAutorizacao(COMPROVANTE_EDSON, "99234025002588")).toBe(false);
    expect(gruPertenceAAutorizacao(GRU_RIVELINO, "99181025026558")).toBe(false);
  });
});

describe("a janela dos 180 dias", () => {
  it("conta os dias restantes a partir da validade impressa", () => {
    const j = janelaAutorizacao("2026-09-16", new Date("2026-08-20T12:00:00"))!;
    expect(j.vencida).toBe(false);
    expect(j.dias_restantes).toBe(27);
  });

  it("depois da validade, está vencida", () => {
    const j = janelaAutorizacao("2026-09-16", new Date("2026-09-17T12:00:00"))!;
    expect(j.vencida).toBe(true);
  });

  it("sem data, não opina", () => {
    expect(janelaAutorizacao(null)).toBeNull();
    expect(janelaAutorizacao("16/09/2026")).toBeNull();
  });
});

describe("o órgão pelo prefixo do número", () => {
  it("9918 = Polícia Federal, 9923 = Exército", () => {
    expect(orgaoPeloNumero("99181025026558")).toBe("policia_federal");
    expect(orgaoPeloNumero("99234025002588")).toBe("exercito");
    expect(orgaoPeloNumero("12345")).toBeNull();
  });
});
