-- Chat sessions and messages for the client Help Center
CREATE TABLE public.qa_chat_sessoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   integer NOT NULL,
  titulo       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_chat_sessoes TO authenticated;
GRANT ALL ON public.qa_chat_sessoes TO service_role;

ALTER TABLE public.qa_chat_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_sessoes_owner ON public.qa_chat_sessoes
  FOR ALL TO authenticated
  USING  (cliente_id = public.qa_current_cliente_id(auth.uid()))
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

CREATE POLICY chat_sessoes_staff ON public.qa_chat_sessoes
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE INDEX idx_chat_sessoes_cliente ON public.qa_chat_sessoes(cliente_id, updated_at DESC);

CREATE TABLE public.qa_chat_mensagens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id    uuid NOT NULL REFERENCES public.qa_chat_sessoes(id) ON DELETE CASCADE,
  cliente_id   integer NOT NULL,
  role         text NOT NULL CHECK (role IN ('user','assistant')),
  content      text NOT NULL,
  fontes       jsonb DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_chat_mensagens TO authenticated;
GRANT ALL ON public.qa_chat_mensagens TO service_role;

ALTER TABLE public.qa_chat_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_mensagens_owner ON public.qa_chat_mensagens
  FOR ALL TO authenticated
  USING  (cliente_id = public.qa_current_cliente_id(auth.uid()))
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

CREATE POLICY chat_mensagens_staff ON public.qa_chat_mensagens
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE INDEX idx_chat_mensagens_sessao ON public.qa_chat_mensagens(sessao_id, created_at ASC);