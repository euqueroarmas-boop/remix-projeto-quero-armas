
-- View de reconciliação por CPF (NUNCA expõe senha plaintext, apenas booleanos)
CREATE OR REPLACE VIEW public.qa_gov_password_reconciliation_by_cpf AS
WITH access_data AS (
  SELECT DISTINCT ON (qa_norm_doc(COALESCE(s.cpf, c.cpf)))
    qa_norm_doc(COALESCE(s.cpf, c.cpf)) AS cpf_norm,
    c.nome              AS nome_access,
    qa_norm_email(COALESCE(s.email, c.email)) AS email_access,
    qa_norm_cr(s.numero_cr) AS cr_access_norm,
    s.numero_cr         AS cr_access_raw,
    s.senha_plaintext IS NOT NULL AND length(btrim(s.senha_plaintext)) > 0 AS tem_senha_access,
    s.id_access
  FROM staging_access_senhas_gov s
  LEFT JOIN staging_access_clientes c ON c.id_access = s.cliente_id_access
  WHERE s.import_batch = 'access_2026_04_29'
    AND qa_norm_doc(COALESCE(s.cpf, c.cpf)) IS NOT NULL
  ORDER BY qa_norm_doc(COALESCE(s.cpf, c.cpf)), s.id_access
),
supabase_clientes AS (
  SELECT
    qa_norm_doc(cpf) AS cpf_norm,
    id               AS cliente_id,
    nome_completo,
    qa_norm_email(email) AS email_norm
  FROM qa_clientes
  WHERE COALESCE(excluido, false) = false
    AND qa_norm_doc(cpf) IS NOT NULL
),
supabase_dups AS (
  SELECT cpf_norm FROM supabase_clientes GROUP BY cpf_norm HAVING COUNT(*) > 1
),
crs_ativos AS (
  SELECT
    cr.cliente_id,
    COUNT(*)                       AS total_crs_ativos,
    MIN(cr.id)                     AS unico_cr_id,
    bool_or(cr.senha_gov_encrypted IS NOT NULL) AS algum_cr_tem_senha
  FROM qa_cadastro_cr cr
  WHERE cr.consolidado_em IS NULL
    AND cr.cliente_id IS NOT NULL
  GROUP BY cr.cliente_id
)
SELECT
  a.cpf_norm,
  a.nome_access,
  a.email_access,
  a.cr_access_raw,
  a.cr_access_norm,
  a.tem_senha_access,
  s.cliente_id,
  s.nome_completo                       AS nome_supabase,
  s.email_norm                          AS email_supabase,
  ca.total_crs_ativos,
  ca.unico_cr_id                        AS cr_id_alvo,
  ca.algum_cr_tem_senha                 AS tem_senha_sistema,
  (a.email_access IS NOT NULL AND s.email_norm IS NOT NULL AND a.email_access = s.email_norm) AS email_match,
  CASE
    WHEN a.cpf_norm IS NULL                                       THEN 'cpf_access_vazio'
    WHEN s.cliente_id IS NULL                                     THEN 'cpf_nao_encontrado_supabase'
    WHEN d.cpf_norm IS NOT NULL                                   THEN 'cpf_duplicado_supabase'
    WHEN NOT a.tem_senha_access                                   THEN 'access_sem_senha'
    WHEN ca.total_crs_ativos IS NULL OR ca.total_crs_ativos = 0   THEN 'cliente_sem_cr_ativo'
    WHEN ca.total_crs_ativos > 1                                  THEN 'multiplos_crs_ativos'
    ELSE 'cpf_match_unico_seguro'
  END AS status,
  CASE
    WHEN a.cpf_norm IS NULL                                       THEN 'revisao_manual'
    WHEN s.cliente_id IS NULL                                     THEN 'revisao_manual'
    WHEN d.cpf_norm IS NOT NULL                                   THEN 'revisao_manual'
    WHEN NOT a.tem_senha_access                                   THEN 'ignorar'
    WHEN ca.total_crs_ativos IS NULL OR ca.total_crs_ativos = 0   THEN 'revisao_manual'
    WHEN ca.total_crs_ativos > 1                                  THEN 'revisao_manual'
    ELSE 'aplicar_automaticamente'
  END AS acao_sugerida
FROM access_data a
LEFT JOIN supabase_clientes s ON s.cpf_norm = a.cpf_norm
LEFT JOIN supabase_dups   d  ON d.cpf_norm = a.cpf_norm
LEFT JOIN crs_ativos      ca ON ca.cliente_id = s.cliente_id;

COMMENT ON VIEW public.qa_gov_password_reconciliation_by_cpf IS
  'Cruzamento Access x Supabase por CPF normalizado. NUNCA expõe senha plaintext, apenas booleanos.';

-- Restringe acesso (somente staff via RPC; views não têm RLS, então revogamos do anon/authenticated)
REVOKE ALL ON public.qa_gov_password_reconciliation_by_cpf FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.qa_gov_password_reconciliation_by_cpf TO service_role;

-- RPC segura para staff consultar o plano (sem expor senha)
CREATE OR REPLACE FUNCTION public.qa_gov_recon_cpf_summary()
RETURNS TABLE(status text, acao_sugerida text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT status, acao_sugerida, COUNT(*) AS total
  FROM public.qa_gov_password_reconciliation_by_cpf
  GROUP BY status, acao_sugerida
  ORDER BY total DESC;
$$;

REVOKE ALL ON FUNCTION public.qa_gov_recon_cpf_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_gov_recon_cpf_summary() TO authenticated, service_role;
