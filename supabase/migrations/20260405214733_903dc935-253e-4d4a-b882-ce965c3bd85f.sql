-- Add updated_at to fiscal_documents
ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Create invoice_files table
CREATE TABLE public.invoice_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'pdf',
  file_url text NOT NULL,
  filename text,
  mime_type text DEFAULT 'application/pdf',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by invoice
CREATE INDEX idx_invoice_files_invoice_id ON public.invoice_files (invoice_id);

-- Enable RLS
ALTER TABLE public.invoice_files ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access invoice_files"
  ON public.invoice_files FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read files of their own invoices
CREATE POLICY "Auth users read own invoice_files"
  ON public.invoice_files FOR SELECT
  TO authenticated
  USING (
    invoice_id IN (
      SELECT fd.id FROM public.fiscal_documents fd
      WHERE fd.customer_id IN (
        SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()
      )
    )
  );

-- Trigger for updated_at on fiscal_documents
CREATE OR REPLACE FUNCTION public.update_fiscal_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_fiscal_documents_updated_at
  BEFORE UPDATE ON public.fiscal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fiscal_documents_updated_at();