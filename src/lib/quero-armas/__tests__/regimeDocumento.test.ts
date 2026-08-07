import { describe, it, expect } from "vitest";
import {
  getRegimeDocumento,
  getRegimeServico,
  tipoCompativelComRegime,
  podeReaproveitarEntreRegimes,
} from "../regimeDocumento";

describe("regime documental", () => {
  it("classifica interseção, defesa pessoal e CAC", () => {
    expect(getRegimeDocumento("comprovante_residencia")).toBe("comum");
    expect(getRegimeDocumento("cnh")).toBe("comum");
    expect(getRegimeDocumento("comprovante_efetiva_necessidade")).toBe("defesa_pessoal");
    expect(getRegimeDocumento("comprovante_filiacao_entidade_tiro")).toBe("cac");
    expect(getRegimeDocumento("cr")).toBe("cac");
  });

  it("deduz regime do serviço pelo slug", () => {
    expect(getRegimeServico("autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac")).toBe("cac");
    expect(getRegimeServico("posse-de-arma-de-fogo-defesa-pessoal")).toBe("defesa_pessoal");
  });

  it("bloqueia tipo exclusivo no regime errado e libera o comum", () => {
    expect(tipoCompativelComRegime("comprovante_filiacao_entidade_tiro", "cac")).toBe(true);
    expect(tipoCompativelComRegime("comprovante_filiacao_entidade_tiro", "defesa_pessoal")).toBe(false);
    expect(tipoCompativelComRegime("comprovante_efetiva_necessidade", "cac")).toBe(false);
    expect(tipoCompativelComRegime("antecedentes_federal", "cac")).toBe(true);
  });

  it("reaproveita entre regimes apenas o núcleo comum", () => {
    expect(podeReaproveitarEntreRegimes("comprovante_residencia", "cac", "defesa_pessoal")).toBe(true);
    expect(podeReaproveitarEntreRegimes("cr", "cac", "defesa_pessoal")).toBe(false);
  });
});
