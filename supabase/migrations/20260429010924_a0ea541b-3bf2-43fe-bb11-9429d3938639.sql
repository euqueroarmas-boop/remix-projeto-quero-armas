-- =====================================================================
-- Tabela central de credenciais do cliente (Senha GOV é a primeira)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.qa_cliente_credenciais (
  id              BIGSERIAL PRIMARY KEY,
  cliente_id      INTEGER NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  tipo_credencial TEXT    NOT NULL DEFAULT 'gov_br',
  cadastro_cr_id  INTEGER NULL REFERENCES public.qa_cadastro_cr(id) ON DELETE SET NULL,
  senha_encrypted BYTEA   NOT NULL,
  senha_iv        BYTEA   NOT NULL,
  senha_tag       BYTEA   NOT NULL,
  origem          TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'ativa',
  notas           TEXT    NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID NULL,
  CONSTRAINT qa_cliente_credenciais_status_chk CHECK (status IN ('ativa','inativa','revogada'))
);

-- Apenas UMA credencial ativa por (cliente, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_cliente_credenciais_ativa
  ON public.qa_cliente_credenciais (cliente_id, tipo_credencial)
  WHERE status = 'ativa';

CREATE INDEX IF NOT EXISTS ix_qa_cliente_credenciais_cliente
  ON public.qa_cliente_credenciais (cliente_id);
CREATE INDEX IF NOT EXISTS ix_qa_cliente_credenciais_cr
  ON public.qa_cliente_credenciais (cadastro_cr_id) WHERE cadastro_cr_id IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.qa_cliente_credenciais_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_qa_cred_updated ON public.qa_cliente_credenciais;
CREATE TRIGGER trg_qa_cred_updated
  BEFORE UPDATE ON public.qa_cliente_credenciais
  FOR EACH ROW EXECUTE FUNCTION public.qa_cliente_credenciais_set_updated_at();

-- RLS: tudo apenas via service_role (edge functions). Sem políticas para anon/authenticated.
ALTER TABLE public.qa_cliente_credenciais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_cliente_credenciais FROM anon, authenticated;

-- =====================================================================
-- Tabela de auditoria imutável
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.qa_cliente_credenciais_audit (
  id               BIGSERIAL PRIMARY KEY,
  credencial_id    BIGINT NULL REFERENCES public.qa_cliente_credenciais(id) ON DELETE SET NULL,
  cliente_id       INTEGER NOT NULL,
  tipo_credencial  TEXT NOT NULL,
  acao             TEXT NOT NULL,
  origem           TEXT NULL,
  status_resultado TEXT NULL,
  rollback_payload JSONB NULL,
  ip               TEXT NULL,
  user_agent       TEXT NULL,
  user_id          UUID NULL,
  contexto         TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_qa_cred_audit_cliente
  ON public.qa_cliente_credenciais_audit (cliente_id, created_at DESC);

ALTER TABLE public.qa_cliente_credenciais_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_cliente_credenciais_audit FROM anon, authenticated;

-- Auditoria imutável (apenas INSERT)
CREATE OR REPLACE FUNCTION public.qa_cred_audit_imutavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'qa_cliente_credenciais_audit é imutável (acao=%).', TG_OP;
END $$;

DROP TRIGGER IF EXISTS trg_qa_cred_audit_imut ON public.qa_cliente_credenciais_audit;
CREATE TRIGGER trg_qa_cred_audit_imut
  BEFORE UPDATE OR DELETE ON public.qa_cliente_credenciais_audit
  FOR EACH ROW EXECUTE FUNCTION public.qa_cred_audit_imutavel();

-- =====================================================================
-- Helper: detectar origem efetiva da Senha GOV de um cliente
--   prioridade: central(qa_cliente_credenciais) > CR(qa_cadastro_cr)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_get_senha_gov_source(
  p_cliente_id     INTEGER,
  p_cadastro_cr_id INTEGER DEFAULT NULL
) RETURNS TABLE(
  source              TEXT,         -- 'central' | 'cr' | 'none'
  credencial_id       BIGINT,       -- id em qa_cliente_credenciais (se central)
  cadastro_cr_id      INTEGER,      -- id em qa_cadastro_cr (se cr)
  tem_senha           BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cred_id BIGINT;
  v_cred_cr INTEGER;
BEGIN
  -- 1) tenta central
  SELECT c.id, c.cadastro_cr_id INTO v_cred_id, v_cred_cr
  FROM public.qa_cliente_credenciais c
  WHERE c.cliente_id = p_cliente_id
    AND c.tipo_credencial = 'gov_br'
    AND c.status = 'ativa'
  LIMIT 1;

  IF v_cred_id IS NOT NULL THEN
    RETURN QUERY SELECT 'central'::text, v_cred_id, v_cred_cr, true;
    RETURN;
  END IF;

  -- 2) fallback: senha ainda no CR (legado)
  IF p_cadastro_cr_id IS NOT NULL THEN
    PERFORM 1 FROM public.qa_cadastro_cr cr
      WHERE cr.id = p_cadastro_cr_id
        AND cr.cliente_id = p_cliente_id
        AND cr.senha_gov_encrypted IS NOT NULL;
    IF FOUND THEN
      RETURN QUERY SELECT 'cr'::text, NULL::bigint, p_cadastro_cr_id, true;
      RETURN;
    END IF;
  ELSE
    -- caller não passou cr_id — tenta achar QUALQUER cr ativo do cliente com senha
    SELECT cr.id INTO v_cred_cr
      FROM public.qa_cadastro_cr cr
      WHERE cr.cliente_id = p_cliente_id
        AND cr.senha_gov_encrypted IS NOT NULL
        AND cr.consolidado_em IS NULL
      ORDER BY cr.id DESC
      LIMIT 1;
    IF v_cred_cr IS NOT NULL THEN
      RETURN QUERY SELECT 'cr'::text, NULL::bigint, v_cred_cr, true;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'none'::text, NULL::bigint, NULL::integer, false;
END $$;

REVOKE ALL ON FUNCTION public.qa_get_senha_gov_source(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_get_senha_gov_source(INTEGER, INTEGER) TO service_role;