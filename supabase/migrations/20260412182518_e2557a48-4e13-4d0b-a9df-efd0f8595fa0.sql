
CREATE TABLE public.qa_document_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NULL,
  caso_id TEXT NULL,
  tipo_documental TEXT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  etapa_atual TEXT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  erro TEXT NULL,
  storage_path TEXT NULL,
  nome_arquivo TEXT NULL,
  mime_type TEXT NULL,
  tamanho_bytes BIGINT NULL,
  user_id TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_document_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read document jobs" ON public.qa_document_jobs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert document jobs" ON public.qa_document_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update document jobs" ON public.qa_document_jobs FOR UPDATE USING (true);

CREATE INDEX idx_qa_document_jobs_status ON public.qa_document_jobs (status);
CREATE INDEX idx_qa_document_jobs_documento_id ON public.qa_document_jobs (documento_id);
