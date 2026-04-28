import { describe, it, expect } from "vitest";
import { normalizeDateToBr, pickIssueDate } from "../QACadastroPublicoPage";
import {
  detectCpfRgAmbiguity,
  isValidCpf,
  onlyDigits,
} from "@/shared/quero-armas/clienteSchema";

/**
 * Cenário oficial: CIN gov.br retorna CPF válido e o mesmo número como
 * candidato a RG. O frontend DEVE preencher o CPF, NÃO deve preencher o
 * RG silenciosamente, manter ambiguidade ativa e mapear a data de emissão.
 */
describe("CIN gov.br — mapeamento do extrator", () => {
  const ai = {
    tipo_documento: "CIN",
    cpf: "37799538899",
    rg: null,
    rg_candidato: ["37799538899"],
    needs_confirmation: true,
    data_expedicao_rg: "2025-07-26",
  };

  it("preenche CPF mascarado mesmo com ambiguidade", () => {
    const cpfDigits = onlyDigits(String(ai.cpf));
    expect(cpfDigits).toHaveLength(11);
    expect(isValidCpf(cpfDigits)).toBe(true);
    // máscara final esperada
    const masked = `${cpfDigits.slice(0,3)}.${cpfDigits.slice(3,6)}.${cpfDigits.slice(6,9)}-${cpfDigits.slice(9)}`;
    expect(masked).toBe("377.995.388-99");
  });

  it("converte data ISO da IA para DD/MM/AAAA", () => {
    expect(normalizeDateToBr(ai.data_expedicao_rg)).toBe("26/07/2025");
  });

  it("pickIssueDate cobre os 4 aliases possíveis", () => {
    expect(pickIssueDate({ data_expedicao_rg: "2025-07-26" })).toBe("26/07/2025");
    expect(pickIssueDate({ data_emissao: "26/07/2025" })).toBe("26/07/2025");
    expect(pickIssueDate({ issue_date: "2024-01-15" })).toBe("15/01/2024");
    expect(pickIssueDate({ data_emissao_rg: "10-03-2023" })).toBe("10/03/2023");
    expect(pickIssueDate({})).toBe("");
    expect(pickIssueDate(null)).toBe("");
  });

  it("detecta ambiguidade quando rg_candidato == CPF", () => {
    const ambig = detectCpfRgAmbiguity(ai as any);
    // Não deve preencher RG silenciosamente; deve sinalizar conflito
    expect(ambig.hasAmbiguity).toBe(true);
  });
});