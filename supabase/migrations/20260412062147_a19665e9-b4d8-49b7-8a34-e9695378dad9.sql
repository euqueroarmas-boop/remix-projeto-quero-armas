
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 1. qa_usuarios_perfis
CREATE TABLE public.qa_usuarios_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome text NOT NULL,
  email text NOT NULL,
  perfil text NOT NULL DEFAULT 'leitura_auditoria',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_usuarios_perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_perfis_service" ON public.qa_usuarios_perfis FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_perfis_own_read" ON public.qa_usuarios_perfis FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. qa_documentos_conhecimento
CREATE TABLE public.qa_documentos_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo_documento text NOT NULL DEFAULT 'outro',
  categoria text,
  origem text,
  descricao text,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  hash_arquivo text,
  texto_extraido text,
  resumo_extraido text,
  metadados_json jsonb DEFAULT '{}',
  status_processamento text NOT NULL DEFAULT 'pendente',
  status_validacao text NOT NULL DEFAULT 'nao_validado',
  enviado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_documentos_conhecimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_docs_service" ON public.qa_documentos_conhecimento FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_docs_auth_read" ON public.qa_documentos_conhecimento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));
CREATE POLICY "qa_docs_auth_insert" ON public.qa_documentos_conhecimento FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado','assistente_juridico')));
CREATE POLICY "qa_docs_auth_update" ON public.qa_documentos_conhecimento FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado')));
CREATE INDEX idx_qa_docs_tipo ON public.qa_documentos_conhecimento(tipo_documento);
CREATE INDEX idx_qa_docs_categoria ON public.qa_documentos_conhecimento(categoria);
CREATE INDEX idx_qa_docs_status ON public.qa_documentos_conhecimento(status_processamento);
CREATE INDEX idx_qa_docs_hash ON public.qa_documentos_conhecimento(hash_arquivo);

-- 3. qa_chunks_conhecimento
CREATE TABLE public.qa_chunks_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.qa_documentos_conhecimento(id) ON DELETE CASCADE,
  ordem_chunk integer NOT NULL DEFAULT 0,
  texto_chunk text NOT NULL,
  resumo_chunk text,
  metadados_json jsonb DEFAULT '{}',
  embedding_status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_chunks_conhecimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_chunks_service" ON public.qa_chunks_conhecimento FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_chunks_auth_read" ON public.qa_chunks_conhecimento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));
CREATE INDEX idx_qa_chunks_doc ON public.qa_chunks_conhecimento(documento_id);

-- 4. qa_embeddings
CREATE TABLE public.qa_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid NOT NULL REFERENCES public.qa_chunks_conhecimento(id) ON DELETE CASCADE,
  vetor_embedding vector(1536),
  modelo_embedding text NOT NULL DEFAULT 'text-embedding-3-small',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_embeddings_service" ON public.qa_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_embeddings_auth_read" ON public.qa_embeddings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));
CREATE INDEX idx_qa_embeddings_chunk ON public.qa_embeddings(chunk_id);

-- 5. qa_fontes_normativas
CREATE TABLE public.qa_fontes_normativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_norma text NOT NULL,
  tipo_norma text NOT NULL DEFAULT 'lei',
  numero_norma text,
  ano_norma integer,
  orgao_emissor text,
  data_publicacao date,
  data_vigencia date,
  ementa text,
  texto_integral text,
  palavras_chave text[] DEFAULT '{}',
  origem text,
  hash_conteudo text,
  ativa boolean NOT NULL DEFAULT true,
  revisada_humanamente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_fontes_normativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_normas_service" ON public.qa_fontes_normativas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_normas_auth_read" ON public.qa_fontes_normativas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));
CREATE POLICY "qa_normas_auth_insert" ON public.qa_fontes_normativas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado','assistente_juridico')));
CREATE POLICY "qa_normas_auth_update" ON public.qa_fontes_normativas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado')));
CREATE INDEX idx_qa_normas_tipo ON public.qa_fontes_normativas(tipo_norma);
CREATE INDEX idx_qa_normas_numero ON public.qa_fontes_normativas(numero_norma);
CREATE INDEX idx_qa_normas_palavras ON public.qa_fontes_normativas USING gin(palavras_chave);

-- 6. qa_jurisprudencias
CREATE TABLE public.qa_jurisprudencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribunal text NOT NULL,
  numero_processo text,
  relator text,
  orgao_julgador text,
  data_julgamento date,
  data_publicacao date,
  tema text,
  ementa_resumida text,
  tese_aplicavel text,
  texto_controlado text,
  palavras_chave text[] DEFAULT '{}',
  origem text,
  validada_humanamente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_jurisprudencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_jurisp_service" ON public.qa_jurisprudencias FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_jurisp_auth_read" ON public.qa_jurisprudencias FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));
CREATE POLICY "qa_jurisp_auth_insert" ON public.qa_jurisprudencias FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado','assistente_juridico')));
CREATE POLICY "qa_jurisp_auth_update" ON public.qa_jurisprudencias FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado')));
CREATE INDEX idx_qa_jurisp_tribunal ON public.qa_jurisprudencias(tribunal);
CREATE INDEX idx_qa_jurisp_processo ON public.qa_jurisprudencias(numero_processo);
CREATE INDEX idx_qa_jurisp_tema ON public.qa_jurisprudencias(tema);
CREATE INDEX idx_qa_jurisp_palavras ON public.qa_jurisprudencias USING gin(palavras_chave);

-- 7. qa_modelos_docx
CREATE TABLE public.qa_modelos_docx (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_modelo text NOT NULL,
  tipo_peca text NOT NULL,
  descricao text,
  arquivo_template_path text,
  variaveis_suportadas_json jsonb DEFAULT '[]',
  ativo boolean NOT NULL DEFAULT true,
  versao text NOT NULL DEFAULT '1.0',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_modelos_docx ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_modelos_service" ON public.qa_modelos_docx FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_modelos_auth_read" ON public.qa_modelos_docx FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));
CREATE POLICY "qa_modelos_auth_insert" ON public.qa_modelos_docx FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado')));
CREATE INDEX idx_qa_modelos_tipo ON public.qa_modelos_docx(tipo_peca);

-- 8. qa_consultas_ia
CREATE TABLE public.qa_consultas_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  caso_titulo text,
  caso_resumo text,
  tipo_peca text,
  entrada_usuario text NOT NULL,
  filtros_aplicados_json jsonb DEFAULT '{}',
  fontes_recuperadas_json jsonb DEFAULT '[]',
  resposta_ia text,
  observacoes_ia text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_consultas_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_consultas_service" ON public.qa_consultas_ia FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_consultas_own" ON public.qa_consultas_ia FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "qa_consultas_insert" ON public.qa_consultas_ia FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

-- 9. qa_geracoes_pecas
CREATE TABLE public.qa_geracoes_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  titulo_geracao text NOT NULL,
  tipo_peca text NOT NULL,
  entrada_caso text,
  minuta_gerada text,
  fundamentos_utilizados_json jsonb DEFAULT '[]',
  normas_utilizadas_json jsonb DEFAULT '[]',
  jurisprudencias_utilizadas_json jsonb DEFAULT '[]',
  documentos_referencia_json jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'rascunho',
  versao integer NOT NULL DEFAULT 1,
  docx_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_geracoes_pecas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_geracoes_service" ON public.qa_geracoes_pecas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_geracoes_own" ON public.qa_geracoes_pecas FOR ALL TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- 10. qa_feedback_geracoes
CREATE TABLE public.qa_feedback_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id uuid NOT NULL REFERENCES public.qa_geracoes_pecas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  status_feedback text NOT NULL DEFAULT 'pendente',
  observacoes text,
  correcao_humana text,
  aprovada_como_modelo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_feedback_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_feedback_service" ON public.qa_feedback_geracoes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_feedback_own" ON public.qa_feedback_geracoes FOR ALL TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- 11. qa_logs_auditoria
CREATE TABLE public.qa_logs_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id),
  entidade text NOT NULL,
  entidade_id uuid,
  acao text NOT NULL,
  detalhes_json jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_logs_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_audit_service" ON public.qa_logs_auditoria FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "qa_audit_insert" ON public.qa_logs_auditoria FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "qa_audit_admin_read" ON public.qa_logs_auditoria FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.perfil IN ('administrador','leitura_auditoria') AND p.ativo = true));

-- Similarity search function
CREATE OR REPLACE FUNCTION public.qa_busca_similar(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  chunk_id uuid,
  documento_id uuid,
  texto_chunk text,
  resumo_chunk text,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.chunk_id,
    c.documento_id,
    c.texto_chunk,
    c.resumo_chunk,
    1 - (e.vetor_embedding <=> query_embedding) as similarity
  FROM qa_embeddings e
  JOIN qa_chunks_conhecimento c ON c.id = e.chunk_id
  WHERE 1 - (e.vetor_embedding <=> query_embedding) > match_threshold
  ORDER BY e.vetor_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('qa-documentos', 'qa-documentos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('qa-templates', 'qa-templates', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('qa-geracoes', 'qa-geracoes', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "qa_storage_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('qa-documentos','qa-templates','qa-geracoes')
    AND EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil IN ('administrador','advogado','assistente_juridico')));
CREATE POLICY "qa_storage_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('qa-documentos','qa-templates','qa-geracoes')
    AND EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));
CREATE POLICY "qa_storage_service_qa" ON storage.objects FOR ALL TO service_role
  USING (bucket_id IN ('qa-documentos','qa-templates','qa-geracoes'))
  WITH CHECK (bucket_id IN ('qa-documentos','qa-templates','qa-geracoes'));
