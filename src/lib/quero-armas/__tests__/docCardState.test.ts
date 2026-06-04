import { describe, expect, it } from "vitest";
import { computeDocCardState } from "../docCardState";

describe("computeDocCardState", () => {
  it("documento reaproveitado vira card verde 'JÁ RECEBIDO'", () => {
    const s = computeDocCardState({
      uploadStatus: "pendente",
      extractionStatus: "dispensado_por_reaproveitamento",
      exigeExtracaoIA: true,
      reaproveitado: true,
    });
    expect(s.tone).toBe("success");
    expect(s.badge).toBe("JÁ RECEBIDO");
    expect(s.podeAvancar).toBe(true);
  });

  it("upload OK + extração OK => verde 'DADOS EXTRAÍDOS'", () => {
    const s = computeDocCardState({
      uploadStatus: "enviado",
      extractionStatus: "extraido",
      fileName: "cnh.jpg",
      exigeExtracaoIA: true,
    });
    expect(s.tone).toBe("success");
    expect(s.badge).toBe("DADOS EXTRAÍDOS");
    expect(s.hint).toContain("cnh.jpg");
    expect(s.podeAvancar).toBe(true);
  });

  it("upload OK + extração falhou => âmbar 'REVISÃO MANUAL' e NÃO verde", () => {
    const s = computeDocCardState({
      uploadStatus: "enviado",
      extractionStatus: "falhou",
      fileName: "cnh.jpg",
      exigeExtracaoIA: true,
      extractionError: "Não conseguimos ler",
    });
    expect(s.tone).toBe("warn");
    expect(s.tone).not.toBe("success");
    expect(s.badge).toBe("REVISÃO MANUAL");
    expect(s.hint).toMatch(/Arquivo recebido/);
    expect(s.podeAvancar).toBe(true); // não trava o fluxo
  });

  it("upload OK em documento sem extração IA => verde 'ARQUIVO RECEBIDO'", () => {
    const s = computeDocCardState({
      uploadStatus: "enviado",
      extractionStatus: "pendente",
      fileName: "cr.pdf",
      exigeExtracaoIA: false,
    });
    expect(s.tone).toBe("success");
    expect(s.badge).toBe("ARQUIVO RECEBIDO");
    expect(s.podeAvancar).toBe(true);
  });

  it("upload em curso (extraindo) NÃO trava o botão continuar", () => {
    const s = computeDocCardState({
      uploadStatus: "enviado",
      extractionStatus: "extraindo",
      exigeExtracaoIA: true,
    });
    expect(s.podeAvancar).toBe(true);
    expect(s.tone).toBe("neutral");
  });

  it("upload falhou => vermelho e bloqueia avanço", () => {
    const s = computeDocCardState({
      uploadStatus: "erro",
      extractionStatus: "pendente",
      exigeExtracaoIA: true,
      errorMsg: "rede caiu",
    });
    expect(s.tone).toBe("error");
    expect(s.podeAvancar).toBe(false);
    expect(s.hint).toContain("rede caiu");
  });

  it("pendente puro => neutro, bloqueia avanço", () => {
    const s = computeDocCardState({
      uploadStatus: "pendente",
      extractionStatus: "pendente",
      exigeExtracaoIA: true,
    });
    expect(s.tone).toBe("neutral");
    expect(s.podeAvancar).toBe(false);
  });
});