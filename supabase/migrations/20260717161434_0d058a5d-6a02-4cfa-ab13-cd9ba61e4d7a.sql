
UPDATE public.qa_processo_documentos p
SET status='aprovado',
    arquivo_url=h.arquivo_storage_path,
    arquivo_storage_key=h.arquivo_storage_path,
    data_envio=COALESCE(h.created_at, now()),
    data_validacao=now(),
    dados_extraidos_json=h.ia_dados_extraidos,
    motivo_rejeicao=NULL,
    updated_at=now()
FROM (
  SELECT arquivo_storage_path, ia_dados_extraidos, created_at
  FROM public.qa_documentos_cliente
  WHERE qa_cliente_id=189
    AND tipo_documento='comprovante_residencia'
    AND status='aprovado'
    AND EXTRACT(YEAR FROM data_emissao)=2023
  ORDER BY created_at DESC LIMIT 1
) h
WHERE p.cliente_id=189
  AND p.tipo_documento='comprovante_endereco_ano_2023'
  AND p.status='rejeitado';
