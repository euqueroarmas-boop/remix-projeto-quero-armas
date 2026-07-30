-- ============================================================================
-- COLAR NO SQL EDITOR DO SUPABASE (Cloud -> SQL editor)
-- Cria os 4 tipos que faltavam: requerimento da PF, habilitacao de cacador do
-- IBAMA, declaracao de nao possuir 2o endereco e identificacao de terceiro.
-- Os slugs sao identicos aos das exigencias, entao casam por identidade --
-- nenhum apelido e necessario.
-- Seguro para rodar mais de uma vez.
-- ============================================================================
BEGIN;

ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check CHECK (tipo_documento = ANY (ARRAY[
    'rg_com_cpf','cin','cnh','cpf',
    'certidao_alteracao_nome','comprovante_residencia','declaracao_responsavel_imovel','documento_identificacao_terceiro',
    'ctps','renda_holerite_mes_atual','renda_holerite_funcionario_publico','renda_carteira_funcional',
    'renda_cartao_cnpj','renda_qsa','renda_contrato_social','renda_ccmei',
    'renda_cnpj_autonomo','renda_nf_recente','renda_comprovante_beneficio','renda_extrato_inss',
    'antecedentes_criminais','antecedentes_federal','antecedentes_estadual','antecedentes_federal_trf3_regional',
    'antecedentes_federal_sjsp_jef','antecedentes_estadual_distribuicao','antecedentes_estadual_execucoes','antecedentes_militar',
    'antecedentes_eleitoral','declaracao_sem_inquerito_processo_criminal','declaracao_guarda_responsavel','declaracao_correlata',
    'declaracao_guarda_acervo_1endereco','declaracao_guarda_acervo_2enderecos','declaracao_endereco_acervo','dsa_declaracao_seguranca_acervo',
    'declaracao_nao_possuir_segundo_endereco','declaracao_homonimia','laudo_psicologico','laudo_capacidade_tecnica',
    'comprovante_efetiva_necessidade','documento_complementar_caso','cr','craf',
    'sinarm','gt','gte','autorizacao_compra',
    'nota_fiscal_arma','comprovante_habitualidade','declaracao_compromisso_habitualidade','comprovante_clube_tiro',
    'habilitacao_cacador_ibama','comprovante_competicao','comprovante_pagamento','requerimento_de_posse_de_arma_de_fogo',
    'protocolo_processo','oficio','despacho','exigencia',
    'indeferimento','procuracao','procuracao_assinada','contrato_assinado',
    'recurso_administrativo_doc','mandado_seguranca_doc','outro'
  ]::text[]));

SELECT public.qa_processo_rever_exigencias(NULL) AS exigencias_fechadas;

COMMIT;
