
-- Add 'ativo' column for logical deletion
ALTER TABLE public.qa_documentos_conhecimento
ADD COLUMN ativo boolean NOT NULL DEFAULT true;

-- Update the vector search function to exclude inactive documents
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
    AND 1 - (e.vetor_embedding <=> query_embedding) > match_threshold
  ORDER BY e.vetor_embedding <=> query_embedding
  LIMIT match_count;
$$;
