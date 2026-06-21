ALTER TABLE public.qa_contracts DROP CONSTRAINT chk_qa_contracts_status;
ALTER TABLE public.qa_contracts ADD CONSTRAINT chk_qa_contracts_status CHECK (status = ANY (ARRAY[
  'generated_pending_company_signature',
  'pending_customer_signature',
  'customer_signature_uploaded',
  'validating',
  'validated',
  'rejected',
  'pending_manual_review',
  'arquivado_template_legado'
]));