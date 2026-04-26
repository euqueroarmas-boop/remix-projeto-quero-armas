ALTER TABLE public.qa_cadastro_cr
  ADD COLUMN IF NOT EXISTS senha_gov_encrypted bytea,
  ADD COLUMN IF NOT EXISTS senha_gov_iv bytea,
  ADD COLUMN IF NOT EXISTS senha_gov_tag bytea,
  ADD COLUMN IF NOT EXISTS senha_gov_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS senha_gov_updated_by uuid;

CREATE TABLE IF NOT EXISTS public.qa_senha_gov_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadastro_cr_id integer NOT NULL REFERENCES public.qa_cadastro_cr(id) ON DELETE CASCADE,
  cliente_id integer,
  user_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('read','write','migrate')),
  ip text,
  user_agent text,
  contexto text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_senha_gov_acessos_cadastro
  ON public.qa_senha_gov_acessos(cadastro_cr_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_senha_gov_acessos_user
  ON public.qa_senha_gov_acessos(user_id, created_at DESC);

ALTER TABLE public.qa_senha_gov_acessos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff ativo le auditoria senha gov" ON public.qa_senha_gov_acessos;
CREATE POLICY "Staff ativo le auditoria senha gov"
  ON public.qa_senha_gov_acessos
  FOR SELECT
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.qa_senha_gov_acessos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria de Senha Gov são imutáveis (acao=%).', TG_OP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_senha_gov_acessos_no_update ON public.qa_senha_gov_acessos;
CREATE TRIGGER trg_qa_senha_gov_acessos_no_update
  BEFORE UPDATE OR DELETE ON public.qa_senha_gov_acessos
  FOR EACH ROW EXECUTE FUNCTION public.qa_senha_gov_acessos_imutavel();

COMMENT ON COLUMN public.qa_cadastro_cr.senha_gov IS
  'DEPRECATED — texto puro mantido apenas durante migração. Use edge function qa-senha-gov (AES-256-GCM em senha_gov_encrypted).';
COMMENT ON COLUMN public.qa_cadastro_cr.senha_gov_encrypted IS
  'Senha Gov cifrada com AES-256-GCM. Acesso via edge function qa-senha-gov com auditoria.';