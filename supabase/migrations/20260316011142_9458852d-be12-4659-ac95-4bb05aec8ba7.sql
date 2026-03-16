
-- Add integration_logs table
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_name text NOT NULL,
  operation_name text NOT NULL,
  request_payload jsonb DEFAULT '{}'::jsonb,
  response_payload jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access integration_logs"
  ON public.integration_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can insert integration_logs"
  ON public.integration_logs FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read integration_logs"
  ON public.integration_logs FOR SELECT TO anon
  USING (true);

-- Add accepted_minimum_term to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS accepted_minimum_term boolean DEFAULT false;

-- Add contract_pdf_path to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_pdf_path text;
