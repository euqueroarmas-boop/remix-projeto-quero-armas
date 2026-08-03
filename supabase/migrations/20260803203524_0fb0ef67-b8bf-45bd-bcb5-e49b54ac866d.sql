CREATE TABLE IF NOT EXISTS public.qa_admin_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  status text,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  cliente_id bigint,
  cliente_nome text,
  documento_nome text,
  referencia_tabela text,
  referencia_id text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  lida boolean NOT NULL DEFAULT false,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.qa_admin_notificacoes TO authenticated;
GRANT ALL ON public.qa_admin_notificacoes TO service_role;

ALTER TABLE public.qa_admin_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_le_notificacoes_admin" ON public.qa_admin_notificacoes;
CREATE POLICY "staff_le_notificacoes_admin" ON public.qa_admin_notificacoes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo));

DROP POLICY IF EXISTS "staff_marca_lida_notificacoes_admin" ON public.qa_admin_notificacoes;
CREATE POLICY "staff_marca_lida_notificacoes_admin" ON public.qa_admin_notificacoes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo))
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo));

CREATE INDEX IF NOT EXISTS idx_qa_admin_notificacoes_created ON public.qa_admin_notificacoes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_admin_notificacoes_lida ON public.qa_admin_notificacoes (lida, created_at DESC);

-- Normaliza status heterogêneos em 3 estados visíveis
CREATE OR REPLACE FUNCTION public.qa_admin_notif_status(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(_status, '')) IN ('aprovado','aprovada','validado','conforme','concluido','concluído','ok') THEN 'aprovado'
    WHEN lower(coalesce(_status, '')) IN ('rejeitado','rejeitada','reprovado','reprovada','recusado','invalido','inválido','nao_conforme','não_conforme') THEN 'rejeitado'
    ELSE 'em_analise'
  END
$$;

-- Hub documental do cliente
CREATE OR REPLACE FUNCTION public.qa_admin_notif_doc_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st text;
  _nome text;
  _cli_nome text;
BEGIN
  IF TG_OP = 'UPDATE' AND coalesce(NEW.status,'') IS NOT DISTINCT FROM coalesce(OLD.status,'') THEN
    RETURN NEW;
  END IF;

  _st := public.qa_admin_notif_status(NEW.status);
  _nome := coalesce(NEW.nome_documento, NEW.tipo_documento, 'Documento');

  SELECT c.nome_completo INTO _cli_nome
  FROM public.qa_clientes c
  WHERE c.id = NEW.qa_cliente_id
  LIMIT 1;

  INSERT INTO public.qa_admin_notificacoes
    (tipo, status, titulo, mensagem, cliente_id, cliente_nome, documento_nome, referencia_tabela, referencia_id, link, metadata)
  VALUES (
    'documento',
    _st,
    CASE _st
      WHEN 'aprovado' THEN 'Documento aprovado'
      WHEN 'rejeitado' THEN 'Documento rejeitado'
      ELSE 'Documento em análise'
    END,
    coalesce(_cli_nome, 'Cliente') || ' — ' || _nome,
    NEW.qa_cliente_id,
    _cli_nome,
    _nome,
    'qa_documentos_cliente',
    NEW.id::text,
    CASE WHEN NEW.qa_cliente_id IS NOT NULL THEN '/clientes/' || NEW.qa_cliente_id::text ELSE NULL END,
    jsonb_build_object('tipo_documento', NEW.tipo_documento, 'status_bruto', NEW.status, 'motivo', NEW.motivo_reprovacao)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_admin_notif_doc_cliente ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_admin_notif_doc_cliente
AFTER INSERT OR UPDATE OF status ON public.qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_admin_notif_doc_cliente();

-- Checklist de processo
CREATE OR REPLACE FUNCTION public.qa_admin_notif_doc_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st text;
  _cli_nome text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- itens do checklist nascem pendentes (sem envio do cliente): não notifica
    IF NEW.arquivo_storage_key IS NULL AND NEW.arquivo_url IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF coalesce(NEW.status,'') IS NOT DISTINCT FROM coalesce(OLD.status,'') THEN
    RETURN NEW;
  END IF;

  IF lower(coalesce(NEW.status,'')) IN ('pendente','aguardando','nao_enviado','não_enviado') THEN
    RETURN NEW;
  END IF;

  _st := public.qa_admin_notif_status(NEW.status);

  SELECT c.nome_completo INTO _cli_nome
  FROM public.qa_clientes c
  WHERE c.id = NEW.cliente_id
  LIMIT 1;

  INSERT INTO public.qa_admin_notificacoes
    (tipo, status, titulo, mensagem, cliente_id, cliente_nome, documento_nome, referencia_tabela, referencia_id, link, metadata)
  VALUES (
    'checklist',
    _st,
    CASE _st
      WHEN 'aprovado' THEN 'Exigência cumprida'
      WHEN 'rejeitado' THEN 'Documento rejeitado'
      ELSE 'Documento recebido — em análise'
    END,
    coalesce(_cli_nome, 'Cliente') || ' — ' || coalesce(NEW.nome_documento, NEW.tipo_documento, 'Documento'),
    NEW.cliente_id,
    _cli_nome,
    coalesce(NEW.nome_documento, NEW.tipo_documento),
    'qa_processo_documentos',
    NEW.id::text,
    '/processos/' || NEW.processo_id::text,
    jsonb_build_object('processo_id', NEW.processo_id, 'status_bruto', NEW.status, 'motivo', NEW.motivo_rejeicao)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_admin_notif_doc_processo ON public.qa_processo_documentos;
CREATE TRIGGER trg_qa_admin_notif_doc_processo
AFTER INSERT OR UPDATE OF status ON public.qa_processo_documentos
FOR EACH ROW EXECUTE FUNCTION public.qa_admin_notif_doc_processo();

ALTER TABLE public.qa_admin_notificacoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_admin_notificacoes;