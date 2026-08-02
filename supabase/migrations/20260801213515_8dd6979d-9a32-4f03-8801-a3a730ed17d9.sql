CREATE TABLE public.email_content_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  subject text,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  html text,
  plain_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_content_log_message_id_key ON public.email_content_log(message_id);
CREATE INDEX idx_email_content_log_recipient ON public.email_content_log(recipient_email);
CREATE INDEX idx_email_content_log_created ON public.email_content_log(created_at DESC);

GRANT ALL ON public.email_content_log TO service_role;

ALTER TABLE public.email_content_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages email content log"
  ON public.email_content_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');