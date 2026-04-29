-- ============================================================
-- FASE 6 — Auditoria do Arsenal Manual/IA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.qa_cliente_armas_auditoria (
  id              BIGSERIAL PRIMARY KEY,
  arma_manual_id  BIGINT NOT NULL,
  qa_cliente_id   INTEGER,
  user_id         UUID,
  ator_tipo       TEXT NOT NULL CHECK (ator_tipo IN ('cliente','equipe','sistema','ia_ocr')),
  acao            TEXT NOT NULL CHECK (acao IN ('criada','editada','marcada_revisada','marcada_revisao','excluida','restaurada')),
  origem          TEXT CHECK (origem IN ('portal_cliente','modulo_clientes','ocr_ia','sistema')),
  campos_alterados JSONB DEFAULT '[]'::jsonb,
  dados_antes     JSONB,
  dados_depois    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_armas_audit_arma ON public.qa_cliente_armas_auditoria(arma_manual_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_armas_audit_cliente ON public.qa_cliente_armas_auditoria(qa_cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_armas_audit_user ON public.qa_cliente_armas_auditoria(user_id);

ALTER TABLE public.qa_cliente_armas_auditoria ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- RLS — leitura
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_armas_cliente_select" ON public.qa_cliente_armas_auditoria;
CREATE POLICY "audit_armas_cliente_select"
ON public.qa_cliente_armas_auditoria
FOR SELECT
TO authenticated
USING (
  qa_cliente_id = public.qa_current_cliente_id(auth.uid())
  OR public.qa_is_active_staff(auth.uid())
);

-- ──────────────────────────────────────────────
-- RLS — bloqueio de mutações pelo frontend
-- (auditoria só é gravada via trigger SECURITY DEFINER)
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_armas_no_insert" ON public.qa_cliente_armas_auditoria;
CREATE POLICY "audit_armas_no_insert"
ON public.qa_cliente_armas_auditoria
FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "audit_armas_no_update" ON public.qa_cliente_armas_auditoria;
CREATE POLICY "audit_armas_no_update"
ON public.qa_cliente_armas_auditoria
FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "audit_armas_no_delete" ON public.qa_cliente_armas_auditoria;
CREATE POLICY "audit_armas_no_delete"
ON public.qa_cliente_armas_auditoria
FOR DELETE TO authenticated
USING (false);

-- Defesa extra: mesmo via SQL direto, qualquer UPDATE/DELETE deve falhar.
CREATE OR REPLACE FUNCTION public.qa_cliente_armas_audit_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'qa_cliente_armas_auditoria é imutável (acao=%).', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS qa_cliente_armas_audit_block_mut ON public.qa_cliente_armas_auditoria;
CREATE TRIGGER qa_cliente_armas_audit_block_mut
BEFORE UPDATE OR DELETE ON public.qa_cliente_armas_auditoria
FOR EACH ROW EXECUTE FUNCTION public.qa_cliente_armas_audit_imutavel();

-- ──────────────────────────────────────────────
-- Trigger principal — registra eventos automaticamente
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_cliente_armas_manual_audit_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_user_id      uuid;
  v_cliente_id   integer;
  v_arma_id      bigint;
  v_ator_tipo    text;
  v_acao         text;
  v_origem       text;
  v_campos       jsonb := '[]'::jsonb;
  v_antes        jsonb;
  v_depois       jsonb;
  v_old_origem   text;
  v_new_origem   text;
  v_owner_uid    uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_arma_id    := NEW.id;
    v_cliente_id := NEW.qa_cliente_id;
    v_owner_uid  := NEW.user_id;
    v_new_origem := COALESCE(NEW.origem, 'manual');
    v_acao       := 'criada';
    v_antes      := NULL;
    v_depois     := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_arma_id    := NEW.id;
    v_cliente_id := NEW.qa_cliente_id;
    v_owner_uid  := NEW.user_id;
    v_old_origem := COALESCE(OLD.origem, 'manual');
    v_new_origem := COALESCE(NEW.origem, 'manual');
    v_antes      := to_jsonb(OLD);
    v_depois     := to_jsonb(NEW);

    -- Lista de campos alterados (ignora updated_at puro)
    SELECT COALESCE(jsonb_agg(key ORDER BY key), '[]'::jsonb)
      INTO v_campos
      FROM (
        SELECT key
          FROM jsonb_each(v_depois) d
         WHERE key NOT IN ('updated_at')
           AND (v_antes -> key) IS DISTINCT FROM (v_depois -> key)
      ) s;

    -- Decide ação específica
    IF OLD.needs_review IS DISTINCT FROM NEW.needs_review THEN
      IF OLD.needs_review = true AND NEW.needs_review = false THEN
        v_acao := 'marcada_revisada';
      ELSIF OLD.needs_review = false AND NEW.needs_review = true THEN
        v_acao := 'marcada_revisao';
      ELSE
        v_acao := 'editada';
      END IF;
    ELSE
      v_acao := 'editada';
    END IF;

    -- Não registrar updates "vazios" (somente updated_at)
    IF jsonb_array_length(v_campos) = 0 AND v_acao = 'editada' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_arma_id    := OLD.id;
    v_cliente_id := OLD.qa_cliente_id;
    v_owner_uid  := OLD.user_id;
    v_new_origem := COALESCE(OLD.origem, 'manual');
    v_acao       := 'excluida';
    v_antes      := to_jsonb(OLD);
    v_depois     := NULL;
  END IF;

  -- Identifica usuário responsável
  v_user_id := COALESCE(v_uid, v_owner_uid);

  -- Determina tipo de ator
  IF v_uid IS NOT NULL AND public.qa_is_active_staff(v_uid) THEN
    v_ator_tipo := 'equipe';
  ELSIF v_uid IS NOT NULL AND v_uid = v_owner_uid THEN
    v_ator_tipo := 'cliente';
  ELSIF v_new_origem IN ('ocr','ia') THEN
    v_ator_tipo := 'ia_ocr';
  ELSE
    v_ator_tipo := 'sistema';
  END IF;

  -- Determina origem do evento
  IF v_new_origem IN ('ocr','ia') AND TG_OP = 'INSERT' THEN
    v_origem := 'ocr_ia';
  ELSIF v_ator_tipo = 'cliente' THEN
    v_origem := 'portal_cliente';
  ELSIF v_ator_tipo = 'equipe' THEN
    v_origem := 'modulo_clientes';
  ELSE
    v_origem := 'sistema';
  END IF;

  INSERT INTO public.qa_cliente_armas_auditoria
    (arma_manual_id, qa_cliente_id, user_id, ator_tipo, acao, origem,
     campos_alterados, dados_antes, dados_depois)
  VALUES
    (v_arma_id, v_cliente_id, v_user_id, v_ator_tipo, v_acao, v_origem,
     v_campos, v_antes, v_depois);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_cliente_armas_manual_audit ON public.qa_cliente_armas_manual;
CREATE TRIGGER qa_cliente_armas_manual_audit
AFTER INSERT OR UPDATE OR DELETE ON public.qa_cliente_armas_manual
FOR EACH ROW EXECUTE FUNCTION public.qa_cliente_armas_manual_audit_trg();