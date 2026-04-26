CREATE INDEX IF NOT EXISTS idx_qa_logs_auditoria_created_at
  ON public.qa_logs_auditoria (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_logs_auditoria_entidade
  ON public.qa_logs_auditoria (entidade, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_logs_auditoria_usuario
  ON public.qa_logs_auditoria (usuario_id, created_at DESC);