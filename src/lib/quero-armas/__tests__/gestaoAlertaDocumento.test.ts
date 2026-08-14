import { describe, expect, it } from "vitest";
import {
  documentoSobGestaoDeAlerta,
  instrucaoAindaExigida,
  regimeAlertaDocumento,
} from "../gestaoAlertaDocumento";

/**
 * Regra canônica (14/08/2026): documento de INSTRUÇÃO precisa estar válido no
 * dia do protocolo e para de ser cobrado depois dele. Documento de GESTÃO
 * PERMANENTE (CR, CRAF, GT/GTE, autorização de compra, laudos, atividade CAC)
 * alerta sempre, com ou sem processo.
 */
describe("regime de gestão do alerta", () => {
  const PERMANENTES = [
    "cr",
    "craf",
    "sinarm",
    "gt",
    "gte",
    "autorizacao_compra",
    "laudo_psicologico",
    "laudo_capacidade_tecnica",
    "comprovante_clube_tiro",
    "comprovante_habitualidade",
  ];

  const INSTRUCAO = [
    "comprovante_residencia",
    "antecedentes_criminais",
    "antecedentes_estadual_execucoes",
    "antecedentes_militar",
    "renda_holerite_mes_atual",
    "renda_extrato_inss",
    "boletim_ocorrencia",
    "declaracao_guarda_responsavel",
    "rg_com_cpf",
  ];

  it("classifica os dois regimes", () => {
    for (const tipo of PERMANENTES) expect(regimeAlertaDocumento(tipo), tipo).toBe("permanente");
    for (const tipo of INSTRUCAO) expect(regimeAlertaDocumento(tipo), tipo).toBe("instrucao");
  });

  it("tipo desconhecido não é silenciado", () => {
    expect(regimeAlertaDocumento(null)).toBe("permanente");
    expect(regimeAlertaDocumento("")).toBe("permanente");
  });
});

describe("instrução ainda exigida", () => {
  it("cobra enquanto houver processo antes do protocolo", () => {
    expect(instrucaoAindaExigida([{ status: "aguardando_documentos" }])).toBe(true);
    expect(instrucaoAindaExigida([{ status: "pronto_para_protocolar" }])).toBe(true);
    expect(instrucaoAindaExigida([{ status: "em_analise_interna" }])).toBe(true);
    expect(instrucaoAindaExigida([{ status: "aguardando_pagamento" }])).toBe(true);
  });

  it("para de cobrar quando tudo já foi protocolado", () => {
    expect(instrucaoAindaExigida([{ status: "protocolado" }])).toBe(false);
    expect(instrucaoAindaExigida([{ status: "em_analise_orgao" }])).toBe(false);
    expect(instrucaoAindaExigida([{ status: "deferido" }, { status: "protocolado" }])).toBe(false);
    expect(instrucaoAindaExigida([{ status: "indeferido" }, { status: "cancelado" }])).toBe(false);
  });

  it("um único processo pré-protocolo reabre a cobrança de todos", () => {
    expect(
      instrucaoAindaExigida([{ status: "protocolado" }, { status: "aguardando_documentos" }]),
    ).toBe(true);
  });

  it("exigência aberta da PF reabre a cobrança", () => {
    expect(instrucaoAindaExigida([{ status: "em_exigencia" }])).toBe(true);
    expect(instrucaoAindaExigida([{ status: "protocolado" }, { status: "em_exigencia" }])).toBe(true);
  });

  it("sem processo carregado, cobra (padrão conservador)", () => {
    expect(instrucaoAindaExigida([])).toBe(true);
    expect(instrucaoAindaExigida(null)).toBe(true);
    expect(instrucaoAindaExigida(undefined)).toBe(true);
  });
});

describe("documento sob gestão de alerta", () => {
  it("instrução silencia após o protocolo; permanente nunca silencia", () => {
    const protocolado = { instrucaoExigida: false };
    const montandoPasta = { instrucaoExigida: true };

    expect(documentoSobGestaoDeAlerta("comprovante_residencia", protocolado)).toBe(false);
    expect(documentoSobGestaoDeAlerta("antecedentes_criminais", protocolado)).toBe(false);
    expect(documentoSobGestaoDeAlerta("boletim_ocorrencia", protocolado)).toBe(false);
    expect(documentoSobGestaoDeAlerta("renda_extrato_inss", protocolado)).toBe(false);

    expect(documentoSobGestaoDeAlerta("comprovante_residencia", montandoPasta)).toBe(true);
    expect(documentoSobGestaoDeAlerta("antecedentes_criminais", montandoPasta)).toBe(true);

    for (const tipo of ["cr", "craf", "gte", "gt", "autorizacao_compra", "laudo_psicologico"]) {
      expect(documentoSobGestaoDeAlerta(tipo, protocolado), tipo).toBe(true);
      expect(documentoSobGestaoDeAlerta(tipo, montandoPasta), tipo).toBe(true);
    }
  });
});
