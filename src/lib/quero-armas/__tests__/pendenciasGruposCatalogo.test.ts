import { describe, expect, it } from "vitest";
import { grupoDaPendencia } from "../pendenciasGrupos";

// Tipos ativos do serviço "AUTORIZAÇÃO DE COMPRA / POSSE DE ARMA DE FOGO" (60).
// Nenhum deles pode cair em "outros" (rótulo "Fechamento").
const TIPOS_SERVICO_AUTORIZACAO_COMPRA = [
  "foto_3x4",
  "cin",
  "pergunta_comprovante_em_nome",
  "comprovante_residencia",
  "documento_identificacao_terceiro",
  "pergunta_titular_estado_civil",
  "pergunta_titular_profissao",
  "pergunta_ainda_reside_imovel",
  "declaracao_responsavel_imovel",
  "renda_definir_condicao",
  "renda_carteira_funcional",
  "renda_contra_cheque_mes_atual",
  "ctps",
  "renda_holerite_mes_atual",
  "renda_contrato_social",
  "renda_ccmei",
  "renda_cartao_cnpj",
  "renda_qsa",
  "renda_nf_empresa",
  "renda_extrato_inss",
  "renda_comprovante_beneficio",
  "antecedentes_eleitoral",
  "antecedentes_militar",
  "antecedentes_federal_trf3_regional",
  "antecedentes_federal_sjsp_jef",
  "antecedentes_estadual_distribuicao",
  "antecedentes_estadual_execucoes",
  "antecedentes_criminais",
  "antecedentes_militar_estadual",
  "comprovante_efetiva_necessidade",
  "exames_instituicao_definir",
  "atestado_aptidao_psicologica_instituicao",
  "atestado_capacidade_tecnica_instituicao",
  "laudo_psicologico",
  "laudo_capacidade_tecnica",
  "requerimento_de_posse_de_arma_de_fogo",
];

describe("grupoDaPendencia — catálogo de autorização de compra/posse", () => {
  it("nenhum tipo do serviço cai em Fechamento", () => {
    const orfaos = TIPOS_SERVICO_AUTORIZACAO_COMPRA.filter(
      (t) => grupoDaPendencia(t).id === "outros",
    );
    expect(orfaos).toEqual([]);
  });

  it("todas as certidões de antecedentes ficam em Idoneidade", () => {
    for (const t of TIPOS_SERVICO_AUTORIZACAO_COMPRA.filter((x) => x.startsWith("antecedentes"))) {
      expect(grupoDaPendencia(t).id).toBe("antecedentes");
      expect(grupoDaPendencia(t).label).toBe("Idoneidade");
    }
  });

  it("declaração de não responder inquérito é Idoneidade", () => {
    expect(grupoDaPendencia("declaracao_sem_inquerito_processo_criminal").id).toBe("antecedentes");
  });

  it("procuração e comprovante de pagamento ficam em Contratos", () => {
    expect(grupoDaPendencia("procuracao_assinada").id).toBe("assinaturas");
    expect(grupoDaPendencia("comprovante_pagamento").id).toBe("assinaturas");
  });

  it("itens de acervo CAC têm grupo próprio (não Fechamento)", () => {
    for (const t of [
      "dsa_declaracao_seguranca_acervo",
      "declaracao_endereco_acervo",
      "declaracao_guarda_responsavel",
      "pergunta_segundo_endereco_acervo",
      "declaracao_nao_possuir_segundo_endereco",
      "comprovante_residencia_segundo_endereco",
    ]) {
      expect(grupoDaPendencia(t).id).not.toBe("outros");
    }
  });
});