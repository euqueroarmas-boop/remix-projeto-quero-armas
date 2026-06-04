-- =============================================================================
-- FASE 1: CENTRAL DE DOCUMENTOS DO PROCESSO — ESTRUTURA DE BANCO
-- =============================================================================

-- 1) Novo serviço unificado (preserva ids 5 e 15 como histórico)
INSERT INTO public.qa_servicos (nome_servico, valor_servico, is_combo)
SELECT 'Autorização de Compra/Posse de Arma de Fogo para Defesa Pessoal', 750, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_servicos
  WHERE nome_servico = 'Autorização de Compra/Posse de Arma de Fogo para Defesa Pessoal'
);

-- =============================================================================
-- 2) TABELA: qa_processos
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.qa_processos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id         integer NOT NULL,
  servico_id         integer REFERENCES public.qa_servicos(id) ON DELETE SET NULL,
  servico_nome       text NOT NULL,
  venda_id           integer,
  pagamento_id       text,
  pagamento_status   text NOT NULL DEFAULT 'aguardando',
  status             text NOT NULL DEFAULT 'aguardando_pagamento',
  observacoes_admin  text,
  data_criacao       timestamptz NOT NULL DEFAULT now(),
  data_validacao     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_qa_processos_status CHECK (status IN (
    'aguardando_pagamento','aguardando_documentos','em_validacao',
    'pendente_cliente','revisao_humana','validado','bloqueado','cancelado'
  )),
  CONSTRAINT chk_qa_processos_pagamento_status CHECK (pagamento_status IN (
    'aguardando','confirmado','falhou','reembolsado','cancelado'
  ))
);

CREATE INDEX IF NOT EXISTS idx_qa_processos_cliente ON public.qa_processos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_processos_status  ON public.qa_processos(status);
CREATE INDEX IF NOT EXISTS idx_qa_processos_servico ON public.qa_processos(servico_id);
CREATE INDEX IF NOT EXISTS idx_qa_processos_pagamento ON public.qa_processos(pagamento_id);

ALTER TABLE public.qa_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_processos_staff_all" ON public.qa_processos
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_processos_cliente_select" ON public.qa_processos
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

-- =============================================================================
-- 3) TABELA: qa_processo_documentos
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.qa_processo_documentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id         uuid NOT NULL REFERENCES public.qa_processos(id) ON DELETE CASCADE,
  cliente_id          integer NOT NULL,
  tipo_documento      text NOT NULL,
  nome_documento      text NOT NULL,
  etapa               text NOT NULL DEFAULT 'base',
  status              text NOT NULL DEFAULT 'pendente',
  obrigatorio         boolean NOT NULL DEFAULT true,
  arquivo_url         text,
  arquivo_storage_key text,
  motivo_rejeicao     text,
  dados_extraidos_json jsonb,
  divergencias_json   jsonb,
  data_envio          timestamptz,
  data_validacao      timestamptz,
  revisado_por        uuid,
  observacoes         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_qa_processo_doc_status CHECK (status IN (
    'pendente','enviado','em_analise','aprovado','invalido','divergente','revisao_humana'
  )),
  CONSTRAINT chk_qa_processo_doc_etapa CHECK (etapa IN (
    'base','complementar','tecnico','final'
  ))
);

CREATE INDEX IF NOT EXISTS idx_qa_processo_doc_processo ON public.qa_processo_documentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_qa_processo_doc_cliente  ON public.qa_processo_documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_processo_doc_status   ON public.qa_processo_documentos(status);
CREATE INDEX IF NOT EXISTS idx_qa_processo_doc_tipo     ON public.qa_processo_documentos(tipo_documento);

ALTER TABLE public.qa_processo_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_processo_doc_staff_all" ON public.qa_processo_documentos
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_processo_doc_cliente_select" ON public.qa_processo_documentos
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

CREATE POLICY "qa_processo_doc_cliente_insert" ON public.qa_processo_documentos
  FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

CREATE POLICY "qa_processo_doc_cliente_update" ON public.qa_processo_documentos
  FOR UPDATE TO authenticated
  USING (
    cliente_id = public.qa_current_cliente_id(auth.uid())
    AND status IN ('pendente','enviado','invalido','divergente')
  )
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

-- =============================================================================
-- 4) TABELA: qa_document_examples
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.qa_document_examples (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento  text NOT NULL,
  servico_id      integer REFERENCES public.qa_servicos(id) ON DELETE SET NULL,
  arquivo_url     text NOT NULL,
  descricao       text,
  exemplo_valido  boolean NOT NULL DEFAULT true,
  observacoes     text,
  criado_por      uuid,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_doc_examples_tipo ON public.qa_document_examples(tipo_documento);

ALTER TABLE public.qa_document_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_doc_examples_staff_all" ON public.qa_document_examples
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_doc_examples_auth_select" ON public.qa_document_examples
  FOR SELECT TO authenticated
  USING (ativo = true);

-- =============================================================================
-- 5) TABELA: qa_document_external_links
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.qa_document_external_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento  text NOT NULL,
  nome_botao      text NOT NULL,
  descricao       text,
  url             text NOT NULL,
  categoria       text,
  ativo           boolean NOT NULL DEFAULT true,
  ordem           integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_doc_links_tipo_unique
  ON public.qa_document_external_links(tipo_documento)
  WHERE ativo = true;

ALTER TABLE public.qa_document_external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_doc_links_staff_all" ON public.qa_document_external_links
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_doc_links_auth_select" ON public.qa_document_external_links
  FOR SELECT TO authenticated
  USING (ativo = true);

-- =============================================================================
-- 6) TABELA: qa_processo_eventos (auditoria imutável)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.qa_processo_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id   uuid NOT NULL REFERENCES public.qa_processos(id) ON DELETE CASCADE,
  documento_id  uuid REFERENCES public.qa_processo_documentos(id) ON DELETE SET NULL,
  tipo_evento   text NOT NULL,
  descricao     text,
  dados_json    jsonb,
  ator          text,
  user_id       uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_processo_eventos_processo ON public.qa_processo_eventos(processo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_processo_eventos_tipo     ON public.qa_processo_eventos(tipo_evento);

ALTER TABLE public.qa_processo_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_processo_eventos_staff_select" ON public.qa_processo_eventos
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_processo_eventos_staff_insert" ON public.qa_processo_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_processo_eventos_cliente_select" ON public.qa_processo_eventos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qa_processos p
      WHERE p.id = qa_processo_eventos.processo_id
        AND p.cliente_id = public.qa_current_cliente_id(auth.uid())
    )
  );

-- Eventos são imutáveis (sem UPDATE/DELETE)
CREATE OR REPLACE FUNCTION public.qa_processo_eventos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'qa_processo_eventos é imutável (operação % bloqueada).', TG_OP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_processo_eventos_imut_upd ON public.qa_processo_eventos;
CREATE TRIGGER trg_qa_processo_eventos_imut_upd
  BEFORE UPDATE OR DELETE ON public.qa_processo_eventos
  FOR EACH ROW EXECUTE FUNCTION public.qa_processo_eventos_imutavel();

-- =============================================================================
-- 7) TRIGGERS: updated_at e auditoria de status
-- =============================================================================
CREATE OR REPLACE FUNCTION public.qa_processos_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_processos_updated_at ON public.qa_processos;
CREATE TRIGGER trg_qa_processos_updated_at
  BEFORE UPDATE ON public.qa_processos
  FOR EACH ROW EXECUTE FUNCTION public.qa_processos_set_updated_at();

DROP TRIGGER IF EXISTS trg_qa_processo_doc_updated_at ON public.qa_processo_documentos;
CREATE TRIGGER trg_qa_processo_doc_updated_at
  BEFORE UPDATE ON public.qa_processo_documentos
  FOR EACH ROW EXECUTE FUNCTION public.qa_processos_set_updated_at();

DROP TRIGGER IF EXISTS trg_qa_doc_examples_updated_at ON public.qa_document_examples;
CREATE TRIGGER trg_qa_doc_examples_updated_at
  BEFORE UPDATE ON public.qa_document_examples
  FOR EACH ROW EXECUTE FUNCTION public.qa_processos_set_updated_at();

DROP TRIGGER IF EXISTS trg_qa_doc_links_updated_at ON public.qa_document_external_links;
CREATE TRIGGER trg_qa_doc_links_updated_at
  BEFORE UPDATE ON public.qa_document_external_links
  FOR EACH ROW EXECUTE FUNCTION public.qa_processos_set_updated_at();

-- Trigger: registra evento ao mudar status do processo
CREATE OR REPLACE FUNCTION public.qa_processos_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator, user_id)
    VALUES (NEW.id, 'processo_criado', 'Processo criado',
            jsonb_build_object('status', NEW.status, 'servico_id', NEW.servico_id),
            'sistema', auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator, user_id)
    VALUES (NEW.id, 'status_alterado',
            'Status: ' || OLD.status || ' → ' || NEW.status,
            jsonb_build_object('de', OLD.status, 'para', NEW.status),
            CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'usuario' END,
            auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_processos_log_status ON public.qa_processos;
CREATE TRIGGER trg_qa_processos_log_status
  AFTER INSERT OR UPDATE ON public.qa_processos
  FOR EACH ROW EXECUTE FUNCTION public.qa_processos_log_status_change();

-- Trigger: registra evento ao mudar status de documento
CREATE OR REPLACE FUNCTION public.qa_processo_doc_log_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.qa_processo_eventos (processo_id, documento_id, tipo_evento, descricao, dados_json, user_id)
    VALUES (NEW.processo_id, NEW.id, 'documento_criado',
            NEW.nome_documento || ' (' || NEW.status || ')',
            jsonb_build_object('tipo', NEW.tipo_documento, 'etapa', NEW.etapa, 'status', NEW.status),
            auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.qa_processo_eventos (processo_id, documento_id, tipo_evento, descricao, dados_json, user_id)
    VALUES (NEW.processo_id, NEW.id, 'documento_status_alterado',
            NEW.nome_documento || ': ' || OLD.status || ' → ' || NEW.status,
            jsonb_build_object('de', OLD.status, 'para', NEW.status, 'motivo', NEW.motivo_rejeicao),
            auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_processo_doc_log_status ON public.qa_processo_documentos;
CREATE TRIGGER trg_qa_processo_doc_log_status
  AFTER INSERT OR UPDATE ON public.qa_processo_documentos
  FOR EACH ROW EXECUTE FUNCTION public.qa_processo_doc_log_status();

-- =============================================================================
-- 8) STORAGE BUCKET (privado)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-processo-docs', 'qa-processo-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Staff: acesso total
CREATE POLICY "qa_processo_docs_staff_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'qa-processo-docs' AND public.qa_is_active_staff(auth.uid()))
  WITH CHECK (bucket_id = 'qa-processo-docs' AND public.qa_is_active_staff(auth.uid()));

-- Cliente: pode ler/inserir/atualizar arquivos dentro de pastas com seu cliente_id
CREATE POLICY "qa_processo_docs_cliente_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'qa-processo-docs'
    AND (storage.foldername(name))[1] = public.qa_current_cliente_id(auth.uid())::text
  );

CREATE POLICY "qa_processo_docs_cliente_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'qa-processo-docs'
    AND (storage.foldername(name))[1] = public.qa_current_cliente_id(auth.uid())::text
  );

CREATE POLICY "qa_processo_docs_cliente_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'qa-processo-docs'
    AND (storage.foldername(name))[1] = public.qa_current_cliente_id(auth.uid())::text
  );

-- =============================================================================
-- 9) SEEDS — 8 LINKS OFICIAIS DE CERTIDÕES
-- =============================================================================
INSERT INTO public.qa_document_external_links (tipo_documento, nome_botao, descricao, url, categoria, ordem)
VALUES
  ('certidao_crimes_eleitorais',
   'Emitir Certidão de Crimes Eleitorais',
   'Certidão Negativa de Crimes Eleitorais (TSE)',
   'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/',
   'certidao_federal', 1),
  ('certidao_crimes_militares',
   'Emitir Certidão de Crimes Militares',
   'Certidão Negativa de Crimes Militares (STM)',
   'https://www.stm.jus.br/servicos-ao-cidadao/atendimentoaocidadao/certidao-negativa?view=default',
   'certidao_federal', 2),
  ('certidao_federal_trf3_regional',
   'Emitir Certidão Federal Regional',
   'Certidão Federal TRF3 - Abrangência Regional',
   'https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao',
   'certidao_federal', 3),
  ('certidao_federal_trf3_sjsp',
   'Emitir Certidão Federal da Seção Judiciária de São Paulo',
   'Certidão Federal TRF3 - Seção Judiciária e Juizado Especial Federal de São Paulo',
   'https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao',
   'certidao_federal', 4),
  ('certidao_estadual_tjsp_execucoes',
   'Emitir Certidão de Execuções Criminais',
   'Certidão Estadual TJSP - Execuções Criminais',
   'https://esaj.tjsp.jus.br/sco/abrirCadastro.do',
   'certidao_estadual', 5),
  ('certidao_estadual_tjsp_distribuicao',
   'Emitir Certidão de Distribuição Criminal',
   'Certidão Estadual TJSP - Distribuição de Ações Criminais',
   'https://esaj.tjsp.jus.br/sco/abrirCadastro.do',
   'certidao_estadual', 6),
  ('certidao_policia_civil_sp',
   'Emitir Certidão de Antecedentes da Polícia Civil',
   'Certidão de Antecedentes da Polícia Civil de São Paulo',
   'https://servicos.sp.gov.br/fcarta/259d189e-dc87-4308-9812-7abed7494412',
   'certidao_estadual', 7),
  ('certidao_tjm_sp',
   'Emitir Certidão da Justiça Militar Estadual',
   'Certidão Criminal do Tribunal de Justiça Militar do Estado de São Paulo',
   'https://certidaocriminal.tjmsp.jus.br',
   'certidao_estadual', 8)
ON CONFLICT DO NOTHING;
