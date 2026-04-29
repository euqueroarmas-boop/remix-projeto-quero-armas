-- =====================================================================
-- FASE 3 — Camada agregadora do Arsenal Quero Armas
-- Tabela qa_cliente_armas_manual + view qa_cliente_armas (read-only).
-- Não faz backfill. Não altera qa_crafs/qa_cadastro_cr/qa_gtes.
-- =====================================================================

-- -------------------- 1) Tabela leve para armas manuais/IA --------------------
CREATE TABLE IF NOT EXISTS public.qa_cliente_armas_manual (
  id                          BIGSERIAL PRIMARY KEY,
  qa_cliente_id               INTEGER NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  user_id                     UUID,
  origem                      TEXT NOT NULL DEFAULT 'portal_cliente',
  sistema                     TEXT,
  tipo_arma                   TEXT,
  marca                       TEXT,
  modelo                      TEXT,
  calibre                     TEXT,
  numero_serie                TEXT,
  numero_craf                 TEXT,
  numero_sinarm               TEXT,
  numero_sigma                TEXT,
  numero_autorizacao_compra   TEXT,
  status_documental           TEXT,
  dados_extraidos_json        JSONB,
  needs_review                BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qa_cliente_armas_manual_sistema_chk
    CHECK (sistema IS NULL OR sistema IN ('SINARM','SIGMA'))
);

CREATE INDEX IF NOT EXISTS idx_qa_cliente_armas_manual_cliente
  ON public.qa_cliente_armas_manual (qa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_cliente_armas_manual_user
  ON public.qa_cliente_armas_manual (user_id);
CREATE INDEX IF NOT EXISTS idx_qa_cliente_armas_manual_review
  ON public.qa_cliente_armas_manual (needs_review) WHERE needs_review = true;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_qa_cliente_armas_manual_updated ON public.qa_cliente_armas_manual;
CREATE TRIGGER trg_qa_cliente_armas_manual_updated
BEFORE UPDATE ON public.qa_cliente_armas_manual
FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- Modelo nunca pode ser numérico puro: força modelo=NULL e needs_review=true
CREATE OR REPLACE FUNCTION public.qa_cliente_armas_manual_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.modelo IS NOT NULL AND btrim(NEW.modelo) ~ '^[0-9]+$' THEN
    NEW.modelo := NULL;
    NEW.needs_review := true;
  END IF;
  IF NEW.modelo IS NULL THEN
    NEW.needs_review := true;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_qa_cliente_armas_manual_validate ON public.qa_cliente_armas_manual;
CREATE TRIGGER trg_qa_cliente_armas_manual_validate
BEFORE INSERT OR UPDATE ON public.qa_cliente_armas_manual
FOR EACH ROW EXECUTE FUNCTION public.qa_cliente_armas_manual_validate();

-- -------------------- 2) RLS --------------------
ALTER TABLE public.qa_cliente_armas_manual ENABLE ROW LEVEL SECURITY;

-- Cliente: vê armas próprias
DROP POLICY IF EXISTS "cliente_le_proprias_armas_manual" ON public.qa_cliente_armas_manual;
CREATE POLICY "cliente_le_proprias_armas_manual"
ON public.qa_cliente_armas_manual
FOR SELECT
TO authenticated
USING (
  qa_cliente_id = public.qa_current_cliente_id(auth.uid())
  OR public.qa_is_active_staff(auth.uid())
);

-- Cliente: insere armas próprias
DROP POLICY IF EXISTS "cliente_insere_proprias_armas_manual" ON public.qa_cliente_armas_manual;
CREATE POLICY "cliente_insere_proprias_armas_manual"
ON public.qa_cliente_armas_manual
FOR INSERT
TO authenticated
WITH CHECK (
  (qa_cliente_id = public.qa_current_cliente_id(auth.uid()))
  OR public.qa_is_active_staff(auth.uid())
);

-- Cliente: atualiza armas próprias
DROP POLICY IF EXISTS "cliente_atualiza_proprias_armas_manual" ON public.qa_cliente_armas_manual;
CREATE POLICY "cliente_atualiza_proprias_armas_manual"
ON public.qa_cliente_armas_manual
FOR UPDATE
TO authenticated
USING (
  qa_cliente_id = public.qa_current_cliente_id(auth.uid())
  OR public.qa_is_active_staff(auth.uid())
)
WITH CHECK (
  qa_cliente_id = public.qa_current_cliente_id(auth.uid())
  OR public.qa_is_active_staff(auth.uid())
);

-- Apenas staff deleta
DROP POLICY IF EXISTS "staff_deleta_armas_manual" ON public.qa_cliente_armas_manual;
CREATE POLICY "staff_deleta_armas_manual"
ON public.qa_cliente_armas_manual
FOR DELETE
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

-- -------------------- 3) View unificada qa_cliente_armas --------------------
DROP VIEW IF EXISTS public.qa_cliente_armas;
CREATE VIEW public.qa_cliente_armas
WITH (security_invoker = true)
AS
WITH crafs AS (
  SELECT
    ('craf:' || c.id::text)                                     AS arma_uid,
    'craf'::text                                                AS fonte,
    c.cliente_id                                                AS qa_cliente_id,
    NULL::uuid                                                  AS user_id,
    CASE
      WHEN c.numero_sigma IS NOT NULL AND btrim(c.numero_sigma) <> '' THEN 'SIGMA'
      ELSE 'SINARM'
    END                                                         AS sistema,
    NULL::text                                                  AS tipo_arma,
    NULL::text                                                  AS marca,
    -- modelo: usa nome_arma se NÃO for numérico puro; nunca usa numero_arma como modelo
    CASE
      WHEN c.nome_arma IS NOT NULL
       AND btrim(c.nome_arma) <> ''
       AND btrim(c.nome_arma) !~ '^[0-9]+$'
      THEN c.nome_arma
      ELSE NULL
    END                                                         AS modelo,
    NULL::text                                                  AS calibre,
    c.numero_arma                                               AS numero_serie,
    c.nome_craf                                                 AS numero_craf,
    NULL::text                                                  AS numero_sinarm,
    c.numero_sigma                                              AS numero_sigma,
    NULL::text                                                  AS numero_autorizacao_compra,
    NULL::text                                                  AS status_documental,
    -- needs_review se modelo ficou nulo
    (c.nome_arma IS NULL
       OR btrim(c.nome_arma) = ''
       OR btrim(c.nome_arma) ~ '^[0-9]+$')                     AS needs_review,
    NULL::timestamptz                                           AS created_at,
    NULL::timestamptz                                           AS updated_at
  FROM public.qa_crafs c
  WHERE c.cliente_id IS NOT NULL
),
manual AS (
  SELECT
    ('manual:' || m.id::text)        AS arma_uid,
    'manual'::text                   AS fonte,
    m.qa_cliente_id,
    m.user_id,
    m.sistema,
    m.tipo_arma,
    m.marca,
    m.modelo,
    m.calibre,
    m.numero_serie,
    m.numero_craf,
    m.numero_sinarm,
    m.numero_sigma,
    m.numero_autorizacao_compra,
    m.status_documental,
    m.needs_review,
    m.created_at,
    m.updated_at
  FROM public.qa_cliente_armas_manual m
)
SELECT * FROM crafs
UNION ALL
SELECT * FROM manual;

COMMENT ON VIEW public.qa_cliente_armas IS
  'FASE 3: View unificada de armas (CRAF + manual/IA). Read-only. RLS herdada das tabelas base via security_invoker.';

GRANT SELECT ON public.qa_cliente_armas TO authenticated;