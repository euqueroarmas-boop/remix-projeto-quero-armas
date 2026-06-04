-- ============================================================================
-- RECONCILIAÇÃO FORENSE DE SENHAS GOV — INFRAESTRUTURA SEGURA (sem dados ainda)
-- ============================================================================

-- 1. Helpers de normalização -------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_norm_doc(p_doc text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(coalesce(p_doc, ''), '[^0-9]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.qa_norm_email(p_email text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(btrim(coalesce(p_email, ''))), '')
$$;

CREATE OR REPLACE FUNCTION public.qa_norm_cr(p_cr text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(upper(coalesce(p_cr, '')), '[^0-9A-Z]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.qa_norm_nome(p_nome text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(upper(public.unaccent(btrim(coalesce(p_nome, '')))), '\s+', ' ', 'g'), '')
$$;

-- 2. Tabelas de staging ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staging_access_clientes (
  id_access text, nome text, cpf text, cnpj text, email text,
  telefone text, observacoes text, raw jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(), import_batch text
);
CREATE TABLE IF NOT EXISTS public.staging_access_crs (
  id_access text, cliente_id_access text, numero_cr text, validade text, categoria text,
  raw jsonb, imported_at timestamptz NOT NULL DEFAULT now(), import_batch text
);
CREATE TABLE IF NOT EXISTS public.staging_access_senhas_gov (
  id_access text, cliente_id_access text, cr_id_access text,
  numero_cr text, cpf text, email text,
  senha_plaintext text, observacoes text, raw jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(), import_batch text
);
CREATE TABLE IF NOT EXISTS public.staging_access_crafs (
  id_access text, cliente_id_access text, numero_craf text, arma text,
  raw jsonb, imported_at timestamptz NOT NULL DEFAULT now(), import_batch text
);
CREATE TABLE IF NOT EXISTS public.staging_access_armas (
  id_access text, cliente_id_access text, numero_serie text, modelo text, calibre text,
  raw jsonb, imported_at timestamptz NOT NULL DEFAULT now(), import_batch text
);

CREATE INDEX IF NOT EXISTS idx_staging_clientes_cpf  ON public.staging_access_clientes (public.qa_norm_doc(cpf));
CREATE INDEX IF NOT EXISTS idx_staging_clientes_cnpj ON public.staging_access_clientes (public.qa_norm_doc(cnpj));
CREATE INDEX IF NOT EXISTS idx_staging_clientes_mail ON public.staging_access_clientes (public.qa_norm_email(email));
CREATE INDEX IF NOT EXISTS idx_staging_crs_numero    ON public.staging_access_crs       (public.qa_norm_cr(numero_cr));
CREATE INDEX IF NOT EXISTS idx_staging_senhas_cr     ON public.staging_access_senhas_gov (public.qa_norm_cr(numero_cr));
CREATE INDEX IF NOT EXISTS idx_staging_senhas_cpf    ON public.staging_access_senhas_gov (public.qa_norm_doc(cpf));
CREATE INDEX IF NOT EXISTS idx_staging_senhas_mail   ON public.staging_access_senhas_gov (public.qa_norm_email(email));

-- 3. RLS — somente staff QA ativo --------------------------------------------
ALTER TABLE public.staging_access_clientes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_access_crs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_access_senhas_gov  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_access_crafs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_access_armas       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staging_access_clientes','staging_access_crs','staging_access_senhas_gov',
    'staging_access_crafs','staging_access_armas'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS staff_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY staff_all ON public.%I FOR ALL TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()))',
      t
    );
  END LOOP;
END $$;

-- 4. Auditoria imutável ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_gov_reconciliation_audit (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao                     text NOT NULL,
  status                   text NOT NULL,
  nivel_confianca          text NOT NULL,
  cliente_id_anterior      integer,
  cliente_id_correto       integer,
  cadastro_cr_id_anterior  uuid,
  cadastro_cr_id_correto   uuid,
  cpf_normalizado          text,
  email_normalizado        text,
  numero_cr_normalizado    text,
  origem                   text NOT NULL DEFAULT 'access_reconciliation',
  motivo                   text,
  evidencia                jsonb,
  executado_por            uuid DEFAULT auth.uid(),
  executado_em             timestamptz NOT NULL DEFAULT now(),
  rollback_payload         jsonb
);
ALTER TABLE public.qa_gov_reconciliation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_staff_select ON public.qa_gov_reconciliation_audit;
CREATE POLICY audit_staff_select ON public.qa_gov_reconciliation_audit
  FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS audit_staff_insert ON public.qa_gov_reconciliation_audit;
CREATE POLICY audit_staff_insert ON public.qa_gov_reconciliation_audit
  FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.qa_gov_recon_audit_imutavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'qa_gov_reconciliation_audit é imutável.'; END $$;

DROP TRIGGER IF EXISTS trg_audit_imutavel ON public.qa_gov_reconciliation_audit;
CREATE TRIGGER trg_audit_imutavel
  BEFORE UPDATE OR DELETE ON public.qa_gov_reconciliation_audit
  FOR EACH ROW EXECUTE FUNCTION public.qa_gov_recon_audit_imutavel();

-- 5. View forense ------------------------------------------------------------
-- Campos reais: qa_clientes.nome_completo, sem CNPJ, status_excluido = excluido bool ou status='excluido_lgpd'
-- Senha: qa_cadastro_cr.senha_gov_encrypted (bytea)
CREATE OR REPLACE VIEW public.qa_gov_password_reconciliation_view
WITH (security_invoker = true) AS
WITH sis_cli AS (
  SELECT
    c.id                                 AS cliente_id_sistema,
    c.nome_completo                      AS nome_sistema,
    public.qa_norm_doc(c.cpf)            AS cpf_sistema,
    public.qa_norm_email(c.email)        AS email_sistema,
    public.qa_norm_nome(c.nome_completo) AS nome_norm_sistema
  FROM public.qa_clientes c
  WHERE coalesce(c.excluido, false) = false
    AND coalesce(c.status, '') NOT IN ('excluido_lgpd')
),
sis_cr AS (
  SELECT
    cr.id                              AS cadastro_cr_id_sistema,
    cr.cliente_id                      AS cliente_id_sistema,
    public.qa_norm_cr(cr.numero_cr)    AS numero_cr_norm_sistema,
    cr.numero_cr                       AS numero_cr_sistema,
    (cr.senha_gov_encrypted IS NOT NULL) AS tem_senha_sistema,
    encode(digest(coalesce(cr.senha_gov_encrypted::text,''), 'sha256'), 'hex') AS hash_senha_sistema
  FROM public.qa_cadastro_cr cr
),
acc AS (
  SELECT
    s.id_access,
    s.cliente_id_access,
    s.cr_id_access,
    public.qa_norm_doc(coalesce(s.cpf, c.cpf, c.cnpj))     AS cpf_access,
    public.qa_norm_email(coalesce(s.email, c.email))       AS email_access,
    public.qa_norm_cr(coalesce(s.numero_cr, cr.numero_cr)) AS numero_cr_access,
    public.qa_norm_nome(c.nome)                            AS nome_norm_access,
    c.nome                                                  AS nome_access,
    (s.senha_plaintext IS NOT NULL AND length(btrim(s.senha_plaintext)) > 0) AS tem_senha_access,
    encode(digest(coalesce(s.senha_plaintext,''), 'sha256'), 'hex')          AS hash_senha_access
  FROM public.staging_access_senhas_gov s
  LEFT JOIN public.staging_access_clientes c ON c.id_access = s.cliente_id_access
  LEFT JOIN public.staging_access_crs      cr ON cr.id_access = s.cr_id_access
),
m_cpf_cr AS (
  SELECT a.id_access,
         sc.cliente_id_sistema, sc.email_sistema, sc.nome_sistema,
         scr.cadastro_cr_id_sistema, scr.numero_cr_sistema,
         scr.tem_senha_sistema, scr.hash_senha_sistema
  FROM acc a
  JOIN sis_cli sc ON sc.cpf_sistema = a.cpf_access AND a.cpf_access IS NOT NULL
  JOIN sis_cr scr ON scr.cliente_id_sistema = sc.cliente_id_sistema
                 AND scr.numero_cr_norm_sistema = a.numero_cr_access
                 AND a.numero_cr_access IS NOT NULL
)
SELECT
  a.id_access,
  a.cpf_access, a.email_access, a.numero_cr_access, a.nome_access,
  a.tem_senha_access, a.hash_senha_access,
  mfc.cliente_id_sistema      AS cliente_id_sugerido,
  mfc.cadastro_cr_id_sistema  AS cadastro_cr_id_sugerido,
  mfc.numero_cr_sistema       AS numero_cr_sistema_sugerido,
  mfc.email_sistema           AS email_sistema_sugerido,
  mfc.nome_sistema            AS nome_sistema_sugerido,
  mfc.tem_senha_sistema, mfc.hash_senha_sistema,
  curr_cr.cliente_id          AS cliente_id_atual_do_cr,
  curr_cli.nome_completo      AS nome_atual_do_cr,
  CASE
    WHEN a.numero_cr_access IS NULL AND a.cpf_access IS NULL THEN 'sem_match'
    WHEN mfc.cliente_id_sistema IS NULL THEN 'sem_match'
    WHEN curr_cr.cliente_id IS NOT NULL
         AND curr_cr.cliente_id <> mfc.cliente_id_sistema THEN 'corrigir_cliente_vinculado'
    WHEN mfc.tem_senha_sistema = false AND a.tem_senha_access = true THEN 'sistema_sem_senha'
    WHEN mfc.tem_senha_sistema = true  AND a.tem_senha_access = false THEN 'access_sem_senha'
    WHEN mfc.tem_senha_sistema = true  AND a.tem_senha_access = true
         AND mfc.hash_senha_sistema <> a.hash_senha_access THEN 'senha_divergente_mesmo_cliente'
    ELSE 'ok'
  END AS status_reconciliacao,
  CASE
    WHEN mfc.cliente_id_sistema IS NOT NULL THEN 'alto'
    WHEN a.cpf_access IS NOT NULL OR a.email_access IS NOT NULL THEN 'medio'
    ELSE 'baixo'
  END AS nivel_confianca,
  CASE
    WHEN mfc.cliente_id_sistema IS NULL THEN 'revisao_manual'
    WHEN curr_cr.cliente_id IS NOT NULL
         AND curr_cr.cliente_id <> mfc.cliente_id_sistema THEN 'mover_senha'
    WHEN mfc.tem_senha_sistema = false AND a.tem_senha_access = true THEN 'inserir_senha_do_access'
    WHEN mfc.tem_senha_sistema = true  AND a.tem_senha_access = true
         AND mfc.hash_senha_sistema <> a.hash_senha_access THEN 'revisao_manual'
    ELSE 'manter'
  END AS acao_recomendada
FROM acc a
LEFT JOIN m_cpf_cr mfc ON mfc.id_access = a.id_access
LEFT JOIN public.qa_cadastro_cr curr_cr
       ON public.qa_norm_cr(curr_cr.numero_cr) = a.numero_cr_access AND a.numero_cr_access IS NOT NULL
LEFT JOIN public.qa_clientes curr_cli ON curr_cli.id = curr_cr.cliente_id;

REVOKE ALL ON public.qa_gov_password_reconciliation_view FROM anon, authenticated;
GRANT  SELECT ON public.qa_gov_password_reconciliation_view TO authenticated;

COMMENT ON VIEW public.qa_gov_password_reconciliation_view IS
'View forense (security_invoker) Access (staging) x produção. Nunca expõe senha — apenas flags tem_senha_* e hashes sha256.';