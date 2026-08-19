import { describe, expect, it } from "vitest";
import { grupoDaPendencia, grupoDaPendenciaDoItem } from "../pendenciasGrupos";
import { gruposPermitidosPorServico } from "../servicoGruposConfig";

// Exigências do serviço 44 (CONCESSÃO DE CR), conforme a IN DG/PF nº 311/2025,
// art. 18, § 2º. Espelha as migrations 20260819030000 e 20260819040000.
//
// A modalidade (colecionador / atirador / caçador) NÃO está nesta lista de
// propósito: ela vem do item que o cliente comprou no catálogo e é carimbada no
// processo pelo gatilho `qa_trg_processo_modalidade_do_catalogo`. Não é
// exigência, não é pergunta, e o cliente não escolhe.
//
// Este arquivo existe por um motivo específico: no CR, exigência classificada
// no grupo errado não é só feiúra de UI — o popup guiado filtra por grupo, e
// grupo fora do whitelist do serviço some da fila do cliente. Foi o que
// acontecia com a filiação a entidade de tiro e com a DSA antes desta correção.
const TIPOS_CONCESSAO_CR = [
  "rg_com_cpf",
  "pergunta_comprovante_em_nome",
  "declaracao_responsavel_imovel",
  "pergunta_titular_estado_civil",
  "pergunta_titular_profissao",
  "pergunta_ainda_reside_imovel",
  // os 5 anos de endereço vêm de qa_seed_endereco_5_anos
  "comprovante_endereco_ano_2026",
  "comprovante_endereco_ano_2022",
  "renda_definir_condicao",
  "renda_carteira_funcional",
  "renda_contra_cheque_mes_atual",
  "ctps",
  "renda_holerite_mes_atual",
  "renda_extrato_inss",
  "renda_contrato_social",
  "renda_ccmei",
  "renda_cartao_cnpj",
  "renda_qsa",
  "renda_nf_empresa",
  "renda_comprovante_beneficio",
  "antecedentes_eleitoral",
  "antecedentes_militar",
  "antecedentes_federal_trf3_regional",
  "antecedentes_federal_sjsp_jef",
  "antecedentes_estadual_distribuicao",
  "antecedentes_estadual_execucoes",
  "antecedentes_criminais",
  "antecedentes_militar_estadual",
  "pergunta_responde_inquerito_criminal",
  "declaracao_sem_inquerito_processo_criminal",
  "comprovante_filiacao_entidade_tiro",
  "declaracao_compromisso_habitualidade",
  "habilitacao_cacador_ibama",
  "dsa_declaracao_seguranca_acervo",
  "pergunta_segundo_endereco_acervo",
  "declaracao_endereco_acervo",
  // Achado dos 4 dossiês deferidos (19/08): DEGA é sempre entregue, e o
  // segundo endereço sempre gera declaração — positiva ou negativa.
  "declaracao_guarda_acervo_2enderecos",
  "declaracao_nao_possuir_segundo_endereco",
  "exames_instituicao_definir",
  "atestado_aptidao_psicologica_instituicao",
  "atestado_capacidade_tecnica_instituicao",
  "laudo_psicologico",
  "laudo_capacidade_tecnica",
  "requerimento_cr",
  "gru",
  "gru_comprovante",
  "credencial_gov_br",
  "juntada_assinada",
];

describe("Concessão de CR — grupos das exigências da IN 311", () => {
  it("nenhuma exigência do CR cai em Fechamento", () => {
    const orfaos = TIPOS_CONCESSAO_CR.filter((t) => grupoDaPendencia(t).id === "outros");
    expect(orfaos).toEqual([]);
  });

  it("todo grupo usado pelo CR é aceito pelo whitelist do serviço", () => {
    const permitidos = gruposPermitidosPorServico("concessao-cr");
    expect(permitidos).not.toBeNull();
    const filtrados = TIPOS_CONCESSAO_CR.filter((t) => !permitidos!.has(grupoDaPendencia(t).id));
    expect(filtrados).toEqual([]);
  });

  it("os documentos da atividade CAC ficam em Habitualidade e clube", () => {
    for (const t of [
      "comprovante_filiacao_entidade_tiro",
      "declaracao_compromisso_habitualidade",
      "habilitacao_cacador_ibama",
    ]) {
      expect(grupoDaPendencia(t).id, t).toBe("habitualidade");
    }
  });

  it("segurança e endereço do acervo ficam no grupo do acervo", () => {
    expect(grupoDaPendencia("dsa_declaracao_seguranca_acervo").id).toBe("arma");
    expect(grupoDaPendencia("declaracao_endereco_acervo").id).toBe("arma");
  });

  // Decisão já tomada no projeto: segundo endereço de guarda é identificação
  // residencial. A DEGA que ele destrava é que fica com o acervo.
  it("a pergunta do segundo endereço fica com os endereços", () => {
    expect(grupoDaPendencia("pergunta_segundo_endereco_acervo").id).toBe("endereco");
    expect(grupoDaPendencia("declaracao_nao_possuir_segundo_endereco").id).toBe("endereco");
  });

  it("requerimento, taxa e juntada ficam no grupo do requerimento", () => {
    for (const t of ["requerimento_cr", "gru", "gru_comprovante", "credencial_gov_br", "juntada_assinada"]) {
      expect(grupoDaPendencia(t).id, t).toBe("requerimento");
    }
  });

  it("o grupo gravado na linha manda sobre o palpite pelo tipo", () => {
    const item = {
      tipo_documento: "dsa_declaracao_seguranca_acervo",
      regra_validacao: { grupo_checklist: "arma", ordem_grupo_checklist: 55 },
    };
    expect(grupoDaPendenciaDoItem(item).id).toBe("arma");
  });

  it("efetiva necessidade não pertence ao CR — é requisito de defesa pessoal", () => {
    const permitidos = gruposPermitidosPorServico("concessao-cr");
    expect(permitidos!.has("efetiva_necessidade")).toBe(false);
  });

  it("exigência da PF continua visível no CR mesmo depois do filtro", () => {
    const permitidos = gruposPermitidosPorServico("concessao-cr");
    expect(permitidos!.has("exigencias_pf")).toBe(true);
  });
});
