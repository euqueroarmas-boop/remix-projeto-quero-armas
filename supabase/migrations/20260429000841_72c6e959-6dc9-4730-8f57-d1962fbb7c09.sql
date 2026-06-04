CREATE OR REPLACE FUNCTION public.qa_gov_reconcile_build_plan()
RETURNS TABLE (
  id_access text,
  nome_access text,
  cpf_access text,
  numero_cr_access text,
  cliente_id_correto integer,
  nome_cliente_correto text,
  cr_id_no_sistema integer,
  cliente_id_atualmente_vinculado integer,
  nome_cliente_atualmente_vinculado text,
  senha_plaintext text,
  tem_senha_sistema boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH dedup AS (
    SELECT DISTINCT ON (s.id_access)
      s.id_access,
      qa_norm_doc(COALESCE(s.cpf, c.cpf)) AS cpf_norm,
      qa_norm_cr(s.numero_cr) AS cr_norm,
      c.nome AS nome_access,
      s.senha_plaintext
    FROM staging_access_senhas_gov s
    LEFT JOIN staging_access_clientes c ON c.id_access = s.cliente_id_access
    WHERE s.import_batch = 'access_2026_04_29'
    ORDER BY s.id_access
  )
  SELECT
    d.id_access,
    d.nome_access,
    d.cpf_norm AS cpf_access,
    d.cr_norm AS numero_cr_access,
    c_real.id AS cliente_id_correto,
    c_real.nome_completo AS nome_cliente_correto,
    cr.id AS cr_id_no_sistema,
    cr.cliente_id AS cliente_id_atualmente_vinculado,
    c_atual.nome_completo AS nome_cliente_atualmente_vinculado,
    d.senha_plaintext,
    (cr.senha_gov_encrypted IS NOT NULL) AS tem_senha_sistema
  FROM dedup d
  JOIN qa_clientes c_real
    ON qa_norm_doc(c_real.cpf) = d.cpf_norm
   AND COALESCE(c_real.excluido, false) = false
  JOIN qa_cadastro_cr cr
    ON qa_norm_cr(cr.numero_cr) = d.cr_norm
   AND d.cr_norm <> 'NOREALIZADO'
  LEFT JOIN qa_clientes c_atual ON c_atual.id = cr.cliente_id
  WHERE cr.cliente_id IS DISTINCT FROM c_real.id;
$$;

REVOKE ALL ON FUNCTION public.qa_gov_reconcile_build_plan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_gov_reconcile_build_plan() TO service_role;