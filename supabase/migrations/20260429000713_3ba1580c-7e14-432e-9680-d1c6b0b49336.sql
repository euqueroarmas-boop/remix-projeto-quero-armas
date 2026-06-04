ALTER TABLE public.qa_gov_reconciliation_audit
  ALTER COLUMN cadastro_cr_id_anterior TYPE integer USING NULL,
  ALTER COLUMN cadastro_cr_id_correto  TYPE integer USING NULL;