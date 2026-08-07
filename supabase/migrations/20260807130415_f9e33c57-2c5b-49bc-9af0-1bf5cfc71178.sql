-- 1) Desativa chaves legadas sem uso (preserva histórico)
UPDATE public.qa_validade_documentos
SET ativo = false
WHERE tipo_documento IN (
  'cartao_cnpj','ccmei','certidao_antecedente_estadual','certidao_antecedente_federal',
  'certidao_justica_eleitoral','certidao_justica_estadual','certidao_justica_federal',
  'certidao_justica_militar','certidao_negativa_civil','certidao_negativa_criminal',
  'certidao_negativa_jf','certidao_negativa_pf','comprovante_endereco',
  'comprovante_endereco_5_anos','contracheque','contrato_social','decore',
  'documento_identidade','extrato_inss','holerite','identidade_funcional',
  'nota_fiscal','quadro_societario_qsa','certidao_casamento','certidao_nascimento',
  'declaracao_compromisso_treino','procuracao'
);

-- 2) Regras no vocabulário real do Hub
INSERT INTO public.qa_validade_documentos (tipo_documento, validade_dias, unidade, perpetuo, alerta_dias, ativo)
VALUES
  -- Identidade: 10 anos
  ('rg_com_cpf', 120, 'meses', false, 30, true),
  ('cin',        120, 'meses', false, 30, true),
  ('cnh',        120, 'meses', false, 30, true),

  -- Antecedentes: 90 dias
  ('antecedentes_criminais', 90, 'dias', false, 7, true),
  ('antecedentes_federal', 90, 'dias', false, 7, true),
  ('antecedentes_estadual', 90, 'dias', false, 7, true),
  ('antecedentes_militar', 90, 'dias', false, 7, true),
  ('antecedentes_militar_estadual', 90, 'dias', false, 7, true),
  ('antecedentes_eleitoral', 90, 'dias', false, 7, true),
  ('antecedentes_federal_trf3_regional', 90, 'dias', false, 7, true),
  ('antecedentes_federal_sjsp_jef', 90, 'dias', false, 7, true),
  ('antecedentes_estadual_distribuicao', 90, 'dias', false, 7, true),
  ('antecedentes_estadual_execucoes', 90, 'dias', false, 7, true),
  ('antecedentes_federal_trf1_regional', 90, 'dias', false, 7, true),
  ('antecedentes_federal_trf2_regional', 90, 'dias', false, 7, true),
  ('antecedentes_federal_trf4_regional', 90, 'dias', false, 7, true),
  ('antecedentes_federal_trf5_regional', 90, 'dias', false, 7, true),
  ('antecedentes_federal_trf6_regional', 90, 'dias', false, 7, true),

  -- Ocupação lícita: 30 dias
  ('renda_holerite_mes_atual', 30, 'dias', false, 7, true),
  ('renda_holerite_funcionario_publico', 30, 'dias', false, 7, true),
  ('renda_contra_cheque_mes_atual', 30, 'dias', false, 7, true),
  ('renda_cartao_cnpj', 30, 'dias', false, 7, true),
  ('renda_qsa', 30, 'dias', false, 7, true),
  ('renda_ccmei', 30, 'dias', false, 7, true),
  ('renda_cnpj_autonomo', 30, 'dias', false, 7, true),
  ('renda_ficha_cadastral_jucesp', 30, 'dias', false, 7, true),
  ('renda_extrato_inss', 30, 'dias', false, 7, true),
  ('renda_comprovante_beneficio', 30, 'dias', false, 7, true),

  -- Nota fiscal e documentos permanentes
  ('renda_nf_empresa', 0, 'dias', true, 0, true),
  ('nota_fiscal_arma', 0, 'dias', true, 0, true),
  ('renda_contrato_social', 0, 'dias', true, 0, true),
  ('renda_carteira_funcional', 0, 'dias', true, 0, true),
  ('ctps', 0, 'dias', true, 0, true),
  ('procuracao_assinada', 0, 'dias', true, 0, true),
  ('contrato_assinado', 0, 'dias', true, 0, true),
  ('boletim_ocorrencia', 0, 'dias', true, 0, true),
  ('comprovante_pagamento', 0, 'dias', true, 0, true),
  ('documento_complementar_caso', 0, 'dias', true, 0, true),
  ('declaracao_guarda_responsavel', 0, 'dias', true, 0, true),
  ('declaracao_correlata', 0, 'dias', true, 0, true),
  ('declaracao_endereco_acervo', 0, 'dias', true, 0, true),
  ('declaracao_homonimia', 0, 'dias', true, 0, true),

  -- Laudos e habilitações
  ('laudo_psicologico', 12, 'meses', false, 30, true),
  ('laudo_capacidade_tecnica', 12, 'meses', false, 30, true),
  ('sinarm', 12, 'meses', false, 120, true),
  ('gt', 12, 'meses', false, 120, true)
ON CONFLICT (tipo_documento) DO UPDATE SET
  validade_dias = EXCLUDED.validade_dias,
  unidade       = EXCLUDED.unidade,
  perpetuo      = EXCLUDED.perpetuo,
  alerta_dias   = EXCLUDED.alerta_dias,
  ativo         = true;

-- 3) Certidões estaduais das 27 UFs: 90 dias
INSERT INTO public.qa_validade_documentos (tipo_documento, validade_dias, unidade, perpetuo, alerta_dias, ativo)
SELECT 'antecedentes_estadual_' || uf, 90, 'dias', false, 7, true
FROM unnest(ARRAY['ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pe','pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to']) AS uf
ON CONFLICT (tipo_documento) DO UPDATE SET
  validade_dias = EXCLUDED.validade_dias,
  unidade       = EXCLUDED.unidade,
  perpetuo      = EXCLUDED.perpetuo,
  alerta_dias   = EXCLUDED.alerta_dias,
  ativo         = true;