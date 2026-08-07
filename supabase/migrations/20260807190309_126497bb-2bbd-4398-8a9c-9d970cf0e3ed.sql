INSERT INTO public.qa_validade_documentos (tipo_documento, validade_dias, perpetuo, alerta_dias, unidade, ativo, observacao)
VALUES
 ('renda_carteira_funcional', 0, true, 0, 'dias', true, 'Identidade funcional: validade INDETERMINADA impressa no documento.'),
 ('identidade_funcional', 0, true, 0, 'dias', true, 'Identidade funcional: validade INDETERMINADA impressa no documento.'),
 ('renda_identidade_funcional', 0, true, 0, 'dias', true, 'Identidade funcional: validade INDETERMINADA impressa no documento.'),
 ('carteira_funcional', 0, true, 0, 'dias', true, 'Identidade funcional: validade INDETERMINADA impressa no documento.'),
 ('fe_publica_funcional', 0, true, 0, 'dias', true, 'Fé Pública (Decreto 14.298/79): validade indeterminada.')
ON CONFLICT (tipo_documento) DO UPDATE
SET validade_dias = 0, perpetuo = true, alerta_dias = 0, unidade = 'dias', ativo = true,
    observacao = EXCLUDED.observacao, updated_at = now();

UPDATE public.qa_documentos_cliente
SET data_validade = NULL, updated_at = now()
WHERE tipo_documento IN ('renda_carteira_funcional','identidade_funcional','renda_identidade_funcional','carteira_funcional','fe_publica_funcional')
  AND data_validade IS NOT NULL;