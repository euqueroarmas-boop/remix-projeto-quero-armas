-- Delete embeddings for corrupted chunks
DELETE FROM public.qa_embeddings
WHERE chunk_id IN (
  SELECT id FROM public.qa_chunks_conhecimento
  WHERE documento_id IN (
    '0cce4e65-3e2c-434f-a5ac-6bc94a90bbb3',
    '61b33361-ac6c-41ac-81fb-25402df736e2',
    '5aaae04f-9415-4b60-8e5b-f6ffab7163c7'
  )
);

-- Delete corrupted chunks
DELETE FROM public.qa_chunks_conhecimento
WHERE documento_id IN (
  '0cce4e65-3e2c-434f-a5ac-6bc94a90bbb3',
  '61b33361-ac6c-41ac-81fb-25402df736e2',
  '5aaae04f-9415-4b60-8e5b-f6ffab7163c7'
);

-- Reset documents for reprocessing
UPDATE public.qa_documentos_conhecimento
SET status_processamento = 'pendente',
    texto_extraido = NULL,
    resumo_extraido = NULL,
    updated_at = now()
WHERE id IN (
  '0cce4e65-3e2c-434f-a5ac-6bc94a90bbb3',
  '61b33361-ac6c-41ac-81fb-25402df736e2',
  '5aaae04f-9415-4b60-8e5b-f6ffab7163c7'
);