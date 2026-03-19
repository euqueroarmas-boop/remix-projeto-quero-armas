
CREATE TABLE public.logs_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  mensagem text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  user_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert logs" ON public.logs_sistema FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Service role full access logs" ON public.logs_sistema FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_logs_sistema_tipo ON public.logs_sistema(tipo);
CREATE INDEX idx_logs_sistema_status ON public.logs_sistema(status);
CREATE INDEX idx_logs_sistema_created_at ON public.logs_sistema(created_at DESC);
