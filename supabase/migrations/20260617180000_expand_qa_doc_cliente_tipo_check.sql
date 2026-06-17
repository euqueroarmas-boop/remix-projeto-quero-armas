-- Expande a constraint qa_doc_cliente_tipo_check para incluir todos os tipos
-- do Hub Documental (não apenas documentos de armas).
ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check
  CHECK (tipo_documento IN (
    -- Armas / acervo
    'cr','craf','sinarm','gt','gte','autorizacao_compra','nota_fiscal_arma',
    -- Identificação civil
    'rg_com_cpf','cin','cnh','cpf',
    -- Residência / endereço
    'comprovante_residencia','declaracao_responsavel_imovel',
    -- Renda / ocupação
    'ctps','renda_holerite_mes_atual','renda_holerite_funcionario_publico',
    'renda_cartao_cnpj','renda_cnpj_autonomo','renda_contrato_social',
    'renda_nf_recente','renda_comprovante_beneficio','renda_extrato_inss',
    -- Antecedentes / regularidade
    'antecedentes_criminais','antecedentes_federal','antecedentes_estadual',
    'antecedentes_militar','antecedentes_eleitoral',
    -- Declarações pessoais
    'declaracao_sem_inquerito_processo_criminal','declaracao_guarda_responsavel',
    'declaracao_correlata','declaracao_guarda_acervo_1endereco',
    -- Laudos e exames
    'laudo_psicologico','laudo_capacidade_tecnica',
    -- Efetiva necessidade
    'comprovante_efetiva_necessidade','documento_complementar_caso',
    -- CAC / habitualidade
    'comprovante_habitualidade','comprovante_clube_tiro','comprovante_competicao',
    -- Documentos processuais
    'protocolo_processo','oficio','despacho','exigencia','indeferimento',
    -- Documentos jurídicos
    'procuracao','recurso_administrativo_doc','mandado_seguranca_doc',
    -- Fallback
    'outro'
  ));
