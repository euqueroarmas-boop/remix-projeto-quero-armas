import { describe, expect, it } from "vitest";
import { filterContractAnexosBySlugs } from "../contractAnexoFilter";

describe("filterContractAnexosBySlugs", () => {
  it("renumera os titulos dos anexos contratados em ordem sequencial", () => {
    const html = `
      <section data-anexo-slug="autorizacao-compra">
        <h3>ANEXO I — AUTORIZAÇÃO DE COMPRA / POSSE DE ARMA DE FOGO</h3>
        <p>Autorização de compra conforme normas aplicáveis.</p>
      </section>
      <section data-anexo-slug="craf">
        <h3>ANEXO I — CERTIFICADO DE REGISTRO DE ARMA DE FOGO (CRAF) E GUIA DE TRÂNSITO (GT)</h3>
        <p>Emissão do CRAF e Guia de Trânsito.</p>
      </section>
      <section data-anexo-slug="porte">
        <h3>ANEXO I — PORTE DE ARMA DE FOGO</h3>
        <p>Não contratado.</p>
      </section>
    `;

    const result = filterContractAnexosBySlugs(html, ["autorizacao-compra", "craf"]);

    expect(result).toContain("ANEXO I — AUTORIZAÇÃO DE COMPRA");
    expect(result).toContain("ANEXO II — CERTIFICADO DE REGISTRO");
    expect(result).not.toContain("ANEXO I — CERTIFICADO DE REGISTRO");
    expect(result).not.toContain("PORTE DE ARMA DE FOGO");
  });
});
