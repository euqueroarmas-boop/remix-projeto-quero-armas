
ALTER TABLE public.qa_kb_artigos
  ADD COLUMN IF NOT EXISTS reprocessed_by uuid,
  ADD COLUMN IF NOT EXISTS reprocessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reprocess_reason text;
