import { describe, expect, it } from "vitest";
import {
  CICLO_CURTO_ATENCAO_DIAS,
  CICLO_CURTO_CRITICO_DIAS,
  faixaVencimento,
  inicioAlertaDias,
  isVencimentoCicloCurto,
} from "../validadeDocumento";
import { janelaAlertaDias, marcosEmailParaTipo } from "../avisosVencimento";

/**
 * Regra do usuário (14/08/2026) para documentos de 30 dias — antecedentes de
 * 30 dias e comprovante de endereço:
 *
 *   nasce em dia e fica ~20 dias VERDE  → 30 até 10 dias
 *   9 a 5 dias   → AMARELO
 *   4 até vencer → VERMELHO
 *
 * Antes: verde só acima de 30 dias, então o documento nascia amarelo e ficava
 * vermelho com 10 dias — metade da vida útil dele.
 */
describe("faixas de vencimento por ciclo do documento", () => {
  const CICLO_CURTO = [
    "antecedentes_criminais",
    "antecedentes_estadual_distribuicao",
    "antecedentes_estadual_execucoes",
    "antecedentes_eleitoral",
    "comprovante_residencia",
    "comprovante_endereco",
  ];

  const NOVENTA_DIAS = [
    "antecedentes_militar",
    "antecedentes_militar_estadual",
    "antecedentes_federal_trf3_regional",
    "antecedentes_federal_sjsp_jef",
  ];

  it("classifica ciclo curto x 90 dias corretamente", () => {
    for (const tipo of CICLO_CURTO) expect(isVencimentoCicloCurto(tipo)).toBe(true);
    for (const tipo of NOVENTA_DIAS) expect(isVencimentoCicloCurto(tipo)).toBe(false);
    for (const tipo of ["cr", "craf", "gte", "laudo_psicologico", "procuracao"]) {
      expect(isVencimentoCicloCurto(tipo)).toBe(false);
    }
  });

  it("ciclo curto: nasce verde e assim fica dos 30 aos 10 dias", () => {
    for (const tipo of CICLO_CURTO) {
      for (const dias of [30, 25, 21, 20, 15, 11, 10]) {
        expect(faixaVencimento(dias, tipo), `${tipo} @ ${dias}d`).toBe("ok");
      }
    }
  });

  it("ciclo curto: amarelo de 9 a 5 dias", () => {
    for (const tipo of CICLO_CURTO) {
      for (const dias of [9, 8, 7, 6, 5]) {
        expect(faixaVencimento(dias, tipo), `${tipo} @ ${dias}d`).toBe("warn");
      }
    }
  });

  it("ciclo curto: vermelho de 4 dias até vencido", () => {
    for (const tipo of CICLO_CURTO) {
      for (const dias of [4, 3, 2, 1, 0, -1, -30]) {
        expect(faixaVencimento(dias, tipo), `${tipo} @ ${dias}d`).toBe("bad");
      }
    }
  });

  it("documentos de ciclo longo mantêm a régua padrão 10/30", () => {
    expect(faixaVencimento(31, "cr")).toBe("ok");
    expect(faixaVencimento(30, "cr")).toBe("warn");
    expect(faixaVencimento(11, "craf")).toBe("warn");
    expect(faixaVencimento(10, "craf")).toBe("bad");
    expect(faixaVencimento(-1, "craf")).toBe("bad");
    // Certidões de 90 dias: 25 dias restantes continuam pedindo programação.
    expect(faixaVencimento(25, "antecedentes_militar")).toBe("warn");
    expect(faixaVencimento(80, "antecedentes_militar")).toBe("ok");
  });

  it("sem prazo conhecido não pinta faixa", () => {
    expect(faixaVencimento(null, "antecedentes_criminais")).toBeNull();
    expect(faixaVencimento(undefined, "cr")).toBeNull();
  });

  it("tipo sem vencimento nunca é tratado como ciclo curto", () => {
    expect(isVencimentoCicloCurto("renda_nf_recente")).toBe(false);
    expect(isVencimentoCicloCurto("certidao_alteracao_nome")).toBe(false);
  });

  it("o alerta só nasce quando a faixa vira amarela", () => {
    for (const tipo of CICLO_CURTO) {
      expect(inicioAlertaDias(tipo)).toBe(CICLO_CURTO_ATENCAO_DIAS);
      expect(janelaAlertaDias(tipo)).toBe(CICLO_CURTO_ATENCAO_DIAS);
    }
    // CR e laudos mantêm as janelas longas; 90 dias mantém a padrão.
    expect(janelaAlertaDias("cr")).toBe(180);
    expect(janelaAlertaDias("laudo_psicologico")).toBe(120);
    expect(janelaAlertaDias("antecedentes_militar")).toBe(30);
  });

  it("e-mail de certidão curta não começa antes do amarelo", () => {
    expect(marcosEmailParaTipo("antecedentes_criminais")?.[0]).toBe(CICLO_CURTO_ATENCAO_DIAS);
    expect(marcosEmailParaTipo("antecedentes_criminais")).not.toContain(15);
    // 90 dias mantém os marcos de 15 e 10.
    expect(marcosEmailParaTipo("antecedentes_militar")).toContain(15);
  });

  it("a fronteira vermelha do ciclo curto é 4 dias", () => {
    expect(CICLO_CURTO_CRITICO_DIAS).toBe(4);
    expect(faixaVencimento(CICLO_CURTO_CRITICO_DIAS, "antecedentes_criminais")).toBe("bad");
    expect(faixaVencimento(CICLO_CURTO_CRITICO_DIAS + 1, "antecedentes_criminais")).toBe("warn");
  });
});
