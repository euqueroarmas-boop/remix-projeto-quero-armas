
CREATE TABLE public.contract_templates (
  id text PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'recorrente',
  versao text NOT NULL DEFAULT '1.0',
  editavel boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  template_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active templates"
  ON public.contract_templates
  FOR SELECT
  TO anon, authenticated
  USING (ativo = true);

CREATE POLICY "Service role full access contract_templates"
  ON public.contract_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
