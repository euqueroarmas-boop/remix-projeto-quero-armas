import { describe, it, expect } from "vitest";
import { normalizeCalibre } from "../utils";

describe("normalizeCalibre", () => {
  const cases: Array<[string, string | null]> = [
    // 12
    ["12", "12"],
    ["CAL .12", "12"],
    ["12 GA", "12"],
    ["CALIBRE 12", "12"],
    // 9mm
    ["9mm", "9MM"],
    ["9 MM", "9MM"],
    ["9x19", "9MM"],
    ["9 LUGER", "9MM"],
    // .380
    [".380", ".380"],
    ["380 ACP", ".380"],
    // .40
    [".40", ".40"],
    ["40 S&W", ".40"],
    // .22
    [".22", ".22"],
    ["22 LR", ".22"],
    // .45
    [".45", ".45"],
    ["45 ACP", ".45"],
    // .38 / .357
    [".38", ".38"],
    [".357", ".357"],
    // entradas inválidas/ruído
    ["", null],
    [null as any, null],
    [undefined as any, null],
  ];

  for (const [input, expected] of cases) {
    it(`normaliza ${JSON.stringify(input)} → ${expected}`, () => {
      expect(normalizeCalibre(input as any)).toBe(expected);
    });
  }
});