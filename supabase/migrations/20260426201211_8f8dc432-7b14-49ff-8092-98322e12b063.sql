-- =====================================================================
-- ONDA 2 BLOCO A — INTEGRIDADE REFERENCIAL (FINAL)
-- =====================================================================

-- FASE 0: Sequence em qa_itens_venda_orfaos
CREATE SEQUENCE IF NOT EXISTS public.qa_itens_venda_orfaos_id_seq OWNED BY public.qa_itens_venda_orfaos.id;
SELECT setval('public.qa_itens_venda_orfaos_id_seq',
              COALESCE((SELECT MAX(id) FROM public.qa_itens_venda_orfaos), 0) + 1,
              false);
ALTER TABLE public.qa_itens_venda_orfaos
  ALTER COLUMN id SET DEFAULT nextval('public.qa_itens_venda_orfaos_id_seq');

-- =================================================
-- FASE 1: LIMPEZA
-- =================================================

-- 1a) Itens de venda órfãos (venda_id inexistente) → arquivar e remover
INSERT INTO public.qa_itens_venda_orfaos (payload, motivo)
SELECT to_jsonb(i.*),
       'fk_audit_2026_04_26: venda_id ' || i.venda_id || ' inexistente'
FROM public.qa_itens_venda i
WHERE i.venda_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_vendas v WHERE v.id = i.venda_id);

DELETE FROM public.qa_itens_venda
WHERE venda_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_vendas v WHERE v.id = qa_itens_venda.venda_id);

-- 1b) Venda 122 (cliente excluído LGPD) — arquivar itens e venda
INSERT INTO public.qa_itens_venda_orfaos (payload, motivo)
SELECT to_jsonb(i.*),
       'fk_audit_2026_04_26: item da venda 122 (cliente excluído LGPD)'
FROM public.qa_itens_venda i WHERE i.venda_id = 122;

DELETE FROM public.qa_itens_venda WHERE venda_id = 122;

INSERT INTO public.qa_itens_venda_orfaos (payload, motivo)
SELECT to_jsonb(v.*),
       'fk_audit_2026_04_26: venda 122 cliente_id 98 excluído LGPD'
FROM public.qa_vendas v WHERE v.id = 122;

DELETE FROM public.qa_vendas WHERE id = 122;

-- 1c) Itens com serviço inexistente → anular servico_id (preserva o item)
UPDATE public.qa_itens_venda
SET servico_id = NULL
WHERE servico_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_servicos s WHERE s.id = qa_itens_venda.servico_id);

-- 1d) Senha Gov — desativar trigger temporariamente para limpeza autorizada
ALTER TABLE public.qa_senha_gov_acessos DISABLE TRIGGER USER;
UPDATE public.qa_senha_gov_acessos
SET cliente_id = NULL
WHERE cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_clientes c WHERE c.id = qa_senha_gov_acessos.cliente_id);
ALTER TABLE public.qa_senha_gov_acessos ENABLE TRIGGER USER;

-- 1e) Mesclar customers duplicados
DO $$
DECLARE
  v_keep uuid := '99b93c93-b1ad-4f04-b9b6-74bb14441f2c';
  v_drop uuid := '64936a44-d1b0-4573-ab04-75986118614b';
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='qa_clientes' AND column_name='customer_id') THEN
    UPDATE public.qa_clientes SET customer_id = v_keep WHERE customer_id = v_drop;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='qa_documentos_cliente' AND column_name='customer_id') THEN
    UPDATE public.qa_documentos_cliente SET customer_id = v_keep WHERE customer_id = v_drop;
  END IF;
  UPDATE public.contracts SET customer_id = v_keep WHERE customer_id = v_drop;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cliente_acesso_logs' AND column_name='customer_id') THEN
    UPDATE public.cliente_acesso_logs SET customer_id = v_keep WHERE customer_id = v_drop;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cliente_otp_codes' AND column_name='customer_id') THEN
    UPDATE public.cliente_otp_codes SET customer_id = v_keep WHERE customer_id = v_drop;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='asaas_customer_map' AND column_name='customer_id') THEN
    UPDATE public.asaas_customer_map SET customer_id = v_keep WHERE customer_id = v_drop;
  END IF;
  DELETE FROM public.customers WHERE id = v_drop;
END $$;

-- =================================================
-- FASE 2: FOREIGN KEYS
-- =================================================
ALTER TABLE public.qa_itens_venda
  ADD CONSTRAINT fk_qa_itens_venda__venda
    FOREIGN KEY (venda_id) REFERENCES public.qa_vendas(id) ON DELETE SET NULL;
ALTER TABLE public.qa_itens_venda
  ADD CONSTRAINT fk_qa_itens_venda__servico
    FOREIGN KEY (servico_id) REFERENCES public.qa_servicos(id) ON DELETE SET NULL;

ALTER TABLE public.qa_vendas
  ADD CONSTRAINT fk_qa_vendas__cliente
    FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.qa_casos
  ADD CONSTRAINT fk_qa_casos__cliente
    FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.qa_crafs
  ADD CONSTRAINT fk_qa_crafs__cliente
    FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE CASCADE;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT fk_qa_doc_cliente__qa_cliente
    FOREIGN KEY (qa_cliente_id) REFERENCES public.qa_clientes(id) ON DELETE CASCADE;

ALTER TABLE public.qa_filiacoes
  ADD CONSTRAINT fk_qa_filiacoes__cliente
    FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE CASCADE;

ALTER TABLE public.qa_senha_gov_acessos
  ADD CONSTRAINT fk_qa_senha_gov__cliente
    FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.qa_exames_cliente
  ADD CONSTRAINT fk_qa_exames__cliente
    FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE CASCADE;

ALTER TABLE public.cliente_auth_links
  ADD CONSTRAINT fk_cliente_auth_links__qa_cliente
    FOREIGN KEY (qa_cliente_id) REFERENCES public.qa_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.qa_chunks_conhecimento
  ADD CONSTRAINT fk_qa_chunks__documento
    FOREIGN KEY (documento_id) REFERENCES public.qa_documentos_conhecimento(id) ON DELETE CASCADE;

ALTER TABLE public.qa_embeddings
  ADD CONSTRAINT fk_qa_embeddings__chunk
    FOREIGN KEY (chunk_id) REFERENCES public.qa_chunks_conhecimento(id) ON DELETE CASCADE;

ALTER TABLE public.lp_order_items
  ADD CONSTRAINT fk_lp_order_items__order
    FOREIGN KEY (order_id) REFERENCES public.lp_orders(id) ON DELETE CASCADE;

ALTER TABLE public.lp_contracts
  ADD CONSTRAINT fk_lp_contracts__order
    FOREIGN KEY (order_id) REFERENCES public.lp_orders(id) ON DELETE SET NULL;

ALTER TABLE public.contracts
  ADD CONSTRAINT fk_contracts__customer
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.contracts
  ADD CONSTRAINT fk_contracts__quote
    FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;

-- =================================================
-- FASE 3: UNIQUE INDEXES
-- =================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_customers_email_lower
  ON public.customers (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customers_doc_digits
  ON public.customers (regexp_replace(cnpj_ou_cpf, '\D', '', 'g'))
  WHERE cnpj_ou_cpf IS NOT NULL AND cnpj_ou_cpf <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_qa_clientes_cpf_ativo
  ON public.qa_clientes (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '' AND COALESCE(excluido, false) = false;