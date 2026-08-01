UPDATE public.qa_documentos_cliente
SET data_emissao = COALESCE(data_emissao, (created_at AT TIME ZONE 'America/Sao_Paulo')::date),
    data_validade = (COALESCE(data_emissao, (created_at AT TIME ZONE 'America/Sao_Paulo')::date) + INTERVAL '12 months')::date,
    updated_at = now()
WHERE tipo_documento IN ('procuracao', 'procuracao_assinada')
  AND COALESCE(status, '') <> 'excluido'
  AND data_validade IS DISTINCT FROM (COALESCE(data_emissao, (created_at AT TIME ZONE 'America/Sao_Paulo')::date) + INTERVAL '12 months')::date;