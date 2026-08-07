import { describe, it, expect } from "vitest";
import {
  normalizarStatusDocumento,
  familiaStatusDocumento,
  labelStatusDocumento,
  carimboStatusDocumento,
} from "../statusDocumento";

describe("dicionário canônico de status de documento", () => {
  it("colapsa sinônimos de cumprido", () => {
    for (const s of ["aprovado", "VALIDADO", "conforme", "Concluído", "pre_validado"]) {
      expect(normalizarStatusDocumento(s)).toBe("aprovado");
    }
    for (const s of ["dispensado_grupo", "nao_aplicavel", "dispensado_por_reaproveitamento", "hub_reaproveitado"]) {
      expect(familiaStatusDocumento(s)).toBe("cumprido");
    }
  });

  it("colapsa sinônimos de reprovado e vencido", () => {
    for (const s of ["reprovado", "recusado", "não conforme", "rejeitado", "divergente"]) {
      expect(normalizarStatusDocumento(s)).toBe("reprovado");
    }
    expect(normalizarStatusDocumento("expirado")).toBe("vencido");
    expect(familiaStatusDocumento("vencido")).toBe("pendencia");
  });

  it("trata análise e pendência sem ambiguidade", () => {
    expect(familiaStatusDocumento("pendente_aprovacao")).toBe("analise");
    expect(familiaStatusDocumento("aguardando")).toBe("pendencia");
    expect(familiaStatusDocumento("substituido")).toBe("encerrado");
    expect(familiaStatusDocumento(null)).toBe("pendencia");
  });

  it("gera label e carimbo únicos", () => {
    expect(labelStatusDocumento("validado")).toBe("APROVADO");
    expect(carimboStatusDocumento("pendente_aprovacao")).toBe("analise");
    expect(carimboStatusDocumento("nao_conforme")).toBe("reprovado");
    expect(carimboStatusDocumento("dispensado_grupo")).toBe("aprovado");
  });
});
