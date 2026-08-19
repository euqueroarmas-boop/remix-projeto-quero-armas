import { describe, expect, it } from "vitest";
import {
  ERRO_SERVICO_JA_CONTRATADO,
  ehRecompraBloqueada,
  listaRecusas,
  motivoRecusa,
  resumoRecompra,
  type RecusaCompra,
} from "../recompraServico";

function recusa(over: Partial<RecusaCompra>): RecusaCompra {
  return {
    motivo: "limite_do_servico",
    servico_id: 60,
    servico_slug: "autorizacao-de-compra-posse-de-arma-de-fogo",
    servico_nome: "AUTORIZAÇÃO DE COMPRA",
    ja_tem: 2,
    no_carrinho: 1,
    limite: 2,
    venda_id: 344,
    minutos_desde_a_ultima: 4320,
    ...over,
  };
}

describe("recompraServico", () => {
  it("reconhece a recusa do checkout", () => {
    expect(ehRecompraBloqueada({ error: ERRO_SERVICO_JA_CONTRATADO })).toBe(true);
    expect(ehRecompraBloqueada({ error: "outro" })).toBe(false);
    expect(ehRecompraBloqueada(null)).toBe(false);
  });

  it("lê o motivo e a lista de serviços barrados", () => {
    const corpo = {
      error: ERRO_SERVICO_JA_CONTRATADO,
      motivo: "repeticao_em_minutos",
      servicos: [recusa({ motivo: "repeticao_em_minutos", minutos_desde_a_ultima: 4 })],
    };
    expect(motivoRecusa(corpo)).toBe("repeticao_em_minutos");
    expect(listaRecusas(corpo)).toHaveLength(1);
    expect(listaRecusas({ error: ERRO_SERVICO_JA_CONTRATADO })).toEqual([]);
    expect(motivoRecusa({ error: ERRO_SERVICO_JA_CONTRATADO })).toBeNull();
  });

  it("explica repetição pelo tempo e limite pela contagem", () => {
    expect(
      resumoRecompra({
        error: ERRO_SERVICO_JA_CONTRATADO,
        servicos: [recusa({ motivo: "repeticao_em_minutos", minutos_desde_a_ultima: 4 })],
      }),
    ).toBe("AUTORIZAÇÃO DE COMPRA (comprado há 4 min, venda #344)");

    expect(
      resumoRecompra({ error: ERRO_SERVICO_JA_CONTRATADO, servicos: [recusa({})] }),
    ).toBe("AUTORIZAÇÃO DE COMPRA (já tem 2, limite 2)");
  });

  it("não repete o mesmo serviço no resumo", () => {
    const corpo = { error: ERRO_SERVICO_JA_CONTRATADO, servicos: [recusa({}), recusa({})] };
    expect(resumoRecompra(corpo)).toBe("AUTORIZAÇÃO DE COMPRA (já tem 2, limite 2)");
  });
});
