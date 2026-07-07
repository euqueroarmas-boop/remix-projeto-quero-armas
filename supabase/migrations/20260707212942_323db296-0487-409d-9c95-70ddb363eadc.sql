CREATE OR REPLACE FUNCTION public.qa_consulta_competencia(_tokens text[])
RETURNS TABLE (
  materia_slug      text,
  materia_descricao text,
  orgao_competente  text,
  sistema_registro  text,
  artigo            text,
  observacao        text,
  match_count       bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.materia_slug,
    c.materia_descricao,
    c.orgao_competente,
    c.sistema_registro,
    c.artigo,
    c.observacao,
    (SELECT COUNT(*) FROM unnest(c.palavras_chave) kw WHERE kw = ANY(_tokens)) AS match_count
  FROM public.qa_competencia_materia c
  WHERE c.ativo = true
    AND c.palavras_chave && _tokens
  ORDER BY match_count DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.qa_consulta_competencia(text[]) TO service_role;