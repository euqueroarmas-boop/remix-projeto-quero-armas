/**
 * BLOCO 3 — Cenários mínimos do KPI Alertas Globais.
 *
 * Testa a engine `getStatusUnificado` + a whitelist de códigos que disparam
 * alerta (replicada aqui em sincronia com `ArsenalView.tsx`). Não toca UI.
 */
import { describe, it, expect } from "vitest";
import {
  getStatusUnificado,
  getStatusValidade,
  reduzirStatus,
  type StatusUnificado,
  type CorStatus,
} from "../statusUnificado";

// Mantenha em sincronia com ArsenalView.tsx (BLOCO 3).
const ALERT_CODES = new Set([
  "indeferido",
  "vencido",
  "pagamento_falhou",
  "exigencia_pf",
  "iminente",
  "vencendo_15",
  "vencendo_30",
  "vencendo_60",
  "vencendo_90",
  "documentos_invalidos",
  "documentos_incompletos",
  "ia_falhou",
  "aguardando_pagamento",
  "aguardando_documentacao",
]);

const NEUTRO: StatusUnificado = {
  dimensao: "vazio",
  codigo: "sem_alerta",
  label: "TUDO EM DIA",
  cor: "cinza",
  prioridade: 10,
};

function consolidar(itens: StatusUnificado[]): StatusUnificado {
  const alertas = itens.filter((s) => ALERT_CODES.has(s.codigo));
  return alertas.length === 0 ? NEUTRO : reduzirStatus(alertas);
}

const HOJE = new Date("2026-05-03T12:00:00Z");
const diasFrente = (n: number) => new Date(HOJE.getTime() + n * 86400000);

describe("BLOCO 3 — KPI Alertas Globais", () => {
  it("1) Todos OK → cinza / TUDO EM DIA", () => {
    const cr = getStatusValidade(diasFrente(300), "CR", HOJE); // ok
    const craf = getStatusValidade(diasFrente(400), "CRAF", HOJE); // ok
    const r = consolidar([cr, craf]);
    expect(r.cor).toBe<CorStatus>("cinza");
    expect(r.label).toBe("TUDO EM DIA");
  });

  it("2) CR vencido → vermelho", () => {
    const cr = getStatusValidade(diasFrente(-3), "CR", HOJE);
    expect(cr.codigo).toBe("vencido");
    const r = consolidar([cr]);
    expect(r.cor).toBe<CorStatus>("vermelho");
  });

  it("3) CRAF vencendo em 90 dias → amarelo (vencendo_90)", () => {
    const craf = getStatusValidade(diasFrente(85), "CRAF", HOJE);
    expect(craf.codigo).toBe("vencendo_90");
    const r = consolidar([craf]);
    expect(r.cor).toBe<CorStatus>("amarelo");
  });

  it("4) GTE vencendo em 15 dias → laranja", () => {
    const gte = getStatusValidade(diasFrente(15), "GTE", HOJE);
    expect(gte.codigo).toBe("vencendo_15");
    const r = consolidar([gte]);
    expect(r.cor).toBe<CorStatus>("laranja");
  });

  it("5) Documento inválido → vermelho", () => {
    const s = getStatusUnificado({
      tipo: "DOCUMENTO_INDIVIDUAL",
      documentos: [{ status: "invalido" }],
      hoje: HOJE,
    });
    expect(s.codigo).toBe("documentos_invalidos");
    const r = consolidar([s]);
    expect(r.cor).toBe<CorStatus>("vermelho");
  });

  it("6) Processo indeferido → vermelho", () => {
    const s = getStatusUnificado({
      tipo: "PROCESSO_ADM",
      solicitacoes: [{ status_servico: "indeferido", status_financeiro: null, status_processo: null }],
      hoje: HOJE,
    });
    expect(s.codigo).toBe("indeferido");
    const r = consolidar([s]);
    expect(r.cor).toBe<CorStatus>("vermelho");
  });

  it("7) Exigência/notificação → laranja", () => {
    const s = getStatusUnificado({
      tipo: "PROCESSO_ADM",
      solicitacoes: [{ status_servico: "notificado", status_financeiro: null, status_processo: null }],
      hoje: HOJE,
    });
    expect(s.codigo).toBe("exigencia_pf");
    const r = consolidar([s]);
    expect(r.cor).toBe<CorStatus>("laranja");
  });

  it("8) Apenas deferido/finalizado/aprovado → não gera alerta", () => {
    const def = getStatusUnificado({
      tipo: "PROCESSO_ADM",
      solicitacoes: [{ status_servico: "deferido", status_financeiro: null, status_processo: null }],
      hoje: HOJE,
    });
    const apr = getStatusUnificado({
      tipo: "DOCUMENTO_INDIVIDUAL",
      documentos: [{ status: "aprovado" }],
      hoje: HOJE,
    });
    expect(ALERT_CODES.has(def.codigo)).toBe(false);
    expect(ALERT_CODES.has(apr.codigo)).toBe(false);
    const r = consolidar([def, apr]);
    expect(r.cor).toBe<CorStatus>("cinza");
    expect(r.label).toBe("TUDO EM DIA");
  });

  it("9) Vencendo_180 → não gera alerta (verde EM DIA)", () => {
    const cr = getStatusValidade(diasFrente(170), "CR", HOJE);
    expect(cr.codigo).toBe("vencendo_180");
    expect(cr.cor).toBe<CorStatus>("verde");
    const r = consolidar([cr]);
    expect(r.cor).toBe<CorStatus>("cinza");
  });

  it("10) Pagamento falhou → vermelho", () => {
    const s = getStatusUnificado({
      tipo: "FINANCEIRO",
      solicitacoes: [{ status_servico: null, status_financeiro: "falhou", status_processo: null }],
      hoje: HOJE,
    });
    expect(s.codigo).toBe("pagamento_falhou");
    const r = consolidar([s]);
    expect(r.cor).toBe<CorStatus>("vermelho");
  });

  it("Reduz para o pior status quando há múltiplos alertas", () => {
    const venc = getStatusValidade(diasFrente(-1), "CR", HOJE); // vermelho
    const v90 = getStatusValidade(diasFrente(85), "CRAF", HOJE); // amarelo
    const r = consolidar([v90, venc]);
    expect(r.cor).toBe<CorStatus>("vermelho");
    expect(r.codigo).toBe("vencido");
  });
});