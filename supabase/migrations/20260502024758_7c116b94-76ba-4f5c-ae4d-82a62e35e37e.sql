ALTER TABLE public.qa_processos
  ADD COLUMN IF NOT EXISTS respostas_questionario_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_qa_processos_respostas_questionario
  ON public.qa_processos USING gin (respostas_questionario_json);