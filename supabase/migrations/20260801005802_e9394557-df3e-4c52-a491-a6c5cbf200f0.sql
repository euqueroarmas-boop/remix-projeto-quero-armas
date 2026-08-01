UPDATE public.qa_documentos_cliente
SET data_emissao = (created_at AT TIME ZONE 'America/Sao_Paulo')::date,
    data_validade = CASE
      WHEN tipo_documento LIKE 'comprovante_residencia%' OR tipo_documento LIKE 'comprovante_endereco%'
        THEN ((created_at AT TIME ZONE 'America/Sao_Paulo')::date + INTERVAL '1 month')::date
      ELSE ((created_at AT TIME ZONE 'America/Sao_Paulo')::date + INTERVAL '10 years')::date
    END,
    updated_at = now()
WHERE data_emissao IS NULL
  AND data_validade IS NULL
  AND status NOT IN ('substituido','excluido')
  AND (
    tipo_documento LIKE 'comprovante_residencia%'
    OR tipo_documento LIKE 'comprovante_endereco%'
    OR tipo_documento IN ('cin','rg','rg_com_cpf','cnh')
  );