-- 1) Migrar os 8 registros existentes para o novo padrão
UPDATE public.qa_solicitacoes_servico
SET status_servico = 'montando_pasta'
WHERE status_servico IN ('aguardando_contratacao', 'contratado');

-- 2) CHECK constraint com APENAS os 15 status novos
ALTER TABLE public.qa_solicitacoes_servico
  ADD CONSTRAINT chk_qa_status_servico_v2
  CHECK (status_servico IN (
    'montando_pasta',
    'aguardando_documentacao',
    'documentos_em_analise',
    'documentos_incompletos',
    'documentos_aprovados',
    'em_verificacao',
    'pronto_para_protocolo',
    'enviado_ao_orgao',
    'em_analise_orgao',
    'notificado',
    'restituido',
    'recurso_administrativo',
    'deferido',
    'indeferido',
    'finalizado'
  ));

-- 3) Tabela de timeline de eventos
CREATE TABLE IF NOT EXISTS public.qa_solicitacao_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.qa_solicitacoes_servico(id) ON DELETE CASCADE,
  cliente_id UUID,
  evento TEXT NOT NULL,
  status_anterior TEXT,
  status_novo TEXT,
  descricao TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ator TEXT,
  ator_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_solic_eventos_solic ON public.qa_solicitacao_eventos(solicitacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_solic_eventos_cliente ON public.qa_solicitacao_eventos(cliente_id, created_at DESC);

ALTER TABLE public.qa_solicitacao_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read eventos"
  ON public.qa_solicitacao_eventos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated insert eventos"
  ON public.qa_solicitacao_eventos FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Service role manage eventos"
  ON public.qa_solicitacao_eventos FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 4) Trigger de timeline automática em mudança de status
CREATE OR REPLACE FUNCTION public.qa_log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT inicial: registra criação
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.qa_solicitacao_eventos
      (solicitacao_id, cliente_id, evento, status_novo, descricao, ator)
    VALUES
      (NEW.id, NEW.cliente_id, 'solicitacao_criada', NEW.status_servico,
       'Solicitação criada com status ' || NEW.status_servico, 'sistema');
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- UPDATE: só registra se status mudou
  IF TG_OP = 'UPDATE' AND NEW.status_servico IS DISTINCT FROM OLD.status_servico THEN
    INSERT INTO public.qa_solicitacao_eventos
      (solicitacao_id, cliente_id, evento, status_anterior, status_novo, descricao, ator)
    VALUES
      (NEW.id, NEW.cliente_id, 'status_alterado',
       OLD.status_servico, NEW.status_servico,
       'Status alterado de ' || OLD.status_servico || ' para ' || NEW.status_servico,
       'sistema');
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_log_status_change ON public.qa_solicitacoes_servico;
CREATE TRIGGER trg_qa_log_status_change
  BEFORE INSERT OR UPDATE ON public.qa_solicitacoes_servico
  FOR EACH ROW EXECUTE FUNCTION public.qa_log_status_change();