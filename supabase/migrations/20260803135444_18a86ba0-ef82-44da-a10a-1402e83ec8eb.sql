ALTER TABLE public.qa_chat_mensagens
  ADD COLUMN IF NOT EXISTS feedback_cliente text,
  ADD COLUMN IF NOT EXISTS feedback_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.qa_chat_mensagens'::regclass
      AND conname = 'qa_chat_mensagens_feedback_cliente_check'
  ) THEN
    ALTER TABLE public.qa_chat_mensagens
      ADD CONSTRAINT qa_chat_mensagens_feedback_cliente_check
      CHECK (feedback_cliente IS NULL OR feedback_cliente IN ('sim','nao'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_msgs_feedback_pendente
  ON public.qa_chat_mensagens (feedback_em DESC)
  WHERE feedback_cliente IS NOT NULL AND aprovada_kb IS NULL;