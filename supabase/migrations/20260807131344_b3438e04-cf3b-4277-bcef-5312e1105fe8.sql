UPDATE public.qa_validade_documentos
SET validade_dias = 30,
    unidade = 'dias',
    perpetuo = false,
    observacao = 'Prazo padrao (30 dias) aplicado apenas quando a propria certidao nao declara validade. Validade declarada no documento sempre prevalece.',
    updated_at = now()
WHERE ativo = true
  AND (tipo_documento LIKE 'antecedentes%' OR tipo_documento LIKE 'certidao_antecedente%' OR tipo_documento LIKE 'certidao_justica%' OR tipo_documento LIKE 'certidao_negativa%')
  AND perpetuo = false;

UPDATE public.qa_validade_documentos
SET ativo = false, updated_at = now()
WHERE tipo_documento ILIKE '%municip%';