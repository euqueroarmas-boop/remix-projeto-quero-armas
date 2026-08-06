import { describe, expect, it } from "vitest";
import { simularChecklist, type LinhaCatalogo } from "../simuladorChecklist";

const linha = (
  id: string,
  tipo_documento: string,
  nome_documento: string,
  ordem: number,
  regra_validacao: Record<string, unknown>,
  condicao_profissional: string | null = null,
): LinhaCatalogo => ({
  id,
  servico_id: 60,
  tipo_documento,
  nome_documento,
  etapa: tipo_documento.startsWith("requerimento") ? "base" : "tecnico",
  ordem,
  ativo: true,
  obrigatorio: true,
  condicao_profissional,
  condicao_modalidade: null,
  regra_validacao,
});

const linhas: LinhaCatalogo[] = [
  linha("pergunta", "exames_instituicao_definir", "Exames da instituição", 490, {
    tipo: "pergunta",
    chave: "exames_instituicao",
    opcoes: [
      { label: "SIM", valor: "sim" },
      { label: "NÃO", valor: "nao" },
    ],
    grupo_checklist: "laudos",
    ordem_grupo_checklist: 60,
  }, "seguranca_publica"),
  linha("psico-inst", "atestado_aptidao_psicologica_instituicao", "Psicológico da instituição", 491, {
    exige_quando: { exames_instituicao: "sim" },
    grupo_checklist: "laudos",
    ordem_grupo_checklist: 60,
  }, "seguranca_publica"),
  linha("tiro-inst", "atestado_capacidade_tecnica_instituicao", "Tiro da instituição", 492, {
    exige_quando: { exames_instituicao: "sim" },
    grupo_checklist: "laudos",
    ordem_grupo_checklist: 60,
  }, "seguranca_publica"),
  linha("psico-pf", "laudo_psicologico", "Laudo psicológico", 493, {
    exige_quando: { exames_instituicao: "nao" },
    grupo_checklist: "laudos",
    ordem_grupo_checklist: 60,
  }),
  linha("tiro-pf", "laudo_capacidade_tecnica", "Laudo de tiro", 494, {
    exige_quando: { exames_instituicao: "nao" },
    grupo_checklist: "laudos",
    ordem_grupo_checklist: 60,
  }),
  linha("req", "requerimento_posse", "Requerimento", 500, {
    grupo_checklist: "requerimento",
    ordem_grupo_checklist: 70,
  }),
];

describe("simulador — exames da instituição", () => {
  it.each([
    ["sim", { atestado_aptidao_psicologica_instituicao: true, atestado_capacidade_tecnica_instituicao: true }],
    ["nao", { laudo_psicologico: true, laudo_capacidade_tecnica: true }],
  ])("avança ao requerimento pelo caminho %s", (resposta, entregues) => {
    const resultado = simularChecklist({
      linhas,
      condicao: "seguranca_publica",
      modalidade: "defesa_pessoal",
      respostas: { exames_instituicao: resposta },
      entregues,
    });

    expect(resultado.proximo?.tipo_documento).toBe("requerimento_posse");
    expect(resultado.alertas.some((a) => a.texto.includes("não aparece nesta combinação"))).toBe(false);
  });
});