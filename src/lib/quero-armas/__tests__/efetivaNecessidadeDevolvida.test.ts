import { describe, it, expect } from "vitest";
import {
  calcularPassosEfetiva,
  efetivaFoiDevolvida,
} from "../efetivaNecessidadePassos";

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
