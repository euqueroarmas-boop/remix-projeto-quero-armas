import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  STATUS_EXIGENCIA_VENCIDA,
  avisoReemissaoAdiada,
  ehReemissaoDeVencido,
} from "../reemissaoVencido";
import { exigenciaCobravelAgora, separarPorResponsavel } from "../etapaFinalProtocolo";
import { normalizarStatusDocumento } from "../statusDocumento";

/* =============================================================================
 * A decisão sob teste (usuário, 19/08/2026, valendo para TODOS os clientes):
 * documento que venceu não é cobrado do cliente na hora — a reemissão espera o
 * processo ficar pronto para protocolar.
 * ========================================================================== */

const CERTIDAO_VENCIDA = { tipo_documento: "antecedentes_eleitoral", status: "expirado" };
const CERTIDAO_OK = { tipo_documento: "antecedentes_eleitoral", status: "entregue_pelo_hub" };
const CERTIDAO_PENDENTE = { tipo_documento: "antecedentes_eleitoral", status: "pendente" };
const CERTIDAO_REPROVADA = { tipo_documento: "antecedentes_eleitoral", status: "rejeitado" };
const GRU = { tipo_documento: "gru_boleto", status: "pendente" };

describe("ehReemissaoDeVencido", () => {
  it("reconhece os quatro aliases de vencido", () => {
    for (const st of ["expirado", "expirada", "vencido", "vencida", "EXPIRADO", " Vencido "]) {
      expect(ehReemissaoDeVencido({ status: st })).toBe(true);
    }
  });

  it("não confunde vencido com reprovado, pendente ou entregue", () => {
    for (const st of ["rejeitado", "reprovado", "invalido", "pendente", "aprovado", "entregue_pelo_hub"]) {
      expect(ehReemissaoDeVencido({ status: st })).toBe(false);
    }
  });

  it("item sem status não é reemissão", () => {
    expect(ehReemissaoDeVencido(null)).toBe(false);
    expect(ehReemissaoDeVencido(undefined)).toBe(false);
    expect(ehReemissaoDeVencido({})).toBe(false);
  });

  it("o status que a varredura grava é reconhecido pelo dicionário canônico", () => {
    expect(normalizarStatusDocumento(STATUS_EXIGENCIA_VENCIDA)).toBe("vencido");
    expect(ehReemissaoDeVencido({ status: STATUS_EXIGENCIA_VENCIDA })).toBe(true);
  });
});

describe("exigenciaCobravelAgora — o portão único", () => {
  it("segura a reemissão enquanto o protocolo está longe", () => {
    for (const st of ["aguardando_documentos", "em_analise_interna", "aguardando_assinatura"]) {
      expect(exigenciaCobravelAgora(CERTIDAO_VENCIDA, st)).toBe(false);
    }
  });

  it("libera a reemissão quando a equipe fecha a documentação", () => {
    for (const st of ["pronto_para_protocolar", "protocolado", "em_analise_orgao"]) {
      expect(exigenciaCobravelAgora(CERTIDAO_VENCIDA, st)).toBe(true);
    }
  });

  it("REPROVADO não espera nada — é erro de agora", () => {
    expect(exigenciaCobravelAgora(CERTIDAO_REPROVADA, "aguardando_documentos")).toBe(true);
  });

  it("documento que nunca foi entregue continua sendo cobrado normalmente", () => {
    expect(exigenciaCobravelAgora(CERTIDAO_PENDENTE, "aguardando_documentos")).toBe(true);
    expect(exigenciaCobravelAgora(CERTIDAO_OK, "aguardando_documentos")).toBe(true);
  });

  it("a trava da GRU continua valendo, sem alteração", () => {
    expect(exigenciaCobravelAgora(GRU, "aguardando_documentos")).toBe(false);
    expect(exigenciaCobravelAgora(GRU, "pronto_para_protocolar")).toBe(true);
  });
});

describe("separarPorResponsavel", () => {
  it("vencido sai do colo do cliente enquanto o protocolo não abre", () => {
    const { doCliente, comAEquipe } = separarPorResponsavel(
      [CERTIDAO_VENCIDA, CERTIDAO_PENDENTE, GRU],
      "aguardando_documentos",
    );
    expect(doCliente).toEqual([CERTIDAO_PENDENTE]);
    expect(comAEquipe).toEqual([CERTIDAO_VENCIDA, GRU]);
  });

  it("aberto o protocolo, tudo volta para o cliente de uma vez só", () => {
    const { doCliente, comAEquipe } = separarPorResponsavel(
      [CERTIDAO_VENCIDA, GRU],
      "pronto_para_protocolar",
    );
    expect(doCliente).toHaveLength(2);
    expect(comAEquipe).toHaveLength(0);
  });
});

describe("avisoReemissaoAdiada", () => {
  it("explica o porquê e não manda o cliente resolver agora", () => {
    const texto = avisoReemissaoAdiada("Cartão CNPJ");
    expect(texto).toContain("Cartão CNPJ");
    expect(texto).toContain("Não emita outro agora");
    expect(texto).toContain("requerimento");
  });

  it("tem texto de fallback quando o documento não tem nome", () => {
    expect(avisoReemissaoAdiada(null)).toContain("Este documento");
  });
});

/* ── As duas cópias precisam concordar ─────────────────────────────────────
 * Deno (edge functions) e Vite (front) não compartilham módulo. O espelho é
 * mantido à mão, então é o teste que segura — no mesmo espírito do
 * code128.test.ts, que confere a tabela própria contra o encoder de
 * referência.
 * ====================================================================== */
describe("espelho Deno × front", () => {
  const deno = readFileSync(
    resolve(__dirname, "../../../../supabase/functions/_shared/reemissaoVencido.ts"),
    "utf8",
  );

  it("o espelho reconhece exatamente os mesmos aliases de vencido", () => {
    const lista = deno.match(/const ALIAS_VENCIDO = new Set\(\[([^\]]+)\]\)/);
    expect(lista).not.toBeNull();
    const aliasesDeno = [...lista![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(aliasesDeno).toEqual(["expirada", "expirado", "vencida", "vencido"]);
    for (const a of aliasesDeno) {
      expect(ehReemissaoDeVencido({ status: a })).toBe(true);
    }
  });

  it("o espelho grava o mesmo status que o front espera", () => {
    expect(deno).toContain(`STATUS_EXIGENCIA_VENCIDA = "${STATUS_EXIGENCIA_VENCIDA}"`);
  });

  it("exigência vencida não conta para a conclusão do processo", () => {
    // Sem isto o processo nunca chega a `pronto_para_protocolar` e a reemissão
    // nunca é pedida — uma esperando a outra, para sempre.
    const visibility = readFileSync(
      resolve(__dirname, "../../../../supabase/functions/_shared/checklistVisibility.ts"),
      "utf8",
    );
    expect(visibility).toMatch(/if \(ehReemissaoDeVencido\(d\)\) return false;/);
  });
});
