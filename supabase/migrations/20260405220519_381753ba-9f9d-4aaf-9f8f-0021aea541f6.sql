
ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_event_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS replaced_by_invoice_id uuid REFERENCES public.fiscal_documents(id);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_is_active ON public.fiscal_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_last_event_at ON public.fiscal_documents(last_event_at);
