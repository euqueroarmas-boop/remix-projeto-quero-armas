-- 0) Amplia a constraint para aceitar 'consolidate'
ALTER TABLE public.qa_senha_gov_acessos
  DROP CONSTRAINT IF EXISTS qa_senha_gov_acessos_acao_check;
ALTER TABLE public.qa_senha_gov_acessos
  ADD CONSTRAINT qa_senha_gov_acessos_acao_check
  CHECK (acao = ANY (ARRAY['read','write','migrate','denied_mismatch','reconcile','consolidate']));

-- 1) Snapshot pré-consolidação
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='qa_cadastro_cr_consolidacao_snapshot') THEN
    CREATE TABLE public.qa_cadastro_cr_consolidacao_snapshot AS
    SELECT *, now() AS snapshot_em FROM public.qa_cadastro_cr;
    ALTER TABLE public.qa_cadastro_cr_consolidacao_snapshot ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "qa_cadastro_cr_consolidacao_snapshot_staff" ON public.qa_cadastro_cr_consolidacao_snapshot;
CREATE POLICY "qa_cadastro_cr_consolidacao_snapshot_staff"
ON public.qa_cadastro_cr_consolidacao_snapshot FOR SELECT
USING (public.qa_is_active_staff(auth.uid()));

-- 2) Coluna de consolidação
ALTER TABLE public.qa_cadastro_cr
  ADD COLUMN IF NOT EXISTS consolidado_em timestamptz,
  ADD COLUMN IF NOT EXISTS consolidado_motivo text,
  ADD COLUMN IF NOT EXISTS consolidado_por uuid;

-- 3) Marca duplicatas órfãs
WITH dupes AS (
  SELECT cliente_id FROM public.qa_cadastro_cr
  WHERE cliente_id IS NOT NULL AND consolidado_em IS NULL
  GROUP BY cliente_id HAVING COUNT(*) > 1
),
ranked AS (
  SELECT cr.id,
    ROW_NUMBER() OVER (
      PARTITION BY cr.cliente_id
      ORDER BY
        CASE WHEN cr.numero_cr IS NULL OR upper(btrim(cr.numero_cr)) IN ('','NÃO REALIZADO','NAO REALIZADO') THEN 1 ELSE 0 END,
        CASE WHEN cr.validade_cr IS NULL THEN 1 ELSE 0 END,
        cr.id
    ) AS rn
  FROM public.qa_cadastro_cr cr
  WHERE cr.cliente_id IN (SELECT cliente_id FROM dupes) AND cr.consolidado_em IS NULL
)
UPDATE public.qa_cadastro_cr cr
SET consolidado_em = now(),
    consolidado_motivo = 'P0 incidente 26/04 — duplicata órfã pós-reconciliação'
FROM ranked r
WHERE cr.id = r.id AND r.rn > 1;

-- 4) Auditoria das consolidações
INSERT INTO public.qa_senha_gov_acessos (cadastro_cr_id, cliente_id, user_id, acao, contexto)
SELECT cr.id, cr.cliente_id, '00000000-0000-0000-0000-000000000000'::uuid, 'consolidate',
       'CR marcado como consolidado (duplicata órfã P0)'
FROM public.qa_cadastro_cr cr
WHERE cr.consolidado_motivo = 'P0 incidente 26/04 — duplicata órfã pós-reconciliação'
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_senha_gov_acessos a
    WHERE a.cadastro_cr_id = cr.id AND a.acao = 'consolidate'
  );

-- 5) Índice único: 1 CR ativo por cliente
DROP INDEX IF EXISTS uq_qa_cadastro_cr_cliente_ativo;
CREATE UNIQUE INDEX uq_qa_cadastro_cr_cliente_ativo
ON public.qa_cadastro_cr (cliente_id)
WHERE consolidado_em IS NULL AND cliente_id IS NOT NULL;

-- 6) Unicidade cliente+numero (quando preenchido)
DROP INDEX IF EXISTS uq_qa_cadastro_cr_cliente_numero;
CREATE UNIQUE INDEX uq_qa_cadastro_cr_cliente_numero
ON public.qa_cadastro_cr (cliente_id, numero_cr)
WHERE consolidado_em IS NULL
  AND cliente_id IS NOT NULL
  AND numero_cr IS NOT NULL
  AND btrim(numero_cr) <> ''
  AND upper(btrim(numero_cr)) NOT IN ('NÃO REALIZADO', 'NAO REALIZADO');

-- 7) Trigger de auditoria de cliente_id
DROP TRIGGER IF EXISTS trg_qa_cadastro_cr_audit_cliente ON public.qa_cadastro_cr;
CREATE TRIGGER trg_qa_cadastro_cr_audit_cliente
AFTER UPDATE OF cliente_id ON public.qa_cadastro_cr
FOR EACH ROW
EXECUTE FUNCTION public.qa_cadastro_cr_audit_cliente_change();
