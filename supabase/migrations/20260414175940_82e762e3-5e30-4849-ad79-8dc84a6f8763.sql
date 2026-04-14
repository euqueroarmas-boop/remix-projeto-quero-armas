-- Indexes for FK columns used in WHERE clauses for qa_vendas, qa_crafs, qa_gtes, qa_filiacoes, qa_cadastro_cr, qa_itens_venda
CREATE INDEX IF NOT EXISTS idx_qa_vendas_cliente_id ON public.qa_vendas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_crafs_cliente_id ON public.qa_crafs (cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_gtes_cliente_id ON public.qa_gtes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_filiacoes_cliente_id ON public.qa_filiacoes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_cadastro_cr_cliente_id ON public.qa_cadastro_cr (cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_itens_venda_venda_id ON public.qa_itens_venda (venda_id);

-- Index for qa_clientes ordering
CREATE INDEX IF NOT EXISTS idx_qa_clientes_nome ON public.qa_clientes (nome_completo);

-- Indexes for qa_geracoes_pecas used in dashboard
CREATE INDEX IF NOT EXISTS idx_qa_geracoes_pecas_status ON public.qa_geracoes_pecas (status_revisao);
CREATE INDEX IF NOT EXISTS idx_qa_geracoes_pecas_created ON public.qa_geracoes_pecas (created_at DESC);

-- Indexes for qa_documentos_conhecimento used in dashboard  
CREATE INDEX IF NOT EXISTS idx_qa_docs_ativo ON public.qa_documentos_conhecimento (ativo);
CREATE INDEX IF NOT EXISTS idx_qa_docs_validacao ON public.qa_documentos_conhecimento (status_validacao) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_qa_docs_processamento ON public.qa_documentos_conhecimento (status_processamento) WHERE ativo = true;