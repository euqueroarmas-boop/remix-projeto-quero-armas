
-- Tabela de vínculo cliente <-> auth user
CREATE TABLE IF NOT EXISTS public.cliente_auth_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_cliente_id INTEGER REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id UUID,
  email TEXT,
  documento_normalizado TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  email_pendente TEXT,
  motivo TEXT,
  activated_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_user ON public.cliente_auth_links(user_id);
CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_qa_cliente ON public.cliente_auth_links(qa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_customer ON public.cliente_auth_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_doc ON public.cliente_auth_links(documento_normalizado);
CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_email ON public.cliente_auth_links(lower(email));
CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_status ON public.cliente_auth_links(status);

ALTER TABLE public.cliente_auth_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam vinculos"
  ON public.cliente_auth_links FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::lp_app_role));

CREATE POLICY "Usuario ve seus vinculos"
  ON public.cliente_auth_links FOR SELECT
  USING (auth.uid() = user_id);

-- Tabela de OTPs
CREATE TABLE IF NOT EXISTS public.cliente_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  qa_cliente_id INTEGER,
  customer_id UUID,
  documento_normalizado TEXT,
  purpose TEXT NOT NULL DEFAULT 'portal_activation',
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_otp_email ON public.cliente_otp_codes(lower(email));
CREATE INDEX IF NOT EXISTS idx_cliente_otp_expires ON public.cliente_otp_codes(expires_at);

ALTER TABLE public.cliente_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem otp codes"
  ON public.cliente_otp_codes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- Logs de acesso
CREATE TABLE IF NOT EXISTS public.cliente_acesso_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento TEXT NOT NULL,
  identificador_mascarado TEXT,
  email TEXT,
  qa_cliente_id INTEGER,
  customer_id UUID,
  user_id UUID,
  status TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_acesso_logs_created ON public.cliente_acesso_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cliente_acesso_logs_evento ON public.cliente_acesso_logs(evento);

ALTER TABLE public.cliente_acesso_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem logs acesso"
  ON public.cliente_acesso_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_cliente_auth_links_updated()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cliente_auth_links_updated ON public.cliente_auth_links;
CREATE TRIGGER trg_cliente_auth_links_updated
  BEFORE UPDATE ON public.cliente_auth_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_cliente_auth_links_updated();
