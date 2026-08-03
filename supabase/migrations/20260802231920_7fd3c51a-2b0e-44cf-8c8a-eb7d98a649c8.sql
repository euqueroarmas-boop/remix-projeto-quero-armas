
CREATE TABLE IF NOT EXISTS public.qa_chat_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sessao_id UUID NULL,
  mensagem_id UUID NULL,
  cliente_id BIGINT NULL,
  usuario_id UUID NULL,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT NULL,
  tamanho_bytes BIGINT NULL,
  storage_path TEXT NOT NULL,
  hash_sha256 TEXT NULL,
  origem TEXT NOT NULL DEFAULT 'chat_cliente',
  texto_extraido TEXT NULL,
  metodo_extracao TEXT NULL,
  status_processamento TEXT NOT NULL DEFAULT 'pendente',
  erro_processamento TEXT NULL,
  validado_admin BOOLEAN NOT NULL DEFAULT false,
  validado_por UUID NULL,
  validado_em TIMESTAMPTZ NULL,
  observacao_admin TEXT NULL,
  virou_golden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_chat_anexos_sessao ON public.qa_chat_anexos (sessao_id);
CREATE INDEX IF NOT EXISTS idx_qa_chat_anexos_cliente ON public.qa_chat_anexos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_chat_anexos_validacao ON public.qa_chat_anexos (validado_admin, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.qa_chat_anexos TO authenticated;
GRANT ALL ON public.qa_chat_anexos TO service_role;
ALTER TABLE public.qa_chat_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anexos_chat_select_proprio_ou_equipe"
ON public.qa_chat_anexos FOR SELECT TO authenticated
USING (usuario_id = auth.uid() OR public.qa_is_active_staff(auth.uid()));

CREATE POLICY "anexos_chat_insert_proprio"
ON public.qa_chat_anexos FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid() OR public.qa_is_active_staff(auth.uid()));

CREATE POLICY "anexos_chat_update_equipe"
ON public.qa_chat_anexos FOR UPDATE TO authenticated
USING (public.qa_is_active_staff(auth.uid()))
WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.qa_chat_golden_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sessao_id UUID NULL,
  mensagem_id UUID NULL,
  cliente_id BIGINT NULL,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  anexos_ids UUID[] NOT NULL DEFAULT '{}',
  contexto_anexos TEXT NULL,
  fundamentacao_legal TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  peso NUMERIC NOT NULL DEFAULT 1.0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  doc_kb_id UUID NULL,
  aprovado_por UUID NULL,
  aprovado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_golden_ativo ON public.qa_chat_golden_records (ativo, created_at DESC);

GRANT SELECT ON public.qa_chat_golden_records TO authenticated;
GRANT ALL ON public.qa_chat_golden_records TO service_role;
ALTER TABLE public.qa_chat_golden_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "golden_all_equipe"
ON public.qa_chat_golden_records FOR ALL TO authenticated
USING (public.qa_is_active_staff(auth.uid()))
WITH CHECK (public.qa_is_active_staff(auth.uid()));

ALTER TABLE public.qa_chat_mensagens
  ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.qa_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_qa_chat_anexos_updated ON public.qa_chat_anexos;
CREATE TRIGGER trg_qa_chat_anexos_updated BEFORE UPDATE ON public.qa_chat_anexos
FOR EACH ROW EXECUTE FUNCTION public.qa_touch_updated_at();

DROP TRIGGER IF EXISTS trg_qa_golden_updated ON public.qa_chat_golden_records;
CREATE TRIGGER trg_qa_golden_updated BEFORE UPDATE ON public.qa_chat_golden_records
FOR EACH ROW EXECUTE FUNCTION public.qa_touch_updated_at();

CREATE POLICY "qa_chat_anexos_insert_proprio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'qa-chat-anexos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "qa_chat_anexos_select_proprio_ou_equipe"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'qa-chat-anexos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.qa_is_active_staff(auth.uid())));
