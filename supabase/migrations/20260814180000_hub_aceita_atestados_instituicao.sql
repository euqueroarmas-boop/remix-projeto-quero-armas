-- =============================================================================
-- HUB: os dois atestados da instituicao entram no CHECK
--
-- 20260812220000 religou a trilha dos exames da instituicao: os atestados
-- `atestado_aptidao_psicologica_instituicao` e
-- `atestado_capacidade_tecnica_instituicao` voltaram a ser exigencia viva dos
-- 11 servicos. O CHECK de `qa_documentos_cliente`, porem, nunca os recebeu --
-- a ultima redefinicao literal e de 20260809232038, tres dias antes.
--
-- Resultado: a exigencia e criada no processo, o cliente anexa o atestado no
-- Hub e o INSERT morre com
--   new row violates check constraint "qa_doc_cliente_tipo_check"
-- exatamente como aconteceu com a nota fiscal em 14/08/2026.
--
-- Este bloco e ADITIVO: nenhum tipo sai da lista. Os 102 tipos de
-- 20260809232038 continuam identicos e os dois atestados sao acrescentados.
--
-- Idempotente (DROP IF EXISTS + ADD com lista literal).
-- =============================================================================

BEGIN;

ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check
  CHECK (tipo_documento = ANY (ARRAY[
    'antecedentes_criminais'::text,
    'antecedentes_eleitoral'::text,
    'antecedentes_estadual'::text,
    'antecedentes_estadual_ac'::text,
    'antecedentes_estadual_al'::text,
    'antecedentes_estadual_am'::text,
    'antecedentes_estadual_ap'::text,
    'antecedentes_estadual_ba'::text,
    'antecedentes_estadual_ce'::text,
    'antecedentes_estadual_df'::text,
    'antecedentes_estadual_distribuicao'::text,
    'antecedentes_estadual_es'::text,
    'antecedentes_estadual_execucoes'::text,
    'antecedentes_estadual_go'::text,
    'antecedentes_estadual_ma'::text,
    'antecedentes_estadual_mg'::text,
    'antecedentes_estadual_ms'::text,
    'antecedentes_estadual_mt'::text,
    'antecedentes_estadual_pa'::text,
    'antecedentes_estadual_pb'::text,
    'antecedentes_estadual_pe'::text,
    'antecedentes_estadual_pi'::text,
    'antecedentes_estadual_pr'::text,
    'antecedentes_estadual_rj'::text,
    'antecedentes_estadual_rn'::text,
    'antecedentes_estadual_ro'::text,
    'antecedentes_estadual_rr'::text,
    'antecedentes_estadual_rs'::text,
    'antecedentes_estadual_sc'::text,
    'antecedentes_estadual_se'::text,
    'antecedentes_estadual_sp'::text,
    'antecedentes_estadual_to'::text,
    'antecedentes_federal'::text,
    'antecedentes_federal_sjsp_jef'::text,
    'antecedentes_federal_trf1_regional'::text,
    'antecedentes_federal_trf2_regional'::text,
    'antecedentes_federal_trf3_regional'::text,
    'antecedentes_federal_trf4_regional'::text,
    'antecedentes_federal_trf5_regional'::text,
    'antecedentes_federal_trf6_regional'::text,
    'antecedentes_militar'::text,
    'antecedentes_militar_estadual'::text,
    'atestado_aptidao_psicologica_instituicao'::text,
    'atestado_capacidade_tecnica_instituicao'::text,
    'autorizacao_compra'::text,
    'boletim_ocorrencia'::text,
    'certidao_alteracao_nome'::text,
    'cin'::text,
    'cnh'::text,
    'comprovante_competicao'::text,
    'comprovante_efetiva_necessidade'::text,
    'comprovante_filiacao_entidade_tiro'::text,
    'comprovante_pagamento'::text,
    'comprovante_residencia'::text,
    'contrato_assinado'::text,
    'cr'::text,
    'craf'::text,
    'ctps'::text,
    'declaracao_correlata'::text,
    'declaracao_endereco_acervo'::text,
    'declaracao_guarda_acervo_1endereco'::text,
    'declaracao_guarda_acervo_2enderecos'::text,
    'declaracao_guarda_responsavel'::text,
    'declaracao_homonimia'::text,
    'declaracao_nao_possuir_segundo_endereco'::text,
    'declaracao_responsavel_imovel'::text,
    'declaracao_sem_inquerito_processo_criminal'::text,
    'despacho'::text,
    'documento_complementar_caso'::text,
    'documento_identificacao_terceiro'::text,
    'dsa_declaracao_seguranca_acervo'::text,
    'exigencia'::text,
    'foto_3x4'::text,
    'gru'::text,
    'gt'::text,
    'gte'::text,
    'habilitacao_cacador_ibama'::text,
    'indeferimento'::text,
    'laudo_capacidade_tecnica'::text,
    'laudo_psicologico'::text,
    'mandado_seguranca_doc'::text,
    'nota_fiscal_arma'::text,
    'oficio'::text,
    'outro'::text,
    'procuracao'::text,
    'procuracao_assinada'::text,
    'protocolo_processo'::text,
    'recurso_administrativo_doc'::text,
    'renda_cartao_cnpj'::text,
    'renda_carteira_funcional'::text,
    'renda_ccmei'::text,
    'renda_cnpj_autonomo'::text,
    'renda_comprovante_beneficio'::text,
    'renda_contra_cheque_mes_atual'::text,
    'renda_contrato_social'::text,
    'renda_extrato_inss'::text,
    'renda_ficha_cadastral_jucesp'::text,
    'renda_holerite_funcionario_publico'::text,
    'renda_holerite_mes_atual'::text,
    'renda_nf_empresa'::text,
    'renda_qsa'::text,
    'requerimento_de_posse_de_arma_de_fogo'::text,
    'rg_com_cpf'::text,
    'sinarm'::text
  ]));

COMMENT ON CONSTRAINT qa_doc_cliente_tipo_check ON public.qa_documentos_cliente IS
  'Vocabulario fechado do Hub. Espelhado em src/lib/quero-armas/documentosHubCatalogo.ts; o teste catalogoHubVsConstraint.test.ts falha se os dois divergirem.';

COMMIT;
