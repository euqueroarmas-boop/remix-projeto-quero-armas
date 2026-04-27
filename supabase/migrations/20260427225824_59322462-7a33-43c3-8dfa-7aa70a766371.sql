-- 1) Novas colunas
ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS validade_dias integer,
  ADD COLUMN IF NOT EXISTS formato_aceito text[] NOT NULL DEFAULT ARRAY['pdf','jpg','jpeg','png']::text[],
  ADD COLUMN IF NOT EXISTS regra_validacao jsonb,
  ADD COLUMN IF NOT EXISTS link_emissao text,
  ADD COLUMN IF NOT EXISTS data_validade date;

-- 2) Migrar 'certidoes_negativas' legado em 5 certidões granulares
DO $$
DECLARE
  r record;
BEGIN
  -- suspende triggers para o cleanup determinístico (apenas neste bloco)
  ALTER TABLE public.qa_processo_eventos DISABLE TRIGGER USER;
  ALTER TABLE public.qa_processo_documentos DISABLE TRIGGER USER;

  FOR r IN
    SELECT id, processo_id, cliente_id
    FROM public.qa_processo_documentos
    WHERE tipo_documento = 'certidoes_negativas'
  LOOP
    INSERT INTO public.qa_processo_documentos
      (processo_id, cliente_id, tipo_documento, nome_documento, etapa, obrigatorio, status, validade_dias)
    SELECT r.processo_id, r.cliente_id, t.tipo, t.nome, 'complementar', true, 'pendente', NULL
    FROM (VALUES
      ('certidao_civel',             'Certidão Cível Federal'),
      ('certidao_criminal_federal',  'Certidão Criminal Federal'),
      ('certidao_criminal_estadual', 'Certidão Criminal Estadual'),
      ('certidao_militar',           'Certidão da Justiça Militar'),
      ('certidao_eleitoral',         'Certidão da Justiça Eleitoral')
    ) AS t(tipo, nome)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.qa_processo_documentos d2
      WHERE d2.processo_id = r.processo_id AND d2.tipo_documento = t.tipo
    );

    -- desliga FK do evento histórico (preserva o evento, sem violar imutabilidade funcional)
    UPDATE public.qa_processo_eventos SET documento_id = NULL WHERE documento_id = r.id;

    DELETE FROM public.qa_processo_documentos WHERE id = r.id;

    -- registra evento de migração (após o delete)
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator, dados_json)
    VALUES (r.processo_id, 'checklist_corrigido',
            'Item agregador certidoes_negativas substituído por 5 certidões individuais.',
            'sistema', jsonb_build_object('item_removido', r.id));
  END LOOP;

  ALTER TABLE public.qa_processo_documentos ENABLE TRIGGER USER;
  ALTER TABLE public.qa_processo_eventos ENABLE TRIGGER USER;
END$$;

-- 3) Índice
CREATE INDEX IF NOT EXISTS idx_qa_processo_doc_proc_tipo
  ON public.qa_processo_documentos (processo_id, tipo_documento);

-- 4) Constraints de status (idempotente, exatamente o padrão pedido)
ALTER TABLE public.qa_processos DROP CONSTRAINT IF EXISTS chk_qa_processos_status;
ALTER TABLE public.qa_processos ADD CONSTRAINT chk_qa_processos_status
  CHECK (status = ANY (ARRAY[
    'aguardando_pagamento','aguardando_documentos','em_validacao',
    'pendente_cliente','revisao_humana','validado','bloqueado','cancelado'
  ]));

ALTER TABLE public.qa_processo_documentos DROP CONSTRAINT IF EXISTS chk_qa_processo_doc_status;
ALTER TABLE public.qa_processo_documentos ADD CONSTRAINT chk_qa_processo_doc_status
  CHECK (status = ANY (ARRAY[
    'pendente','enviado','em_analise','aprovado','invalido','divergente','revisao_humana'
  ]));