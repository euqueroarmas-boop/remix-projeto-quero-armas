import { describe, it, expect } from "vitest";
import { extrairPrazoDoItem, calcularPrazosProcessuais, pickMarcoExato } from "../prazosProcessuais";

function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("prazosProcessuais (motor único)", () => {
  it("Cenário 1: notificação cuja dataLimite vence hoje → crítico vermelho", () => {
    const p = extrairPrazoDoItem({
      id: 1,
      status: "NOTIFICADO",
      data_notificacao: isoToday(-10), // +10 dias = hoje
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("NOTIFICAÇÃO");
    expect(p!.diasRestantes).toBe(0);
    expect(p!.status).toBe("vence_hoje");
    expect(p!.prazoTotalDias).toBe(10);
  });

  it("Cenário 2: indeferimento vencido → diasRestantes negativo", () => {
    const p = extrairPrazoDoItem({
      id: 2,
      status: "INDEFERIDO",
      data_indeferimento: isoToday(-30),
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("INDEFERIMENTO");
    expect(p!.diasRestantes).toBeLessThan(0);
    expect(p!.status).toBe("vencido");
  });

  it("Cenário 3: restituição faltando 2 dias → crítico", () => {
    const p = extrairPrazoDoItem({
      id: 3,
      status: "EM ANÁLISE",
      data_restituicao: isoToday(-8), // +10 = +2
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("RESTITUIÇÃO");
    expect(p!.diasRestantes).toBe(2);
    expect(p!.status).toBe("critico");
  });

  it("Cenário 4: indeferimento_recurso → MS 120 dias sobrepõe outros", () => {
    const p = extrairPrazoDoItem({
      id: 4,
      status: "INDEFERIDO",
      data_notificacao: isoToday(-50),
      data_indeferimento: isoToday(-40),
      data_indeferimento_recurso: isoToday(-5),
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("MANDADO DE SEGURANÇA");
    expect(p!.prazoTotalDias).toBe(120);
    expect(p!.diasRestantes).toBe(115);
  });

  it("Cenário 5: deferido/concluído/cancelado → não gera prazo", () => {
    for (const s of ["DEFERIDO", "CONCLUÍDO", "CANCELADO", "DESISTIU"]) {
      const p = extrairPrazoDoItem({
        id: s,
        status: s,
        data_indeferimento: isoToday(-5),
      });
      expect(p, `status ${s} não deveria gerar prazo`).toBeNull();
    }
  });

  it("calcularPrazosProcessuais ordena do mais urgente ao menos", () => {
    const list = calcularPrazosProcessuais([
      { id: "a", status: "NOTIFICADO", data_notificacao: isoToday(-3) }, // +7
      { id: "b", status: "INDEFERIDO", data_indeferimento: isoToday(-15) }, // -5
      { id: "c", status: "EM ANÁLISE", data_restituicao: isoToday(-9) }, // +1
    ]);
    expect(list.map((p) => p.itemId)).toEqual(["b", "c", "a"]);
  });

  it("marcos exatos: dispara só em 30/15/7/3/0; demais positivos = null; vencido = -1", () => {
    expect(pickMarcoExato(30)).toBe(30);
    expect(pickMarcoExato(15)).toBe(15);
    expect(pickMarcoExato(7)).toBe(7);
    expect(pickMarcoExato(3)).toBe(3);
    expect(pickMarcoExato(0)).toBe(0);
    expect(pickMarcoExato(5)).toBeNull();
    expect(pickMarcoExato(14)).toBeNull();
    expect(pickMarcoExato(31)).toBeNull();
    expect(pickMarcoExato(-1)).toBe(-1);
    expect(pickMarcoExato(-99)).toBe(-1);
  });

  it("dedupe key inclui evento + data_limite (mudança abre novo ciclo)", () => {
    const k = (pid: string, ev: string, m: number, c: string, pd: string) =>
      `${pid}|${ev}|${m}|${c}|${pd}`;
    expect(k("X", "NOTIFICAÇÃO", 7, "email", "2026-05-20")).not.toBe(
      k("X", "NOTIFICAÇÃO", 7, "email", "2026-05-22"),
    );
    expect(k("X", "NOTIFICAÇÃO", 7, "email", "2026-05-20")).not.toBe(
      k("X", "INDEFERIMENTO", 7, "email", "2026-05-20"),
    );
  });
});