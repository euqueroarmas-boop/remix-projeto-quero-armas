
ALTER TABLE public.qa_documentos_conhecimento
ADD COLUMN IF NOT EXISTS url_origem text DEFAULT null;

ALTER TABLE public.qa_documentos_conhecimento
ADD COLUMN IF NOT EXISTS tipo_origem text NOT NULL DEFAULT 'arquivo_upload';

ALTER TABLE public.qa_documentos_conhecimento
ADD COLUMN IF NOT EXISTS metodo_extracao text DEFAULT null;
