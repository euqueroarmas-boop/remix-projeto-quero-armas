// ============================================================================
// HOLERITE PRIVADO x DE SERVIDOR — mesma exigência
// ----------------------------------------------------------------------------
// O leitor tem dois tipos para a mesma coisa (contracheque do mês). O slot pede
// um; se a leitura devolver o outro, o cliente levava "documento incorreto" por
// um holerite válido — o mesmo tipo de armadilha que barrou a CTPS do Igor.
// Quem separa privado de servidor é a condição profissional do processo, que já
// decide qual slot existe.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  ehHolerite,
  mesmaExigenciaHolerite,
  mesmaExigenciaIdentidade,
} from "../identidadeUnica";

describe("holerite — mesma exigência", () => {
  it("reconhece as vias do contracheque", () => {
    expect(ehHolerite("renda_holerite_mes_atual")).toBe(true);
    expect(ehHolerite("renda_holerite_funcionario_publico")).toBe(true);
    expect(ehHolerite("renda_contra_cheque_mes_atual")).toBe(true);
  });

  it("holerite de servidor no slot do privado (e vice-versa) NÃO é documento incorreto", () => {
    expect(
      mesmaExigenciaHolerite("renda_holerite_funcionario_publico", "renda_holerite_mes_atual"),
    ).toBe(true);
    expect(
      mesmaExigenciaHolerite("renda_holerite_mes_atual", "renda_holerite_funcionario_publico"),
    ).toBe(true);
  });

  it("não confunde holerite com outros comprovantes de renda", () => {
    for (const outro of [
      "renda_extrato_inss",
      "ctps",
      "renda_ccmei",
      "renda_cartao_cnpj",
      "renda_comprovante_beneficio",
    ]) {
      expect(mesmaExigenciaHolerite("renda_holerite_mes_atual", outro), outro).toBe(false);
    }
  });

  it("não mistura com a exigência de identidade", () => {
    expect(mesmaExigenciaHolerite("cin", "cnh")).toBe(false);
    expect(mesmaExigenciaIdentidade("renda_holerite_mes_atual", "renda_holerite_funcionario_publico")).toBe(false);
  });

  it("vazio nunca casa", () => {
    expect(mesmaExigenciaHolerite(null, "renda_holerite_mes_atual")).toBe(false);
    expect(mesmaExigenciaHolerite("", "")).toBe(false);
  });
});
