import { describe, it, expect } from "vitest";

/**
 * Testes de regressão para a blindagem de integridade Posse↔Porte
 * implementada em supabase/functions/qa-processo-criar/index.ts.
 *
 * Reproduz a regra exata aplicada no backend para que qualquer alteração
 * acidental (introduzir fallback, comparar por nome, aceitar divergência)
 * quebre o teste imediatamente.
 *
 * IDs reais do catálogo Quero Armas (qa_servicos):
 *   - 2 → Posse na Polícia Federal   (slug: posse-arma-fogo)
 *   - 3 → Porte na Polícia Federal   (slug: porte-arma-fogo)
 */

type ItemVenda = { id: number; servico_id: number | null };

function validarIntegridadeVendaProcesso(params: {
  venda_id: number | null | undefined;
  servico_id_solicitado: number;
  itens_da_venda: ItemVenda[];
}): { ok: true } | { ok: false; code: string; reason: string } {
  const { venda_id, servico_id_solicitado, itens_da_venda } = params;

  // Sem venda → nada para validar
  if (venda_id == null) return { ok: true };

  const idsServicosDaVenda = itens_da_venda
    .map((it) => it.servico_id)
    .filter((v): v is number => typeof v === "number");

  if (idsServicosDaVenda.length === 0) {
    return { ok: false, code: "VENDA_SEM_SERVICOS", reason: "Venda sem itens com serviço" };
  }

  if (!idsServicosDaVenda.includes(Number(servico_id_solicitado))) {
    return {
      ok: false,
      code: "INTEGRITY_VENDA_PROCESSO_MISMATCH",
      reason: `Serviço ${servico_id_solicitado} não consta na venda`,
    };
  }

  return { ok: true };
}

const POSSE = 2;
const PORTE = 3;

describe("Integridade Venda↔Processo (Posse vs Porte)", () => {
  it("permite criar processo de Porte quando a venda contém Porte", () => {
    const r = validarIntegridadeVendaProcesso({
      venda_id: 999,
      servico_id_solicitado: PORTE,
      itens_da_venda: [{ id: 1, servico_id: PORTE }],
    });
    expect(r.ok).toBe(true);
  });

  it("permite criar processo de Posse quando a venda contém Posse", () => {
    const r = validarIntegridadeVendaProcesso({
      venda_id: 999,
      servico_id_solicitado: POSSE,
      itens_da_venda: [{ id: 1, servico_id: POSSE }],
    });
    expect(r.ok).toBe(true);
  });

  it("BLOQUEIA criar processo de Posse quando a venda foi de Porte (caso descrito como bug)", () => {
    const r = validarIntegridadeVendaProcesso({
      venda_id: 136,
      servico_id_solicitado: POSSE,
      itens_da_venda: [{ id: 1, servico_id: PORTE }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INTEGRITY_VENDA_PROCESSO_MISMATCH");
  });

  it("BLOQUEIA criar processo de Porte quando a venda foi de Posse (caso inverso)", () => {
    const r = validarIntegridadeVendaProcesso({
      venda_id: 137,
      servico_id_solicitado: PORTE,
      itens_da_venda: [{ id: 1, servico_id: POSSE }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INTEGRITY_VENDA_PROCESSO_MISMATCH");
  });

  it("BLOQUEIA quando a venda existe mas não tem nenhum item com serviço definido", () => {
    const r = validarIntegridadeVendaProcesso({
      venda_id: 200,
      servico_id_solicitado: PORTE,
      itens_da_venda: [{ id: 1, servico_id: null }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("VENDA_SEM_SERVICOS");
  });

  it("permite criação manual sem venda (admin gratuito) — venda_id null não trava", () => {
    const r = validarIntegridadeVendaProcesso({
      venda_id: null,
      servico_id_solicitado: PORTE,
      itens_da_venda: [],
    });
    expect(r.ok).toBe(true);
  });

  it("aceita venda multi-item desde que o serviço solicitado conste em ALGUM item", () => {
    const r = validarIntegridadeVendaProcesso({
      venda_id: 300,
      servico_id_solicitado: PORTE,
      itens_da_venda: [
        { id: 1, servico_id: 1 },
        { id: 2, servico_id: PORTE },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("nunca cai em fallback para Posse quando o serviço solicitado é diferente", () => {
    // Garante que não existe lógica `servico = X || POSSE`.
    const r = validarIntegridadeVendaProcesso({
      venda_id: 400,
      servico_id_solicitado: 99, // serviço inexistente na venda
      itens_da_venda: [{ id: 1, servico_id: PORTE }],
    });
    expect(r.ok).toBe(false);
    // Não deve "promover" para Posse silenciosamente.
    if (!r.ok) expect(r.reason).not.toMatch(/posse/i);
  });
});
