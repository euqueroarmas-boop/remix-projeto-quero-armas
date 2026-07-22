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

  it("renumera anexos internos quando um serviço pacote contém vários blocos", () => {
    const html = `
      <section data-anexo-slug="aquisicao-registro-posse-de-arma-de-fogo">
        <h3>ANEXO I — AUTORIZAÇÃO DE COMPRA / POSSE DE ARMA DE FOGO</h3>
        <p>Primeiro serviço do pacote.</p>
        <h3>ANEXO I — CERTIFICADO DE REGISTRO DE ARMA DE FOGO (CRAF)</h3>
        <p>Segundo serviço do pacote.</p>
        <h3>I.19. GUIA DE TRÂNSITO (GT) --- POSSE / SINARM</h3>
        <p>Terceiro serviço do pacote.</p>
      </section>
    `;

    const result = filterContractAnexosBySlugs(html, [
      "aquisicao-registro-posse-de-arma-de-fogo",
    ]);

    expect(result).toContain("ANEXO I — AUTORIZAÇÃO DE COMPRA");
    expect(result).toContain("ANEXO II — CERTIFICADO DE REGISTRO");
    expect(result).toContain("ANEXO III — GUIA DE TRÂNSITO");
    expect(result).not.toContain("ANEXO I — CERTIFICADO DE REGISTRO");
    expect(result).not.toContain("I.19.");
  });

  it("conta o cabecalho geral como anexo I e inicia os anexos reais no II", () => {
    const html = `
      <h2>ANEXO I --- DESCRIÇÃO DOS SERVIÇOS CONTRATADOS</h2>
      <p>Este Anexo I integra o Contrato de Adesão de Assessoria Técnica e Despacho Administrativo.</p>
      <section data-anexo-slug="autorizacao-compra">
        <h3>ANEXO I — AUTORIZAÇÃO DE COMPRA / POSSE DE ARMA DE FOGO</h3>
        <p>Primeiro serviço do pacote.</p>
      </section>
      <section data-anexo-slug="craf">
        <h3>ANEXO I — CERTIFICADO DE REGISTRO DE ARMA DE FOGO (CRAF)</h3>
        <p>Segundo serviço do pacote.</p>
      </section>
    `;

    const result = filterContractAnexosBySlugs(html, ["autorizacao-compra", "craf"]);

    expect(result).toContain("ANEXO I --- DESCRIÇÃO DOS SERVIÇOS CONTRATADOS");
    expect(result).toContain("Este Anexo I integra");
    expect(result).toContain("ANEXO II — AUTORIZAÇÃO DE COMPRA");
    expect(result).toContain("ANEXO III — CERTIFICADO DE REGISTRO");
    expect(result).not.toContain("ANEXO I — AUTORIZAÇÃO DE COMPRA");
    expect(result).not.toContain("ANEXO II — CERTIFICADO DE REGISTRO");
  });
});
