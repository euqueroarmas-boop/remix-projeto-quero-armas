
CREATE TABLE IF NOT EXISTS public.qa_cliente_seguranca_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  alerta_login boolean NOT NULL DEFAULT true,
  mfa_troca_senha boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.qa_cliente_seguranca_config TO authenticated;
GRANT ALL ON public.qa_cliente_seguranca_config TO service_role;
ALTER TABLE public.qa_cliente_seguranca_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seguranca_config_own" ON public.qa_cliente_seguranca_config
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.qa_cliente_login_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qa_cliente_id uuid,
  email text,
  ip text,
  user_agent text,
  dispositivo text,
  navegador text,
  sistema text,
  local_aproximado text,
  origem text,
  alerta_enviado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qa_login_eventos_user ON public.qa_cliente_login_eventos(user_id, created_at DESC);
GRANT SELECT ON public.qa_cliente_login_eventos TO authenticated;
GRANT ALL ON public.qa_cliente_login_eventos TO service_role;
ALTER TABLE public.qa_cliente_login_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login_eventos_own_select" ON public.qa_cliente_login_eventos
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.qa_cliente_senha_desafios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  codigo_hash text NOT NULL,
  tentativas integer NOT NULL DEFAULT 0,
  expira_em timestamptz NOT NULL,
  usado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qa_senha_desafios_user ON public.qa_cliente_senha_desafios(user_id, created_at DESC);
GRANT ALL ON public.qa_cliente_senha_desafios TO service_role;
ALTER TABLE public.qa_cliente_senha_desafios ENABLE ROW LEVEL SECURITY;
