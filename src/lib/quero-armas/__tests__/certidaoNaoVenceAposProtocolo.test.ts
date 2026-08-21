// ============================================================================
// LEI 9.784/99 — certidão não vence depois do protocolo
// ----------------------------------------------------------------------------
// Regra do titular (20/08/2026): protocolou, o relógio da certidão para — a
// demora passa a ser da Administração. Ele SÓ volta se a delegacia obrigar,
// por NOTIFICAÇÃO (exigência) ou RECURSO ADMINISTRATIVO. Vale para SIGMA e
// SINARM.
//
// A regra vive em TRÊS lugares que precisam concordar: o front
// (gestaoAlertaDocumento), o espelho Deno do robô de e-mails
// (faixaAlertaDocumento) e o cálculo SQL do prazo crítico (migration). Este
// arquivo cobra os três.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { instrucaoAindaExigida } from "../gestaoAlertaDocumento";

const ler = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

const MIGRATION = ler(
  "supabase/migrations/20260821010000_certidao_nao_vence_apos_protocolo.sql",
);
const ESPELHO = ler("supabase/functions/_shared/faixaAlertaDocumento.ts");
const CRON = ler("supabase/functions/qa-vencimentos-alertas/index.ts");

describe("o relógio para no protocolo", () => {
  it("processo protocolado não exige mais instrução", () => {
    expect(instrucaoAindaExigida([{ status: "protocolado" }])).toBe(false);
    expect(instrucaoAindaExigida([{ status: "em_analise_orgao" }])).toBe(false);
    expect(instrucaoAindaExigida([{ status: "deferido" }])).toBe(false);
  });

  it("antes do protocolo o relógio corre normalmente", () => {
    expect(instrucaoAindaExigida([{ status: "aguardando_documentos" }])).toBe(true);
    expect(instrucaoAindaExigida([{ status: "em_andamento" }])).toBe(true);
  });
});

describe("o relógio volta quando a delegacia obriga", () => {
  it("notificação religa", () => {
    expect(instrucaoAindaExigida([{ status: "notificado" }])).toBe(true);
    expect(instrucaoAindaExigida([{ status: "em_exigencia" }])).toBe(true);
  });

  it("recurso administrativo religa — a regra nova do titular", () => {
    expect(instrucaoAindaExigida([{ status: "recurso_administrativo" }])).toBe(true);
    expect(instrucaoAindaExigida([{ status: "em_recurso" }])).toBe(true);
  });
});

describe("o espelho Deno concorda com o front", () => {
  it("recurso administrativo está no espelho também", () => {
    const i = ESPELHO.indexOf("STATUS_PROCESSO_EXIGENCIA");
    const bloco = ESPELHO.slice(i, ESPELHO.indexOf("]);", i));
    expect(bloco).toContain('"recurso_administrativo"');
    expect(bloco).toContain('"em_recurso"');
  });
});

describe("o robô de e-mails usa o espelho, não lista própria", () => {
  it("o ramo do dossiê decide por instrucaoAindaExigida", () => {
    const i = CRON.indexOf("4.5) DOSSIÊ");
    const bloco = CRON.slice(i, i + 2500);
    expect(bloco).toContain("instrucaoAindaExigida([{ status: p.status }])");
  });

  it("a lista local que silenciava quem estava em exigência morreu", () => {
    const i = CRON.indexOf("4.5) DOSSIÊ");
    const bloco = CRON.slice(i, i + 2500);
    expect(bloco).not.toContain("POS_PROTOCOLO = new Set");
  });
});

describe("o cálculo SQL do prazo crítico obedece", () => {
  it("existe o portão qa_processo_relogio_parado", () => {
    expect(MIGRATION).toContain("FUNCTION public.qa_processo_relogio_parado");
    expect(MIGRATION).toContain("p.protocolo_data IS NOT NULL");
  });

  it("relógio parado zera o prazo crítico em vez de calculá-lo", () => {
    expect(MIGRATION).toContain("IF v_relogio_parado THEN");
    const i = MIGRATION.indexOf("IF v_relogio_parado THEN");
    const bloco = MIGRATION.slice(i, i + 220);
    expect(bloco).toContain("v_min_data     := NULL");
  });

  it("notificação e recurso religam também no SQL", () => {
    const i = MIGRATION.indexOf("NOT IN (");
    const bloco = MIGRATION.slice(i, MIGRATION.indexOf(")", i) + 1);
    expect(bloco).toContain("'notificado'");
    expect(bloco).toContain("'recurso_administrativo'");
  });

  it("o gatilho recalcula quando status ou protocolo mudam", () => {
    expect(MIGRATION).toContain("AFTER UPDATE OF status, protocolo_data ON public.qa_processos");
  });

  it("o acerto dos processos já protocolados está no bloco", () => {
    expect(MIGRATION).toContain("qa_processo_relogio_parado(p.id)");
  });
});
