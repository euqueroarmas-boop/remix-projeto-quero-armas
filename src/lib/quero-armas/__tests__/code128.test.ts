import { describe, expect, it } from "vitest";
import CODE128C from "jsbarcode/bin/barcodes/CODE128/CODE128C.js";
import { code128cBarras, code128cModulos } from "../code128";

/**
 * O código de barras do DANFE é o que o fiscal bipa. Uma barra errada e a
 * etiqueta é recusada no posto — sem erro visível no papel.
 *
 * Por isso a tabela de 107 símbolos não é conferida "no olho": estes testes
 * comparam a nossa saída com a do jsbarcode (já dependência do projeto),
 * módulo a módulo. Digitar um dígito errado na tabela quebra o teste na hora.
 */

/** Encoder de referência (jsbarcode) — a saída é a mesma string de módulos. */
function referencia(digitos: string): string {
  const Encoder = (CODE128C as unknown as { default?: unknown }).default ?? CODE128C;
  return new (Encoder as new (t: string, o: object) => { encode(): { data: string } })(
    digitos,
    {},
  ).encode().data;
}

const CHAVE_REAL = "35260831837713000138550010000000011300000020";
const CHAVE_FIXTURE = "35260811222333000181550010000000011300000020";

describe("code128c — nossa tabela contra o encoder de referência", () => {
  it("bate na chave da nota que originou o caso", () => {
    expect(code128cModulos(CHAVE_REAL)).toBe(referencia(CHAVE_REAL));
  });

  it("bate na chave da fixture", () => {
    expect(code128cModulos(CHAVE_FIXTURE)).toBe(referencia(CHAVE_FIXTURE));
  });

  it("bate em chaves variadas — cobre os 100 símbolos do modo C", () => {
    // Percorre pares 00..99 em blocos, exercitando toda a tabela de símbolos.
    const chaves = [
      "00010203040506070809101112131415161718192021",
      "22232425262728293031323334353637383940414243",
      "44454647484950515253545556575859606162636465",
      "66676869707172737475767778798081828384858687",
      "88899091929394959697989900112233445566778899",
    ];
    for (const chave of chaves) {
      expect(chave).toHaveLength(44);
      expect(code128cModulos(chave)).toBe(referencia(chave));
    }
  });

  it("tem o comprimento previsto pela norma", () => {
    // 44 dígitos = 22 símbolos de dados + Start C + verificador = 24 símbolos
    // de 11 módulos, mais os 13 módulos do Stop.
    expect(code128cModulos(CHAVE_REAL)).toHaveLength(24 * 11 + 13);
  });

  it("começa com barra e termina com o padrão de parada", () => {
    const m = code128cModulos(CHAVE_REAL);
    expect(m.startsWith("1")).toBe(true);
    expect(m.endsWith("1100011101011")).toBe(true);
  });

  it("recusa entrada que o modo C não codifica", () => {
    expect(code128cModulos("123")).toBe("");
    expect(code128cModulos("35260A31837713000138550010000000011300000020")).toBe("");
    expect(code128cModulos("")).toBe("");
  });
});

describe("code128cBarras", () => {
  it("agrupa módulos contíguos em faixas de barra", () => {
    expect(code128cBarras("110100111")).toEqual([
      [0, 2],
      [3, 1],
      [6, 3],
    ]);
    expect(code128cBarras("000")).toEqual([]);
  });

  it("a soma das faixas cobre exatamente os módulos pretos da chave", () => {
    const m = code128cModulos(CHAVE_REAL);
    const pretos = m.split("").filter((c) => c === "1").length;
    const somaFaixas = code128cBarras(m).reduce((s, [, largura]) => s + largura, 0);
    expect(somaFaixas).toBe(pretos);
  });
});
