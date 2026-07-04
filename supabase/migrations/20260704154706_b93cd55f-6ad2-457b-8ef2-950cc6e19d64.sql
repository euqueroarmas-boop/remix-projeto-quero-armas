UPDATE qa_documentos_conhecimento
SET 
  status_processamento = 'ignorado_politica',
  resumo_extraido = 'Documento de evidência de cliente — excluído da pipeline de treinamento por política interna. Não reprocessar.',
  updated_at = now()
WHERE status_processamento = 'pendente'
  AND storage_path LIKE 'auxiliares/%';