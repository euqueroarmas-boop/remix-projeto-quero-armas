import { describe, expect, it } from "vitest";
import {
  extrairNumeroRequerimento,
  extrairVencimentoRequerimento,
  normalizarNumeroRequerimento,
  numeroRequerimentoDeDadosExtraidos,
} from "@/lib/quero-armas/requerimentoSinarm";

// Números reais de requerimentos conferidos (clientes anonimizados no restante).
const REAIS = [
  "202509251233571981",
  "202512241149324512",
  "202510161000094067",
  "202601121214505266",
  "202512231337283396",
];

describe("normalizarNumeroRequerimento", () => {
  it.each(REAIS)("aceita o número real %s", (n) => {
    expect(normalizarNumeroRequerimento(n)).toBe(n);
  });

  it("limpa pontuação antes de validar", () => {
    expect(normalizarNumeroRequerimento("2025.0925.1233.571981")).toBe("202509251233571981");
  });

  it.each([
    ["vazio", ""],
    ["nulo", null],
    ["CPF", "306.262.918-52"],
    ["curto demais", "2025092512335719"],
    ["longo demais", "2025092512335719811"],
    ["não começa com 20", "199509251233571981"],
    ["número do CRAF", "2024/906483758-53"],
  ])("recusa %s", (_rotulo, valor) => {
    expect(normalizarNumeroRequerimento(valor)).toBeNull();
  });
});

describe("extrairNumeroRequerimento", () => {
  // Trecho literal do texto extraído da via da PF: o rótulo vem DEPOIS do
  // valor, que é por que casar por rótulo não funciona neste documento.
  const TRECHO_PF =
    "MJ - POLÍCIA FEDERAL SERVIÇO PÚBLICO FEDERAL REQUERIMENTO DE AQUISIÇÃO DE ARMA DE FOGO " +
    "202509251233571981 26/10/2025Data de Vencimento:NÚMERO DO REQUERIMENTO:";

  it("acha o número no texto real da via da PF", () => {
    expect(extrairNumeroRequerimento(TRECHO_PF)).toBe("202509251233571981");
  });

  it("não confunde com CPF nem com registro de arma no mesmo texto", () => {
    const texto = "CPF: 306.262.918-52 Registro: 906851235 Nº Cad. SINARM: 2024/906483758-53";
    expect(extrairNumeroRequerimento(texto)).toBeNull();
  });

  it("devolve null quando não há número", () => {
    expect(extrairNumeroRequerimento("documento sem número algum")).toBeNull();
  });
});

describe("extrairVencimentoRequerimento", () => {
  it("lê o vencimento com o rótulo depois do valor (layout da PF)", () => {
    expect(
      extrairVencimentoRequerimento("202509251233571981 26/10/2025Data de Vencimento:"),
    ).toBe("2025-10-26");
  });

  it("lê o vencimento com o rótulo antes do valor", () => {
    expect(extrairVencimentoRequerimento("Data de Vencimento: 14/02/2026")).toBe("2026-02-14");
  });

  it("devolve null sem vencimento no texto", () => {
    expect(extrairVencimentoRequerimento("sem data aqui")).toBeNull();
  });
});

describe("numeroRequerimentoDeDadosExtraidos", () => {
  it("aceita a chave própria do extrator", () => {
    expect(
      numeroRequerimentoDeDadosExtraidos({ numero_requerimento: "202512241149324512" }),
    ).toBe("202512241149324512");
  });

  it("cai para numero_processo quando a chave própria não veio", () => {
    expect(
      numeroRequerimentoDeDadosExtraidos({ numero_processo: "202510161000094067" }),
    ).toBe("202510161000094067");
  });

  it("ignora chave preenchida com valor fora do formato", () => {
    expect(
      numeroRequerimentoDeDadosExtraidos({ numero_processo: "12345", protocolo: "abc" }),
    ).toBeNull();
  });

  it("aguenta json vazio ou nulo", () => {
    expect(numeroRequerimentoDeDadosExtraidos(null)).toBeNull();
    expect(numeroRequerimentoDeDadosExtraidos({})).toBeNull();
  });
});
