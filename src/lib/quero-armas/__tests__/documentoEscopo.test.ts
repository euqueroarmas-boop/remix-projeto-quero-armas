import { describe, it, expect } from "vitest";
import {
  getDocumentoEscopo,
  podeReaproveitarDocumento,
  motivoReaproveitamentoBloqueado,
} from "../documentoEscopo";

describe("documentoEscopo — Bloco 11", () => {
  describe("getDocumentoEscopo", () => {
    it("classifica documentos de arma quando arma_id está preenchido", () => {
      expect(getDocumentoEscopo({ tipo_documento: "qualquer", arma_id: "A1" })).toBe("arma");
    });
    it("classifica documentos de arma pelo tipo (CRAF/GTE/NF)", () => {
      expect(getDocumentoEscopo({ tipo_documento: "craf" })).toBe("arma");
      expect(getDocumentoEscopo({ tipo_documento: "gte_transporte" })).toBe("arma");
      expect(getDocumentoEscopo({ tipo_documento: "nota_fiscal_arma" })).toBe("arma");
    });
    it("classifica RG/CPF/comprovante como cliente", () => {
      expect(getDocumentoEscopo({ tipo_documento: "rg" })).toBe("cliente");
      expect(getDocumentoEscopo({ tipo_documento: "comprovante_endereco" })).toBe("cliente");
      expect(getDocumentoEscopo({ tipo_documento: "certidao_alteracao_nome" })).toBe("cliente");
    });
    it("classifica por etapa permanente quando o tipo não é conhecido", () => {
      expect(getDocumentoEscopo({ tipo_documento: "outro", etapa: "identificacao" })).toBe("cliente");
      expect(getDocumentoEscopo({ tipo_documento: "outro", etapa: "endereco" })).toBe("cliente");
    });
    it("cai em processo quando nada bate", () => {
      expect(getDocumentoEscopo({ tipo_documento: "declaracao_especifica" })).toBe("processo");
      expect(getDocumentoEscopo(null)).toBe("processo");
    });
  });

  describe("podeReaproveitarDocumento", () => {
    it("reaproveita RG entre processos do mesmo cliente", () => {
      expect(
        podeReaproveitarDocumento({ tipo_documento: "rg" }, { tipo_documento: "rg" }),
      ).toBe(true);
    });
    it("reaproveita CRAF da mesma arma", () => {
      expect(
        podeReaproveitarDocumento(
          { tipo_documento: "craf", arma_id: "A1" },
          { tipo_documento: "craf", arma_id: "A1" },
        ),
      ).toBe(true);
    });
    it("NÃO reaproveita CRAF entre armas diferentes", () => {
      expect(
        podeReaproveitarDocumento(
          { tipo_documento: "craf", arma_id: "A1" },
          { tipo_documento: "craf", arma_id: "A2" },
        ),
      ).toBe(false);
    });
    it("NÃO reaproveita documentos de processo automaticamente", () => {
      expect(
        podeReaproveitarDocumento(
          { tipo_documento: "declaracao_x" },
          { tipo_documento: "declaracao_x" },
        ),
      ).toBe(false);
    });
    it("NÃO reaproveita tipos diferentes", () => {
      expect(
        podeReaproveitarDocumento({ tipo_documento: "rg" }, { tipo_documento: "cnh" }),
      ).toBe(false);
    });
    it("NÃO reaproveita doc de arma sem arma_id em algum lado", () => {
      expect(
        podeReaproveitarDocumento(
          { tipo_documento: "craf", arma_id: "A1" },
          { tipo_documento: "craf" },
        ),
      ).toBe(false);
    });
  });

  describe("motivoReaproveitamentoBloqueado", () => {
    it("retorna string vazia quando é permitido", () => {
      expect(
        motivoReaproveitamentoBloqueado({ tipo_documento: "rg" }, { tipo_documento: "rg" }),
      ).toBe("");
    });
    it("explica bloqueio por arma diferente", () => {
      const m = motivoReaproveitamentoBloqueado(
        { tipo_documento: "craf", arma_id: "A1" },
        { tipo_documento: "craf", arma_id: "A2" },
      );
      expect(m).toMatch(/outra arma/i);
    });
    it("explica bloqueio para escopo processo", () => {
      const m = motivoReaproveitamentoBloqueado(
        { tipo_documento: "declaracao_x" },
        { tipo_documento: "declaracao_x" },
      );
      expect(m).toMatch(/processo/i);
    });
  });
});