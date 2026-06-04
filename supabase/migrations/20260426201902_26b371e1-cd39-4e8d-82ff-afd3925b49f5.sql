-- ONDA 3: NOT NULL + CHECK constraints
ALTER TABLE public.qa_itens_venda 
  ALTER COLUMN venda_id SET NOT NULL,
  ALTER COLUMN valor SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.qa_vendas
  ALTER COLUMN cliente_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.customers
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN cnpj_ou_cpf SET NOT NULL;

ALTER TABLE public.contracts
  ALTER COLUMN customer_id SET NOT NULL;

ALTER TABLE public.lp_contracts
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN order_id SET NOT NULL;

ALTER TABLE public.lp_order_items
  ALTER COLUMN order_id SET NOT NULL;

ALTER TABLE public.cliente_auth_links
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.qa_vendas
  ADD CONSTRAINT chk_qa_vendas_status CHECK (
    UPPER(btrim(status)) IN (
      'PAGO','NÃO PAGOU','NAO PAGOU','FALT. PARTE PAG.','DESISTIU',
      'INDEFERIDO','DEFERIDO','MONTANDO PASTA','AGUARDANDO DOCUMENTOS DO CLIENTE',
      'EM ANÁLISE','EM ANALISE','PRONTO PARA ANÁLISE','PRONTO PARA ANALISE',
      'CANCELADO','RESTITUÍDO','RESTITUIDO','CONCLUÍDO','CONCLUIDO',
      'À INICIAR','A INICIAR','À FAZER','A FAZER',
      'AGUARD. ETAPA ANTERIOR','RECURSO ADMINISTRATIVO',
      'AGUARDANDO DOCUMENTAÇÃO','AGUARDANDO DOCUMENTACAO'
    )
  );

ALTER TABLE public.qa_itens_venda
  ADD CONSTRAINT chk_qa_itens_venda_status CHECK (
    UPPER(btrim(status)) IN (
      'PAGO','NÃO PAGOU','NAO PAGOU','FALT. PARTE PAG.','DESISTIU',
      'INDEFERIDO','DEFERIDO','MONTANDO PASTA','AGUARDANDO DOCUMENTOS DO CLIENTE',
      'EM ANÁLISE','EM ANALISE','PRONTO PARA ANÁLISE','PRONTO PARA ANALISE',
      'CANCELADO','RESTITUÍDO','RESTITUIDO','CONCLUÍDO','CONCLUIDO',
      'À INICIAR','A INICIAR','À FAZER','A FAZER',
      'AGUARD. ETAPA ANTERIOR','RECURSO ADMINISTRATIVO',
      'AGUARDANDO DOCUMENTAÇÃO','AGUARDANDO DOCUMENTACAO'
    )
  );

ALTER TABLE public.contracts
  ADD CONSTRAINT chk_contracts_status CHECK (
    status IS NULL OR status IN (
      'draft','pending','active','suspended','cancelled','expired',
      'contract_generated','payment_pending','payment_confirmed','provisioned'
    )
  );

ALTER TABLE public.qa_itens_venda
  ADD CONSTRAINT chk_qa_itens_venda_valor_nonneg CHECK (valor >= 0);

ALTER TABLE public.qa_servicos
  ADD CONSTRAINT chk_qa_servicos_valor_nonneg CHECK (valor_servico IS NULL OR valor_servico >= 0);

ALTER TABLE public.contracts
  ADD CONSTRAINT chk_contracts_monthly_value_nonneg CHECK (monthly_value IS NULL OR monthly_value >= 0);

ALTER TABLE public.customers
  ADD CONSTRAINT chk_customers_email_format CHECK (
    email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
  );

ALTER TABLE public.qa_clientes
  ADD CONSTRAINT chk_qa_clientes_email_format CHECK (
    email IS NULL OR email = '' OR
    email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
  );

COMMENT ON CONSTRAINT chk_qa_vendas_status ON public.qa_vendas IS
  'Onda 3: status de vendas restrito ao vocabulário operacional aprovado.';
COMMENT ON CONSTRAINT chk_qa_itens_venda_valor_nonneg ON public.qa_itens_venda IS
  'Onda 3: impede valores negativos em itens de venda.';