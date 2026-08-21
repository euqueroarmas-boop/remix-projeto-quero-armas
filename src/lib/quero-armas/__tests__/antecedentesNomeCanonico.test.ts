import { describe, expect, it } from "vitest";
import {
  HUB_TIPOS_DOCUMENTO,
  NOME_CANONICO_ANTECEDENTES,
  getNomeDocumentoDisplay,
  getTipoDocumentoMeta,
} from "../documentosHubCatalogo";

/**
 * O padrão de nome das certidões de antecedentes é ÚNICO.
 *
 * Regressão coberta aqui: o catálogo do Hub tinha uma lista de rótulos e o
 * nome inferido do documento tinha outra. O mesmo documento aparecia como
 * "Certidão Estadual de Distribuições Criminais — TJSP" no resumo do cliente e
 * como "Certidão de Distribuição de Ações Criminais — TJSP" no Hub Documental.
 */
describe("padrão canônico das certidões de antecedentes", () => {
  const tiposAntecedentes = HUB_TIPOS_DOCUMENTO.filter((t) => t.value.startsWith("antecedentes_"));

  it("cobre todos os tipos antecedentes_* do catálogo", () => {
    expect(tiposAntecedentes.length).toBeGreaterThan(0);
    for (const tipo of tiposAntecedentes) {
      expect(NOME_CANONICO_ANTECEDENTES[tipo.value]).toBeTruthy();
    }
  });

  it("usa o mesmo nome no catálogo (Hub) e na exibição do documento", () => {
    for (const tipo of tiposAntecedentes) {
      const canonico = NOME_CANONICO_ANTECEDENTES[tipo.value];
      expect(tipo.label).toBe(canonico);
      // Caminho "só conheço o tipo" — seletor "Alterar tipo", chips, e-mails.
      expect(getNomeDocumentoDisplay({ tipo_documento: tipo.value }, "Documento")).toBe(canonico);
    }
  });

  it("segue o formato 'Certidão <espécie> — <órgão>'", () => {
    for (const tipo of tiposAntecedentes) {
      expect(tipo.label.startsWith("Certidão ")).toBe(true);
      expect(tipo.label).toContain(" — ");
    }
  });

  it("o nome canônico vence o título literal que a IA leu do PDF", () => {
    const nome = getNomeDocumentoDisplay({
      tipo_documento: "antecedentes_estadual_execucoes",
      nome_documento: "CERTIDÃO ESTADUAL TJSP — EXECUÇÕES CRIMINAIS Nº 1448406",
    });
    // O rótulo perdeu o "— TJSP" em 21/08: o cofre é do cliente, e o cliente
    // pode ser de qualquer estado. O que este teste verifica continua igual —
    // o nome canônico vence o título que a IA leu do PDF.
    expect(nome).toBe("Certidão Estadual de Execuções Criminais — Tribunal de Justiça");
  });

  it("mantém STM e TJM como certidões distintas", () => {
    expect(getTipoDocumentoMeta("antecedentes_militar")?.label).toBe(
      "Certidão Negativa de Crimes Militares — Justiça Militar da União (STM)",
    );
    expect(getTipoDocumentoMeta("antecedentes_militar_estadual")?.label).toBe(
      "Certidão de Antecedentes Criminais — Justiça Militar Estadual (TJM)",
    );
    // Registro legado gravado como `antecedentes_militar` mas que é do TJM:
    // o texto do documento desempata e o nome sai o do TJM.
    expect(
      getNomeDocumentoDisplay({
        tipo_documento: "antecedentes_militar",
        nome_documento: "CERTIDAO",
        orgao_emissor: "TJM",
      }),
    ).toBe("Certidão de Antecedentes Criminais — Justiça Militar Estadual (TJM)");
  });
});
