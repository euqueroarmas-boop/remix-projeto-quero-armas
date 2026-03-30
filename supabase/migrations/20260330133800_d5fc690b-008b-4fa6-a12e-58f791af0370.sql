
-- Table for certificate configuration (one active cert at a time)
CREATE TABLE public.certificate_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_storage_path text NOT NULL,
  certificate_hash text NOT NULL,
  subject text,
  issuer text,
  serial_number text,
  valid_from timestamp with time zone,
  valid_to timestamp with time zone,
  auto_sign_enabled boolean NOT NULL DEFAULT false,
  last_used_at timestamp with time zone,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access certificate_config"
  ON public.certificate_config FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Table for signature logs
CREATE TABLE public.signature_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  certificate_id uuid REFERENCES public.certificate_config(id) ON DELETE SET NULL,
  original_pdf_path text,
  signed_pdf_path text,
  document_hash text,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  validation_result text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signature_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access signature_logs"
  ON public.signature_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
