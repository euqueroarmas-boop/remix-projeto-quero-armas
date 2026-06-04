import { describe, expect, it } from "vitest";
import {
  calcularPrazoProcessual,
  prazoRecursoCumprido,
  ultimoEventoAbertura,
  addDaysISO,
  diffDays,
} from "../prazosProcessuais";

const TODAY = "2026-06-04";

describe("prazosProcessuais — utilitários de data", () => {
  it("diffDays calcula diferença em dias UTC", () => {
    expect(diffDays("2026-06-01", "2026-06-11")).toBe(10);
    expect(diffDays("2026-06-11", "2026-06-01")).toBe(-10);
  });

  it("addDaysISO soma dias preservando ISO", () => {
    expect(addDaysISO("2026-06-01", 10)).toBe("2026-06-11");
    expect(addDaysISO("2026-06-30", 1)).toBe("2026-07-01");
  });

  it("ultimoEventoAbertura retorna o evento mais recente", () => {
    expect(
      ultimoEventoAbertura({
        data_notificacao: "2026-05-10",
        data_indeferimento: "2026-06-01",
        data_restituicao: "2026-04-20",
      })
    ).toBe("2026-06-01");
    expect(ultimoEventoAbertura({})).toBeNull();
  });
});

describe("prazosProcessuais — regras de recurso administrativo", () => {
  it("indeferimento sem recurso => abre prazo de 10 dias", () => {
    const p = calcularPrazoProcessual({ data_indeferimento: "2026-06-01", today: TODAY });
    expect(p).not.toBeNull();
    expect(p!.tipo).toBe("recurso_administrativo");
    expect(p!.eventoBase).toBe("2026-06-01");
    expect(p!.dataLimite).toBe("2026-06-11");
    expect(p!.diasRestantes).toBe(7);
    expect(p!.expirado).toBe(false);
  });

  it("CASO OBRIGATÓRIO: indeferimento + data_recurso_administrativo preenchida => NÃO gera prazo", () => {
    const p = calcularPrazoProcessual({
      data_indeferimento: "2026-06-01",
      data_recurso_administrativo: "2026-06-03",
      today: TODAY,
    });
    expect(p).toBeNull();
    expect(prazoRecursoCumprido({
      data_indeferimento: "2026-06-01",
      data_recurso_administrativo: "2026-06-03",
      today: TODAY,
    })).toBe(true);
  });

  it("recurso protocolado na MESMA data do evento também cumpre o prazo", () => {
    const p = calcularPrazoProcessual({
      data_indeferimento: "2026-06-01",
      data_recurso_administrativo: "2026-06-01",
      today: TODAY,
    });
    expect(p).toBeNull();
  });

  it("notificação é gatilho de prazo equivalente a indeferimento", () => {
    const p = calcularPrazoProcessual({ data_notificacao: "2026-06-01", today: TODAY });
    expect(p?.tipo).toBe("recurso_administrativo");
    expect(p?.eventoBase).toBe("2026-06-01");
  });

  it("CASO OBRIGATÓRIO: evento POSTERIOR ao recurso => gera novo prazo", () => {
    const p = calcularPrazoProcessual({
      data_indeferimento: "2026-05-10",
      data_recurso_administrativo: "2026-05-15",
      // Nova notificação chegou depois do recurso
      data_notificacao: "2026-06-02",
      today: TODAY,
    });
    expect(p).not.toBeNull();
    expect(p!.tipo).toBe("recurso_administrativo");
    expect(p!.eventoBase).toBe("2026-06-02");
    expect(p!.dataLimite).toBe("2026-06-12");
    expect(p!.diasRestantes).toBe(8);
  });

  it("prazo expirado retorna diasRestantes negativo e expirado=true", () => {
    const p = calcularPrazoProcessual({ data_indeferimento: "2026-05-01", today: TODAY });
    expect(p?.expirado).toBe(true);
    expect(p!.diasRestantes).toBeLessThan(0);
  });

  it("sem nenhum evento de abertura => prazo nulo", () => {
    expect(calcularPrazoProcessual({ today: TODAY })).toBeNull();
  });
});

describe("prazosProcessuais — regras de Mandado de Segurança", () => {
  it("CASO OBRIGATÓRIO: data_indeferimento_recurso abre prazo de Mandado de Segurança", () => {
    const p = calcularPrazoProcessual({
      data_indeferimento: "2026-05-01",
      data_recurso_administrativo: "2026-05-05",
      data_indeferimento_recurso: "2026-06-01",
      today: TODAY,
    });
    expect(p).not.toBeNull();
    expect(p!.tipo).toBe("mandado_seguranca");
    expect(p!.eventoBase).toBe("2026-06-01");
    expect(p!.dataLimite).toBe("2026-06-11");
    expect(p!.diasRestantes).toBe(7);
  });

  it("indeferimento do recurso prevalece mesmo sem evento anterior conhecido", () => {
    const p = calcularPrazoProcessual({
      data_indeferimento_recurso: "2026-06-01",
      today: TODAY,
    });
    expect(p?.tipo).toBe("mandado_seguranca");
  });
});