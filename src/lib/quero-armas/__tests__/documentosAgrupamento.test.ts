import { describe, it, expect } from "vitest";
import {
  agruparDocumentosPorFamilia,
  familiaDocumento,
  escolherPrincipal,
} from "../documentosAgrupamento";

const hoje = new Date("2026-07-18T12:00:00Z");

function comprovante(ano: number, emissao: string, id = `res-${ano}`) {
  return {
    id,
    tipo_documento: `comprovante_residencia_${ano}`,
    data_emissao: emissao,
    status: "aprovado",
    ano_competencia: ano,
  };
}

describe("familiaDocumento", () => {
  it("colapsa comprovantes por ano à família canônica", () => {
    expect(familiaDocumento("comprovante_residencia_2022")).toBe("comprovante_residencia");
    expect(familiaDocumento("comprovante_endereco_ano_2024")).toBe("comprovante_residencia");
    expect(familiaDocumento("comprovante_de_endereco")).toBe("comprovante_residencia");
  });
  it("mantém subtipos distintos de certidões", () => {
    expect(familiaDocumento("certidao_criminal_tjsp_distribuicao"))
      .not.toBe(familiaDocumento("certidao_criminal_tjsp_execucoes"));
  });
});

describe("agruparDocumentosPorFamilia — Cenário 1 (comprovantes)", () => {
  it("elege comprovante 2026 como principal e silencia alerta dos vencidos", () => {
    const docs = [
      comprovante(2022, "2022-06-10"),
      comprovante(2023, "2023-06-10"),
      comprovante(2024, "2024-06-10"),
      comprovante(2025, "2025-06-10"),
      comprovante(2026, "2026-06-25"), // emitido 25/06 → vigente até ~25/07 no hoje 18/07
    ];
    const grupos = agruparDocumentosPorFamilia(docs, hoje);
    expect(grupos).toHaveLength(1);
    const g = grupos[0];
    expect(g.familia).toBe("comprovante_residencia");
    expect((g.principal as any).id).toBe("res-2026");
    expect(g.statusConsolidado).toBe("vigente");
    expect(g.versoesAnteriores).toBe(4);
  });
});

describe("agruparDocumentosPorFamilia — Cenário 2 (todos vencidos)", () => {
  it("mantém status vencido quando não há vigente", () => {
    const docs = [
      { id: "psi-1", tipo_documento: "laudo_psicologico", data_emissao: "2024-01-10", status: "aprovado" },
      { id: "psi-2", tipo_documento: "laudo_psicologico", data_emissao: "2025-03-01", status: "aprovado" },
    ];
    const grupos = agruparDocumentosPorFamilia(docs, hoje);
    expect(grupos[0].statusConsolidado).toBe("vencido");
    expect((grupos[0].principal as any).id).toBe("psi-2");
  });
});

describe("agruparDocumentosPorFamilia — Cenário 3 (novo laudo válido)", () => {
  it("novo psicológico vigente vira principal e suprime alerta dos anteriores", () => {
    const docs = [
      { id: "psi-1", tipo_documento: "laudo_psicologico", data_emissao: "2024-01-10", status: "aprovado" },
      { id: "psi-2", tipo_documento: "laudo_psicologico", data_emissao: "2025-03-01", status: "aprovado" },
      { id: "psi-3", tipo_documento: "laudo_psicologico", data_emissao: "2026-07-05", status: "aprovado" },
    ];
    const grupos = agruparDocumentosPorFamilia(docs, hoje);
    expect((grupos[0].principal as any).id).toBe("psi-3");
    expect(grupos[0].statusConsolidado).toBe("vigente");
    expect(grupos[0].alertaSuprimido).toBe(true);
  });
});

describe("escolherPrincipal — priorização", () => {
  it("aprovado+vigente vence sobre vigente não aprovado com validade menor", () => {
    const docs = [
      { id: "a", tipo_documento: "laudo_psicologico", data_emissao: "2026-07-10", status: "pendente" },
      { id: "b", tipo_documento: "laudo_psicologico", data_emissao: "2026-07-01", status: "aprovado" },
    ];
    // ambos vigentes; aprovado com validade mais distante ganha.
    // como emissao(a) > emissao(b), 'a' tem validade mais distante, mas 'b' é aprovado
    // regra 1 (aprovado+vigente) — retorna b se b é o único aprovado
    const principal = escolherPrincipal(docs, hoje);
    expect((principal as any).id).toBe("b");
  });
});

describe("agruparDocumentosPorFamilia — CRAFs de armas distintas não se misturam", () => {
  it("separa CRAFs por numero_serie", () => {
    const docs = [
      { id: "c1", tipo_documento: "craf", data_emissao: "2020-01-01", numero_serie: "ABC123", status: "aprovado" },
      { id: "c2", tipo_documento: "craf", data_emissao: "2026-07-01", numero_serie: "XYZ999", status: "aprovado" },
    ];
    const grupos = agruparDocumentosPorFamilia(docs, hoje);
    expect(grupos).toHaveLength(2);
  });
});