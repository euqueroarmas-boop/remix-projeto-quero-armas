import { describe, expect, it } from "vitest";
import {
  ERRO_SERVICO_JA_CONTRATADO,
  ehRecompraBloqueada,
  listaRecompras,
  resumoRecompra,
} from "../recompraServico";

const corpo = {
  error: ERRO_SERVICO_JA_CONTRATADO,
  servicos: [
    { servico_id: 60, servico_nome: "AUTORIZAÇÃO DE COMPRA", venda_id: 344, venda_status: "PAGO", contratada_em: null },
    { servico_id: 60, servico_nome: "AUTORIZAÇÃO DE COMPRA", venda_id: 344, venda_status: "PAGO", contratada_em: null },
    { servico_id: 42, servico_nome: "MUDANÇA DE SERVIÇO", venda_id: 344, venda_status: "PAGO", contratada_em: null },
  ],
};

describe("recompraServico", () => {
  it("reconhece a recusa do checkout", () => {
    expect(ehRecompraBloqueada(corpo)).toBe(true);
    expect(ehRecompraBloqueada({ error: "outro" })).toBe(false);
    expect(ehRecompraBloqueada(null)).toBe(false);
  });

  it("lê a lista de serviços já contratados", () => {
    expect(listaRecompras(corpo)).toHaveLength(3);
    expect(listaRecompras({ error: ERRO_SERVICO_JA_CONTRATADO })).toEqual([]);
  });

  it("resume sem repetir o mesmo serviço da mesma venda", () => {
    expect(resumoRecompra(corpo)).toBe(
      "AUTORIZAÇÃO DE COMPRA (venda #344) · MUDANÇA DE SERVIÇO (venda #344)",
    );
  });
});
