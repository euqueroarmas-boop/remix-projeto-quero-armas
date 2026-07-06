-- Protocolo de atendimento: sessões de chat ganham ciclo de vida e assunto
ALTER TABLE public.qa_chat_sessoes
  ADD COLUMN IF NOT EXISTS numero_protocolo  text,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo','encerrado')),
  ADD COLUMN IF NOT EXISTS assunto           text,
  ADD COLUMN IF NOT EXISTS assunto_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS last_activity_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at         timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessoes_protocolo
  ON public.qa_chat_sessoes(numero_protocolo);

CREATE INDEX IF NOT EXISTS idx_chat_sessoes_cliente_status
  ON public.qa_chat_sessoes(cliente_id, status, last_activity_at DESC);

-- Sequência diária para gerar QA-AAAAMMDD-NNNN
CREATE TABLE IF NOT EXISTS public.qa_chat_protocolo_seq (
  dia    date PRIMARY KEY,
  ultimo int  NOT NULL DEFAULT 0
);

ALTER TABLE public.qa_chat_protocolo_seq ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.qa_chat_protocolo_seq TO service_role;

CREATE OR REPLACE FUNCTION public.qa_gerar_protocolo_chat()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_seq int;
BEGIN
  INSERT INTO public.qa_chat_protocolo_seq (dia, ultimo)
  VALUES (v_dia, 1)
  ON CONFLICT (dia) DO UPDATE SET ultimo = qa_chat_protocolo_seq.ultimo + 1
  RETURNING ultimo INTO v_seq;
  RETURN 'QA-' || to_char(v_dia, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
END; $$;

-- Reabertura por assunto: encontra a sessão anterior mais parecida do cliente
CREATE OR REPLACE FUNCTION public.qa_chat_sessao_por_assunto(
  _cliente_id int, _emb vector(1536))
RETURNS TABLE (id uuid, numero_protocolo text, created_at timestamptz, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.numero_protocolo, s.created_at,
         1 - (s.assunto_embedding <=> _emb) AS similarity
  FROM public.qa_chat_sessoes s
  WHERE s.cliente_id = _cliente_id
    AND s.assunto_embedding IS NOT NULL
  ORDER BY s.assunto_embedding <=> _emb
  LIMIT 1;
$$;

-- Nível de confiança por resposta do assistente
ALTER TABLE public.qa_chat_mensagens
  ADD COLUMN IF NOT EXISTS nivel_confianca text
        CHECK (nivel_confianca IN ('alta','media','baixa'));