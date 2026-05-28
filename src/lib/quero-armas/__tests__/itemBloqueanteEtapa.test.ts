import { describe, it, expect } from "vitest";
import {
  isItemBloqueanteParaLiberacaoEtapa,
  isStatusCumprido,
  itemOcultoPorCondicao,
  perguntaPivotRespondida,
} from "../itemBloqueanteEtapa";

describe("isItemBloqueanteParaLiberacaoEtapa", () => {
  it("status cumprido (aprovado) → não bloqueia", () => {
    expect(
      isItemBloqueanteParaLiberacaoEtapa({ status: "aprovado", obrigatorio: true }),
    ).toBe(false);
  });

  it("status hub_reaproveitado → não bloqueia", () => {
    expect(
      isItemBloqueanteParaLiberacaoEtapa({ status: "hub_reaproveitado", obrigatorio: true }),
    ).toBe(false);
  });

  it("pergunta-pivot respondida no JSON → não bloqueia mesmo com status pendente", () => {
    const doc = {
      status: "pendente",
      obrigatorio: true,
      tipo_documento: "pergunta_ainda_reside_imovel",
      regra_validacao: { tipo: "pergunta", chave: "ainda_reside_imovel" },
    };
    expect(
      isItemBloqueanteParaLiberacaoEtapa(doc, { respostas: { ainda_reside_imovel: "sim" } }),
    ).toBe(false);
  });

  it("pergunta-pivot sem resposta e status pendente → bloqueia", () => {
    const doc = {
      status: "pendente",
      obrigatorio: true,
      tipo_documento: "pergunta_responde_inquerito_criminal",
      regra_validacao: { tipo: "pergunta", chave: "responde_inquerito_criminal" },
    };
    expect(isItemBloqueanteParaLiberacaoEtapa(doc, { respostas: {} })).toBe(true);
  });

  it("item condicional oculto (depende_de sem resposta) → não bloqueia", () => {
    const doc = {
      status: "pendente",
      obrigatorio: true,
      tipo_documento: "declaracao_responsavel_imovel",
      regra_validacao: {
        condicional: { depende_de: "comprovante_em_nome", valor: "nao" },
      },
    };
    expect(isItemBloqueanteParaLiberacaoEtapa(doc, { respostas: {} })).toBe(false);
  });

  it("item condicional aplicável (valor bate) e pendente → bloqueia", () => {
    const doc = {
      status: "pendente",
      obrigatorio: true,
      tipo_documento: "declaracao_responsavel_imovel",
      regra_validacao: {
        condicional: { depende_de: "comprovante_em_nome", valor: "nao" },
      },
    };
    expect(
      isItemBloqueanteParaLiberacaoEtapa(doc, { respostas: { comprovante_em_nome: "nao" } }),
    ).toBe(true);
  });

  it("item condicional não aplicável (valor não bate) → não bloqueia", () => {
    const doc = {
      status: "pendente",
      obrigatorio: true,
      regra_validacao: {
        condicional: { depende_de: "comprovante_em_nome", valor: "nao" },
      },
    };
    expect(
      isItemBloqueanteParaLiberacaoEtapa(doc, { respostas: { comprovante_em_nome: "sim" } }),
    ).toBe(false);
  });

  it("item obrigatório, visível, pendente → bloqueia", () => {
    expect(
      isItemBloqueanteParaLiberacaoEtapa({
        status: "pendente",
        obrigatorio: true,
        tipo_documento: "comprovante_endereco_ano_2025",
      }),
    ).toBe(true);
  });

  it("item não obrigatório → nunca bloqueia", () => {
    expect(
      isItemBloqueanteParaLiberacaoEtapa({ status: "pendente", obrigatorio: false }),
    ).toBe(false);
  });

  it("status em análise → bloqueia", () => {
    expect(
      isItemBloqueanteParaLiberacaoEtapa({ status: "em_analise", obrigatorio: true }),
    ).toBe(true);
  });

  it("helpers auxiliares se comportam como esperado", () => {
    expect(isStatusCumprido("dispensado_por_reaproveitamento")).toBe(true);
    expect(isStatusCumprido("rejeitado")).toBe(false);
    expect(
      perguntaPivotRespondida(
        { regra_validacao: { chave: "x" } },
        { x: "valor" },
      ),
    ).toBe(true);
    expect(
      itemOcultoPorCondicao(
        { regra_validacao: { condicional: { depende_de: "k", valor: ["a", "b"] } } },
        { k: "c" },
      ),
    ).toBe(true);
  });
});