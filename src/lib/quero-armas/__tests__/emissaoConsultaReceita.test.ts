/**
 * CASO REAL (20/08/2026): cliente com empresa aberta em 07/02/2008 enviou o
 * cartão CNPJ e o QSA emitidos no próprio dia. A IA devolveu a DATA DE
 * ABERTURA como emissão; com "validade = emissão + 30 dias" o documento
 * nasceu vencido em 08/03/2008, foi gravado assim e o QSA — que herda a
 * emissão do cartão aprovado — passou a ser recusado no envio com
 * "DOCUMENTO VENCIDO — SERÁ REJEITADO". Estes testes travam a guarda que
 * descarta emissão implausível de consulta da Receita.
 */
import { describe, expect, it } from "vitest";
import {
  isConsultaReceita,
  sanearEmissaoConsultaReceita,
} from "../emissaoConsultaReceita";

// "Hoje" fixo dos testes: 20/08/2026 ao meio-dia de Brasília.
const HOJE = new Date("2026-08-20T12:00:00-03:00");

describe("isConsultaReceita", () => {
  it("reconhece cartão CNPJ e QSA (inclusive apelidos legados)", () => {
    for (const t of [
      "renda_cartao_cnpj",
      "cartao_cnpj_mei",
      "renda_cnpj_autonomo",
      "cartao_cnpj",
      "renda_qsa",
      "qsa",
    ]) {
      expect(isConsultaReceita(t)).toBe(true);
    }
  });

  it("não engole tipos que têm emissão antiga legítima", () => {
    expect(isConsultaReceita("cr")).toBe(false);
    expect(isConsultaReceita("renda_ccmei")).toBe(false);
    expect(isConsultaReceita("renda_contrato_social")).toBe(false);
  });
});

describe("sanearEmissaoConsultaReceita", () => {
  it("mantém a emissão do rodapé 'Emitido no dia' (recente)", () => {
    expect(
      sanearEmissaoConsultaReceita("renda_cartao_cnpj", "2026-08-20", {}, HOJE),
    ).toBe("2026-08-20");
  });

  it("aceita o formato BR e devolve ISO", () => {
    expect(
      sanearEmissaoConsultaReceita("renda_qsa", "20/08/2026", {}, HOJE),
    ).toBe("2026-08-20");
  });

  it("descarta a DATA DE ABERTURA lida como emissão (caso do cartão de 2008)", () => {
    expect(
      sanearEmissaoConsultaReceita(
        "renda_cartao_cnpj",
        "07/02/2008",
        { data_abertura: "07/02/2008" },
        HOJE,
      ),
    ).toBeNull();
  });

  it("descarta emissão de anos atrás mesmo sem data_abertura para comparar", () => {
    expect(
      sanearEmissaoConsultaReceita("renda_cartao_cnpj", "2008-02-07", {}, HOJE),
    ).toBeNull();
  });

  it("descarta emissão igual à data de abertura mesmo quando recente", () => {
    expect(
      sanearEmissaoConsultaReceita(
        "renda_qsa",
        "2026-08-01",
        { data_abertura: "01/08/2026" },
        HOJE,
      ),
    ).toBeNull();
  });

  it("descarta emissão igual à data da situação cadastral", () => {
    expect(
      sanearEmissaoConsultaReceita(
        "renda_cartao_cnpj",
        "2026-08-10",
        { data_situacao_cadastral: "10/08/2026" },
        HOJE,
      ),
    ).toBeNull();
  });

  it("descarta emissão no futuro (leitura errada)", () => {
    expect(
      sanearEmissaoConsultaReceita("renda_qsa", "2027-01-01", {}, HOJE),
    ).toBeNull();
  });

  it("tipos que não são consulta da Receita passam direto, mesmo antigos", () => {
    expect(sanearEmissaoConsultaReceita("cr", "2008-02-07", {}, HOJE)).toBe(
      "2008-02-07",
    );
  });

  it("sem data ou com texto não-data devolve null sem quebrar", () => {
    expect(sanearEmissaoConsultaReceita("renda_qsa", undefined, {}, HOJE)).toBeNull();
    expect(sanearEmissaoConsultaReceita("renda_qsa", "SEM DATA", {}, HOJE)).toBeNull();
  });
});
