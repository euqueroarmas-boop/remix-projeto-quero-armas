-- 20260730000000_apelidos_slots_orfaos.sql
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_antecedentes_criminais_eleitoral', 'antecedentes_eleitoral'),
  ('certidao_antecedentes_criminais_estadual',  'antecedentes_estadual'),
  ('certidao_antecedentes_criminais_federal',   'antecedentes_federal'),
  ('certidao_antecedentes_criminais_militar',   'antecedentes_militar'),
  ('comprovante_residencia_ano_1', 'comprovante_residencia'),
  ('comprovante_residencia_ano_2', 'comprovante_residencia'),
  ('comprovante_residencia_ano_3', 'comprovante_residencia'),
  ('comprovante_residencia_ano_4', 'comprovante_residencia'),
  ('comprovante_em_nome_titular',  'comprovante_residencia'),
  ('declaracao_responsavel_imovel_atual',   'declaracao_responsavel_imovel'),
  ('declaracao_responsavel_imovel_passado', 'declaracao_responsavel_imovel')
ON CONFLICT DO NOTHING;

-- 20260730010000_fecha_catalogo_e_apelidos.sql
ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check CHECK (tipo_documento = ANY (ARRAY[
    'cr','craf','sinarm','gt','gte','autorizacao_compra','nota_fiscal_arma',
    'rg_com_cpf','cin','cnh','cpf',
    'comprovante_residencia','declaracao_responsavel_imovel',
    'ctps','renda_holerite_mes_atual','renda_holerite_funcionario_publico',
    'renda_cartao_cnpj','renda_cnpj_autonomo','renda_contrato_social',
    'renda_nf_recente','renda_comprovante_beneficio','renda_extrato_inss',
    'renda_qsa','renda_ccmei','renda_carteira_funcional',
    'antecedentes_criminais','antecedentes_federal',
    'antecedentes_federal_trf3_regional','antecedentes_federal_sjsp_jef',
    'antecedentes_estadual','antecedentes_estadual_distribuicao',
    'antecedentes_estadual_execucoes','antecedentes_militar','antecedentes_eleitoral',
    'declaracao_sem_inquerito_processo_criminal','declaracao_guarda_responsavel',
    'declaracao_correlata','declaracao_guarda_acervo_1endereco',
    'declaracao_guarda_acervo_2enderecos','declaracao_homonimia',
    'declaracao_endereco_acervo','dsa_declaracao_seguranca_acervo',
    'laudo_psicologico','laudo_capacidade_tecnica',
    'comprovante_efetiva_necessidade','documento_complementar_caso',
    'comprovante_habitualidade','declaracao_compromisso_habitualidade',
    'comprovante_clube_tiro','comprovante_competicao',
    'comprovante_pagamento',
    'protocolo_processo','oficio','despacho','exigencia','indeferimento',
    'procuracao','procuracao_assinada','contrato_assinado',
    'recurso_administrativo_doc','mandado_seguranca_doc',
    'certidao_alteracao_nome',
    'outro'
  ]::text[]));

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_estadual_justica_militar',                'antecedentes_militar'),
  ('certidao_estadual_policia_civil',                  'antecedentes_criminais'),
  ('certidao_estadual_segundo_grau_acoes_criminais',   'antecedentes_estadual_distribuicao'),
  ('certidao_estadual_segundo_grau_execucoes_criminais','antecedentes_estadual_execucoes')
ON CONFLICT DO NOTHING;

-- 20260730020000_backfill_validade_documentos.sql
UPDATE public.qa_documentos_cliente
SET data_emissao = COALESCE(
      NULLIF(ia_dados_extraidos->'camposExtraidos'->>'data_emissao', ''),
      NULLIF(ia_dados_extraidos->'campos_extraidos'->>'data_emissao', '')
    )::date
WHERE data_emissao IS NULL
  AND status <> 'excluido'
  AND COALESCE(
        NULLIF(ia_dados_extraidos->'camposExtraidos'->>'data_emissao', ''),
        NULLIF(ia_dados_extraidos->'campos_extraidos'->>'data_emissao', '')
      ) ~ '^\d{4}-\d{2}-\d{2}$';

UPDATE public.qa_documentos_cliente q
SET data_emissao = c.data_emissao
FROM (
  SELECT DISTINCT ON (qa_cliente_id) qa_cliente_id, data_emissao
  FROM public.qa_documentos_cliente
  WHERE tipo_documento IN ('renda_cartao_cnpj','renda_cnpj_autonomo','renda_ccmei')
    AND data_emissao IS NOT NULL AND status <> 'excluido'
  ORDER BY qa_cliente_id, data_emissao DESC
) c
WHERE q.tipo_documento = 'renda_qsa'
  AND q.data_emissao IS NULL
  AND q.status <> 'excluido'
  AND q.qa_cliente_id = c.qa_cliente_id;

UPDATE public.qa_documentos_cliente
SET data_validade = CASE
  WHEN tipo_documento IN ('renda_cartao_cnpj','renda_cnpj_autonomo','renda_ccmei','renda_qsa')
    THEN data_emissao + INTERVAL '30 days'
  WHEN tipo_documento IN ('antecedentes_federal_trf3_regional','antecedentes_militar')
    THEN data_emissao + INTERVAL '90 days'
  WHEN tipo_documento IN ('rg_com_cpf','cin','cnh')
    THEN data_emissao + INTERVAL '10 years'
  WHEN tipo_documento IN ('procuracao','procuracao_assinada','comprovante_clube_tiro')
    THEN data_emissao + INTERVAL '12 months'
  WHEN tipo_documento = 'comprovante_residencia'
    OR tipo_documento LIKE 'antecedentes_%'
    THEN data_emissao + INTERVAL '1 month'
  ELSE NULL
END
WHERE data_validade IS NULL
  AND data_emissao IS NOT NULL
  AND status <> 'excluido';

-- Reavalia todas as exigências pendentes com catálogo e apelidos completos.
SELECT public.qa_processo_rever_exigencias(NULL);