import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  calcularPassosEfetiva,
  efetivaFoiDevolvida,
} from "../efetivaNecessidadePassos";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

// Registro de um cliente que percorreu o questionário inteiro, entregou o BO e
// aprovou o relato — o estado exato em que a equipe pode devolver para ajustes.
const REGISTRO_COMPLETO = {
  tem_bo: true,
  tem_inquerito: false,
  tem_acao_criminal: false,
  sofre_ameaca: true,
  relato_cliente: "Relato do cliente com os fatos.",
  contexto_risco: "Rotina de risco descrita.",
  narrativa_final: "Narrativa final aprovada pelo requerente.",
  bo_pendente_registro: false,
  aprovado_cliente: true,
  status: "em_revisao",
};

const PROVAS_BO = [{ tipo: "boletim_ocorrencia", data_fato: new Date().toISOString() }];

const passo = (registro: any, id: string) =>
  calcularPassosEfetiva(registro, PROVAS_BO, true).find((p) => p.id === id);

describe("efetiva necessidade devolvida para ajustes", () => {
  it("reconhece o status de devolução", () => {
    expect(efetivaFoiDevolvida({ status: "devolvido" })).toBe(true);
    expect(efetivaFoiDevolvida({ status: "DEVOLVIDO" })).toBe(true);
    expect(efetivaFoiDevolvida({ status: "em_revisao" })).toBe(false);
    expect(efetivaFoiDevolvida({ status: "aprovado" })).toBe(false);
    expect(efetivaFoiDevolvida(null)).toBe(false);
  });

  it("fecha a defesa final enquanto o relato está em revisão da equipe", () => {
    expect(passo(REGISTRO_COMPLETO, "defesa_final")?.concluido).toBe(true);
    expect(
      calcularPassosEfetiva(REGISTRO_COMPLETO, PROVAS_BO, true).every((p) => p.concluido),
    ).toBe(true);
  });

  it("reabre a defesa final quando a equipe devolve para ajustes", () => {
    const devolvido = {
      ...REGISTRO_COMPLETO,
      status: "devolvido",
      devolucao_motivo: "DEVOLVENDO PARA AJUSTES",
    };
    expect(passo(devolvido, "defesa_final")?.concluido).toBe(false);
    // Só a defesa final volta: o cliente não refaz o questionário nem o BO.
    const outros = calcularPassosEfetiva(devolvido, PROVAS_BO, true).filter(
      (p) => p.id !== "defesa_final",
    );
    expect(outros.every((p) => p.concluido)).toBe(true);
  });

  it("volta a fechar quando o cliente aprova o texto ajustado", () => {
    const reaprovado = { ...REGISTRO_COMPLETO, status: "em_revisao", devolucao_motivo: null };
    expect(passo(reaprovado, "defesa_final")?.concluido).toBe(true);
  });
});

describe("fila do portal reabre a efetiva pelos passos, não pelo status da linha", () => {
  const src = r("src/pages/quero-armas/QAClientePortalPage.tsx");

  it("a exigência entra na fila quando há passo pendente, mesmo aprovada", () => {
    // A linha do checklist fica `aprovado` depois do aceite do cliente. Sem
    // esta exceção o guiado pula a Efetiva necessidade e trava nos Laudos.
    expect(src).toMatch(/const temPassoEfetivaPendente\s*=/);
    expect(src).toMatch(
      /return isChecklistPendente\(d\.status\) \|\| temPassoEfetivaPendente\(d\);/,
    );
  });

  it("o resumo conta a efetiva devolvida como pendência", () => {
    expect(src).toMatch(/const efetivaEmAberto\s*=/);
    expect(src).toMatch(/!concluido\(d\) \|\| efetivaEmAberto\(d\)/);
  });
});

describe("a devolução reabre a linha do checklist no backend", () => {
  const src = r("supabase/functions/qa-efetiva-revisar/index.ts");

  it("grava status pendente em qa_processo_documentos ao devolver", () => {
    expect(src).toMatch(/acao === "devolver" && reg\.processo_id/);
    expect(src).toMatch(/from\("qa_processo_documentos"\)/);
    expect(src).toMatch(/status: "ajuste_necessario"/);
  });

  it("cobre os três códigos com que a efetiva aparece no checklist", () => {
    for (const tipo of [
      "declaracao_necessidade_efetiva",
      "comprovante_efetiva_necessidade",
      "efetiva_necessidade",
    ]) {
      expect(src).toContain(tipo);
    }
  });
});
