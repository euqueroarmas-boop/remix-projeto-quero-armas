import { describe, expect, it } from "vitest";
import {
  ERRO_COMPRA_REPETIDA,
  ehCompraRepetida,
  listaComprasRecentes,
  perguntaCompraRepetida,
  resumoCompraRepetida,
  type CompraRecente,
} from "../recompraServico";

function compra(over: Partial<CompraRecente> = {}): CompraRecente {
  return {
    servico_id: 60,
    servico_nome: "AUTORIZAÇÃO DE COMPRA",
    venda_id: 344,
    minutos_desde_a_ultima: 4,
    ...over,
  };
}

describe("recompraServico", () => {
  it("reconhece só a recusa por compra repetida", () => {
    expect(ehCompraRepetida({ error: ERRO_COMPRA_REPETIDA })).toBe(true);
    expect(ehCompraRepetida({ error: "asaas_payment_failed" })).toBe(false);
    expect(ehCompraRepetida(null)).toBe(false);
  });

  it("lê a lista de compras recentes", () => {
    expect(listaComprasRecentes({ error: ERRO_COMPRA_REPETIDA, servicos: [compra()] })).toHaveLength(1);
    expect(listaComprasRecentes({ error: ERRO_COMPRA_REPETIDA })).toEqual([]);
  });

  it("diz o serviço, o tempo e a venda anterior", () => {
    expect(resumoCompraRepetida({ error: ERRO_COMPRA_REPETIDA, servicos: [compra()] }))
      .toBe("AUTORIZAÇÃO DE COMPRA (há 4 min, venda #344)");
    expect(resumoCompraRepetida({ error: ERRO_COMPRA_REPETIDA, servicos: [compra({ minutos_desde_a_ultima: 0 })] }))
      .toBe("AUTORIZAÇÃO DE COMPRA (há menos de 1 minuto, venda #344)");
  });

  it("não repete o mesmo serviço no resumo", () => {
    expect(resumoCompraRepetida({ error: ERRO_COMPRA_REPETIDA, servicos: [compra(), compra()] }))
      .toBe("AUTORIZAÇÃO DE COMPRA (há 4 min, venda #344)");
  });

  it("pergunta a quem está comprando, sem mandar falar com a equipe", () => {
    const texto = perguntaCompraRepetida({ error: ERRO_COMPRA_REPETIDA, servicos: [compra()] });
    expect(texto).toContain("Quer mesmo fazer uma nova compra?");
    expect(texto.toLowerCase()).not.toContain("equipe");
  });
});
