ALTER TABLE public.qa_kb_artigos
  ADD COLUMN IF NOT EXISTS audit_plan_json jsonb,
  ADD COLUMN IF NOT EXISTS audit_plan_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_plan_model text;

CREATE INDEX IF NOT EXISTS idx_qa_kb_artigos_audit_plan
  ON public.qa_kb_artigos USING gin (audit_plan_json);