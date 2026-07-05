
ALTER TABLE public.qa_chat_mensagens
  ADD COLUMN IF NOT EXISTS aprovada_kb  boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aprovada_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovada_em  timestamptz,
  ADD COLUMN IF NOT EXISTS doc_kb_id    uuid REFERENCES public.qa_documentos_conhecimento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_msgs_fila_aprovacao
  ON public.qa_chat_mensagens(created_at DESC)
  WHERE role = 'assistant' AND aprovada_kb IS NULL;
