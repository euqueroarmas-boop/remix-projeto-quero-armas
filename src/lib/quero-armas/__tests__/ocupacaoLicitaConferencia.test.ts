import { describe, expect, it } from "vitest";
import { emitenteConfere, situacaoCadastralAprovada } from "../ocupacaoLicitaConferencia";

describe("ocupacaoLicitaConferencia", () => {
  it("aprova o emitente quando o CNPJ confere", () => {
    expect(emitenteConfere(
      { cnpj: "68.472.983/0001-00", razao_social: "NOME DIFERENTE" },
      { cnpj: "68472983000100", razao_social: "68.472.983 FABIO CORREIA DE MELO" },
    )).toBe(true);
  });

  it("aprova o emitente quando a razão social confere mesmo com CNPJ divergente", () => {
    expect(emitenteConfere(
      { cnpj: "00.000.000/0001-00", razao_social: "68.472.983 FABIO CORREIA DE MELO" },
      { cnpj: "68.472.983/0001-00", razao_social: "68.472.983 FABIO CORREIA DE MELO" },
    )).toBe(true);
  });

  it("reprova quando CNPJ e razão social divergem", () => {
    expect(emitenteConfere(
      { cnpj: "00.000.000/0001-00", razao_social: "OUTRA EMPRESA" },
      { cnpj: "68.472.983/0001-00", razao_social: "68.472.983 FABIO CORREIA DE MELO" },
    )).toBe(false);
  });

  it("aceita somente situação cadastral ativa", () => {
    expect(situacaoCadastralAprovada("ATIVA")).toBe(true);
    expect(situacaoCadastralAprovada("BAIXADA")).toBe(false);
  });
});