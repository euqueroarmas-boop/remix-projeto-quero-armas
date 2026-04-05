-- Add missing columns to fiscal_documents for Asaas integration
ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS asaas_invoice_id text,
  ADD COLUMN IF NOT EXISTS xml_url text,
  ADD COLUMN IF NOT EXISTS access_key text,
  ADD COLUMN IF NOT EXISTS invoice_series text,
  ADD COLUMN IF NOT EXISTS service_reference text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb DEFAULT '{}'::jsonb;

-- Unique index on asaas_invoice_id for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_documents_asaas_invoice_id
  ON public.fiscal_documents (asaas_invoice_id)
  WHERE asaas_invoice_id IS NOT NULL;

-- Performance index for per-client queries
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_customer_date
  ON public.fiscal_documents (customer_id, issue_date DESC);

-- Enable realtime for fiscal_documents
ALTER PUBLICATION supabase_realtime ADD TABLE public.fiscal_documents;