
-- Add governance columns
ALTER TABLE public.qa_documentos_conhecimento
ADD COLUMN IF NOT EXISTS ativo_na_ia boolean NOT NULL DEFAULT true;

ALTER TABLE public.qa_documentos_conhecimento
ADD COLUMN IF NOT EXISTS referencia_preferencial boolean NOT NULL DEFAULT false;

-- Update the vector search function to enforce full governance
CREATE OR REPLACE FUNCTION public.qa_busca_similar(query_embedding vector, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10)
 RETURNS TABLE(chunk_id uuid, documento_id uuid, texto_chunk text, resumo_chunk text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    e.chunk_id,
    c.documento_id,
    c.texto_chunk,
    c.resumo_chunk,
    1 - (e.vetor_embedding <=> query_embedding) as similarity
  FROM qa_embeddings e
  JOIN qa_chunks_conhecimento c ON c.id = e.chunk_id
  JOIN qa_documentos_conhecimento d ON d.id = c.documento_id
  WHERE d.ativo = true
    AND d.ativo_na_ia = true
    AND d.status_validacao = 'validado'
    AND d.status_processamento = 'concluido'
    AND 1 - (e.vetor_embedding <=> query_embedding) > match_threshold
  ORDER BY
    d.referencia_preferencial DESC,
    e.vetor_embedding <=> query_embedding
  LIMIT match_count;
$$;
