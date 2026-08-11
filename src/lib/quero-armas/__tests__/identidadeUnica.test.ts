import { describe, it, expect } from "vitest";
import { mesmaExigenciaIdentidade } from "../identidadeUnica";

describe("mesmaExigenciaIdentidade — CIN, CNH e RG são a mesma exigência", () => {
  it("aceita as vias civis entre si", () => {
    expect(mesmaExigenciaIdentidade("cin", "cnh")).toBe(true);
    expect(mesmaExigenciaIdentidade("cnh", "rg_com_cpf")).toBe(true);
    expect(mesmaExigenciaIdentidade("rg", "cin")).toBe(true);
  });

  it("não aceita identidade funcional como identidade civil", () => {
    expect(mesmaExigenciaIdentidade("identidade_funcional", "cin")).toBe(false);
  });

  it("não aceita documentos de outra natureza", () => {
    expect(mesmaExigenciaIdentidade("comprovante_residencia", "cin")).toBe(false);
    expect(mesmaExigenciaIdentidade("cin", null)).toBe(false);
  });
});