import { describe, expect, it } from "vitest";
import {
  ehExigenciaEtapaFinal,
  exigenciaCobravelAgora,
  protocoloLiberado,
} from "@/lib/quero-armas/etapaFinalProtocolo";

// ============================================================================
// Caso REAL (18/08/2026, 23:21). Checklist do Anthony com tudo entregue e só o
// bloco final em aberto:
//   500 requerimento_de_posse_de_arma_de_fogo  entregue_pelo_hub
//   501 gru                                    pendente
//   502 gru_comprovante                        pendente
//   503 credencial_gov_br                      pendente
//   504 juntada_assinada                       pendente
// O gov.br e a juntada já eram segurados; a GRU não era. Resultado: o cliente
// abriu o portal e foi convidado a pagar R$ 88 antes de a equipe montar a
// defesa dele.
// ============================================================================
const CHECKLIST_FINAL = [
  { tipo_documento: "requerimento_de_posse_de_arma_de_fogo", regra_validacao: null },
  { tipo_documento: "gru", regra_validacao: null },
  { tipo_documento: "gru_comprovante", regra_validacao: null },
  { tipo_documento: "credencial_gov_br", regra_validacao: { etapa_final: true } },
  { tipo_documento: "juntada_assinada", regra_validacao: { etapa_final: true } },
];

describe("ehExigenciaEtapaFinal", () => {
  it("segura a GRU mesmo sem a marca na linha do processo", () => {
    expect(ehExigenciaEtapaFinal({ tipo_documento: "gru", regra_validacao: null })).toBe(true);
    expect(ehExigenciaEtapaFinal({ tipo_documento: "gru_comprovante", regra_validacao: null })).toBe(true);
  });

  it("segura gov.br e juntada, como já fazia", () => {
    expect(ehExigenciaEtapaFinal({ tipo_documento: "credencial_gov_br" })).toBe(true);
    expect(ehExigenciaEtapaFinal({ tipo_documento: "juntada_assinada" })).toBe(true);
  });

  it("não segura o requerimento — ele é pré-requisito, não ato de protocolo", () => {
    expect(ehExigenciaEtapaFinal({ tipo_documento: "requerimento_de_posse_de_arma_de_fogo" })).toBe(false);
  });

  it("não segura documento comum do checklist", () => {
    for (const t of ["comprovante_residencia", "laudo_psicologico", "antecedentes_criminais", "cin"]) {
      expect(ehExigenciaEtapaFinal({ tipo_documento: t })).toBe(false);
    }
  });

  it("respeita a marca gravada na linha, qualquer que seja o tipo", () => {
    expect(ehExigenciaEtapaFinal({ tipo_documento: "outro", regra_validacao: { etapa_final: true } })).toBe(true);
  });
});

describe("protocoloLiberado", () => {
  it.each(["pronto_para_protocolar", "protocolado", "em_analise_orgao", "PRONTO_PARA_PROTOCOLAR"])(
    "libera em %s",
    (st) => expect(protocoloLiberado(st)).toBe(true),
  );

  it.each(["em_andamento", "aguardando_documentos", "", null, undefined])(
    "não libera em %s",
    (st) => expect(protocoloLiberado(st)).toBe(false),
  );
});

describe("exigenciaCobravelAgora — o checklist do Anthony", () => {
  it("antes da liberação, o cliente não tem NADA a fazer", () => {
    const cobraveis = CHECKLIST_FINAL.filter((d) => exigenciaCobravelAgora(d, "em_andamento"));
    // O requerimento já foi entregue; os quatro do bloco final esperam a equipe.
    expect(cobraveis.map((d) => d.tipo_documento)).toEqual([
      "requerimento_de_posse_de_arma_de_fogo",
    ]);
  });

  it("depois de pronto para protocolar, o bloco final abre inteiro", () => {
    const cobraveis = CHECKLIST_FINAL.filter((d) =>
      exigenciaCobravelAgora(d, "pronto_para_protocolar"),
    );
    expect(cobraveis).toHaveLength(5);
  });
});
