import { describe, it, expect } from "vitest";
import { montarLinhaEntrega } from "../hubEntregaAuditoria";

const doc = (over: Record<string, unknown> = {}) => ({
  id: "d1",
  tipo_documento: "antecedentes_eleitoral",
  status: "aprovado",
  origem: "cliente",
  created_at: "2026-08-11T17:05:00Z",
  ...over,
});

const codigos = (itens: ReturnType<typeof montarLinhaEntrega>) =>
  itens.flatMap((i) => i.anotacoes.map((a) => a.codigo));

describe("hubEntregaAuditoria", () => {
  it("CNH entregue casa com o slot de CIN do checklist", () => {
    const itens = montarLinhaEntrega(
      [doc({ tipo_documento: "cnh", nome_documento: "CNH" })],
      [{ tipo_documento: "cin", nome_documento: "CIN", status: "pendente", ordem: 20, created_at: "2026-08-06T00:00:00Z" }],
    );
    expect(codigos(itens)).not.toContain("sem_exigencia");
  });

  it("exigência criada depois da entrega não gera atropelo", () => {
    const itens = montarLinhaEntrega(
      [doc()],
      [
        { tipo_documento: "renda_ccmei", nome_documento: "CCMEI", status: "pendente", ordem: 160, created_at: "2026-08-11T21:02:00Z" },
        { tipo_documento: "antecedentes_eleitoral", status: "pendente", ordem: 330, created_at: "2026-08-06T00:00:00Z" },
      ],
    );
    expect(codigos(itens)).not.toContain("fora_de_ordem");
  });

  it("laudo pendente não conta como etapa pulada", () => {
    const itens = montarLinhaEntrega(
      [doc()],
      [
        { tipo_documento: "laudo_psicologico", nome_documento: "Laudo Psicológico", status: "pendente", ordem: 290, created_at: "2026-08-06T00:00:00Z" },
        { tipo_documento: "antecedentes_eleitoral", status: "pendente", ordem: 330, created_at: "2026-08-06T00:00:00Z" },
      ],
    );
    expect(codigos(itens)).not.toContain("fora_de_ordem");
  });

  it("ainda sinaliza quando um item exigível de verdade foi pulado", () => {
    const itens = montarLinhaEntrega(
      [doc()],
      [
        { tipo_documento: "comprovante_residencia", nome_documento: "Comprovante de residência", status: "pendente", ordem: 40, created_at: "2026-08-06T00:00:00Z" },
        { tipo_documento: "antecedentes_eleitoral", status: "pendente", ordem: 330, created_at: "2026-08-06T00:00:00Z" },
      ],
    );
    expect(codigos(itens)).toContain("fora_de_ordem");
  });
});