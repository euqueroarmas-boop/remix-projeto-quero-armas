import { describe, it, expect } from "vitest";
import {
  calcularPrazosProcessuais,
  pickMarcoExato,
} from "../_shared/prazosProcessuais.ts";

function isoToday(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("qa-processo-prazo-alertas (motor + marcos)", () => {
  it("notificação vencendo hoje → marco 0", () => {
    const [p] = calcularPrazosProcessuais([
      { id: "p1", status: "NOTIFICADO", data_notificacao: isoToday(-10) },
    ]);
    expect(p.evento).toBe("NOTIFICAÇÃO");
    expect(pickMarcoExato(p.diasRestantes)).toBe(0);
  });

  it("indeferimento vencido → marco -1", () => {
    const [p] = calcularPrazosProcessuais([
      { id: "p2", status: "INDEFERIDO", data_indeferimento: isoToday(-30) },
    ]);
    expect(p.evento).toBe("INDEFERIMENTO");
    expect(pickMarcoExato(p.diasRestantes)).toBe(-1);
  });

  it("restituição faltando 3 dias → marco 3", () => {
    const [p] = calcularPrazosProcessuais([
      { id: "p3", status: "EM ANÁLISE", data_restituicao: isoToday(-7) },
    ]);
    expect(p.evento).toBe("RESTITUIÇÃO");
    expect(p.diasRestantes).toBe(3);
    expect(pickMarcoExato(p.diasRestantes)).toBe(3);
  });

  it("indeferimento de recurso → MS 120 dias", () => {
    const [p] = calcularPrazosProcessuais([
      {
        id: "p4",
        status: "INDEFERIDO",
        data_indeferimento: isoToday(-50),
        data_indeferimento_recurso: isoToday(0),
      },
    ]);
    expect(p.evento).toBe("MANDADO DE SEGURANÇA");
    expect(p.prazoTotalDias).toBe(120);
    expect(p.diasRestantes).toBe(120);
  });

  it("status finalizado → não gera prazo", () => {
    const out = calcularPrazosProcessuais([
      { id: "p5", status: "DEFERIDO", data_indeferimento: isoToday(-3) },
      { id: "p6", status: "CANCELADO", data_notificacao: isoToday(-1) },
      { id: "p7", status: "DESISTIU", data_notificacao: isoToday(-1) },
    ]);
    expect(out).toHaveLength(0);
  });

  it("marcos não-exatos (ex. 5d, 14d) não disparam (exceto vencido)", () => {
    expect(pickMarcoExato(5)).toBeNull();
    expect(pickMarcoExato(14)).toBeNull();
    expect(pickMarcoExato(31)).toBeNull();
    expect(pickMarcoExato(7)).toBe(7);
    expect(pickMarcoExato(15)).toBe(15);
    expect(pickMarcoExato(30)).toBe(30);
    expect(pickMarcoExato(-5)).toBe(-1);
  });

  it("dedupe key inclui evento + data_limite (mudança abre novo ciclo)", () => {
    const dedupe = (pid: string, ev: string, m: number, canal: string, pd: string) =>
      `${pid}|${ev}|${m}|${canal}|${pd}`;
    const a = dedupe("X", "NOTIFICAÇÃO", 7, "email", "2026-05-20");
    const b = dedupe("X", "NOTIFICAÇÃO", 7, "email", "2026-05-22"); // nova data limite
    const c = dedupe("X", "INDEFERIMENTO", 7, "email", "2026-05-20"); // novo evento
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});