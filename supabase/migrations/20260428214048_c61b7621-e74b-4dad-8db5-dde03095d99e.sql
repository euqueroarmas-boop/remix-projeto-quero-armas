
-- ============================================================================
-- INTEGRAÇÃO ABA CR <-> ARSENAL: BACKFILL + DEDUP + PROTEÇÃO + RLS CLIENTE
-- ============================================================================

-- 1) BACKFILL: normalizar cliente_id para sempre o ID REAL de qa_clientes
UPDATE public.qa_cadastro_cr cr
SET cliente_id = c.id
FROM public.qa_clientes c
WHERE cr.cliente_id = c.id_legado AND c.id <> c.id_legado;

UPDATE public.qa_crafs cr
SET cliente_id = c.id
FROM public.qa_clientes c
WHERE cr.cliente_id = c.id_legado AND c.id <> c.id_legado;

UPDATE public.qa_gtes g
SET cliente_id = c.id
FROM public.qa_clientes c
WHERE g.cliente_id = c.id_legado AND c.id <> c.id_legado;

UPDATE public.qa_filiacoes f
SET cliente_id = c.id
FROM public.qa_clientes c
WHERE f.cliente_id = c.id_legado AND c.id <> c.id_legado;

UPDATE public.cliente_auth_links l
SET qa_cliente_id = c.id
FROM public.qa_clientes c
WHERE l.qa_cliente_id = c.id_legado AND c.id <> c.id_legado;

-- 2) DEDUP de qa_cadastro_cr (re-aponta auditoria de senha gov para o vencedor antes de excluir).
-- Desabilita o trigger imutável SOMENTE durante esta operação de manutenção (DDL).
ALTER TABLE public.qa_senha_gov_acessos DISABLE TRIGGER USER;

DO $$
DECLARE
  r RECORD;
  v_winner INT;
BEGIN
  FOR r IN
    SELECT cliente_id, COALESCE(numero_cr,'') AS num, COALESCE(validade_cr::text,'') AS val,
           ARRAY_AGG(id ORDER BY senha_gov_updated_at DESC NULLS LAST, id DESC) AS ids
    FROM public.qa_cadastro_cr
    WHERE cliente_id IS NOT NULL
    GROUP BY 1,2,3
    HAVING COUNT(*) > 1
  LOOP
    v_winner := r.ids[1];
    UPDATE public.qa_senha_gov_acessos
       SET cadastro_cr_id = v_winner
     WHERE cadastro_cr_id = ANY (r.ids[2:]);
    DELETE FROM public.qa_cadastro_cr WHERE id = ANY (r.ids[2:]);
  END LOOP;
END $$;

ALTER TABLE public.qa_senha_gov_acessos ENABLE TRIGGER USER;

-- 3) DEDUP de qa_crafs por (cliente_id, numero_arma) preenchidos
DELETE FROM public.qa_crafs cr
USING (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY cliente_id, numero_arma
             ORDER BY id DESC
           ) AS rn
    FROM public.qa_crafs
    WHERE cliente_id IS NOT NULL AND numero_arma IS NOT NULL AND btrim(numero_arma) <> ''
  ) x WHERE x.rn > 1
) dups WHERE cr.id = dups.id;

-- 4) ÍNDICES ÚNICOS PARCIAIS — proteção anti-duplicação futura
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_cadastro_cr_cliente_numero
  ON public.qa_cadastro_cr (cliente_id, numero_cr)
  WHERE cliente_id IS NOT NULL
    AND numero_cr IS NOT NULL
    AND btrim(numero_cr) <> ''
    AND lower(btrim(numero_cr)) <> 'não realizado'
    AND lower(btrim(numero_cr)) <> 'nao realizado';

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_crafs_cliente_numero_arma
  ON public.qa_crafs (cliente_id, numero_arma)
  WHERE cliente_id IS NOT NULL
    AND numero_arma IS NOT NULL
    AND btrim(numero_arma) <> '';

-- 5) RLS — permitir CLIENTE autenticado fazer CRUD do PRÓPRIO CR e CRAFs
DROP POLICY IF EXISTS qa_cadastro_cr_owner_insert ON public.qa_cadastro_cr;
CREATE POLICY qa_cadastro_cr_owner_insert
  ON public.qa_cadastro_cr FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

DROP POLICY IF EXISTS qa_cadastro_cr_owner_update ON public.qa_cadastro_cr;
CREATE POLICY qa_cadastro_cr_owner_update
  ON public.qa_cadastro_cr FOR UPDATE TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()))
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

DROP POLICY IF EXISTS qa_cadastro_cr_owner_delete ON public.qa_cadastro_cr;
CREATE POLICY qa_cadastro_cr_owner_delete
  ON public.qa_cadastro_cr FOR DELETE TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

DROP POLICY IF EXISTS qa_crafs_owner_insert ON public.qa_crafs;
CREATE POLICY qa_crafs_owner_insert
  ON public.qa_crafs FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

DROP POLICY IF EXISTS qa_crafs_owner_update ON public.qa_crafs;
CREATE POLICY qa_crafs_owner_update
  ON public.qa_crafs FOR UPDATE TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()))
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

DROP POLICY IF EXISTS qa_crafs_owner_delete ON public.qa_crafs;
CREATE POLICY qa_crafs_owner_delete
  ON public.qa_crafs FOR DELETE TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
