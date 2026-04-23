-- Tabela de documentos enviados pelo próprio cliente
CREATE TABLE IF NOT EXISTS public.qa_documentos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  qa_cliente_id integer NULL REFERENCES public.qa_clientes(id) ON DELETE SET NULL,
  
  tipo_documento text NOT NULL,
  -- Aceitos: cr | craf | sinarm | gt | gte | autorizacao_compra | outro
  
  numero_documento text NULL,
  orgao_emissor text NULL,
  data_emissao date NULL,
  data_validade date NULL,
  observacoes text NULL,

  -- Específicos para arma (CRAF/SINARM/AC/GT/GTE)
  arma_marca text NULL,
  arma_modelo text NULL,
  arma_calibre text NULL,
  arma_numero_serie text NULL,
  arma_especie text NULL,

  -- Anexo
  arquivo_storage_path text NULL,
  arquivo_nome text NULL,
  arquivo_mime text NULL,

  -- IA
  ia_status text NOT NULL DEFAULT 'nao_processado',
  -- nao_processado | processando | sugerido | falhou
  ia_dados_extraidos jsonb NULL,
  ia_processado_em timestamptz NULL,

  -- Validação interna
  validado_admin boolean NOT NULL DEFAULT false,
  validado_por text NULL,
  validado_em timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_doc_cliente_customer ON public.qa_documentos_cliente(customer_id);
CREATE INDEX IF NOT EXISTS idx_qa_doc_cliente_qa_cliente ON public.qa_documentos_cliente(qa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_doc_cliente_tipo ON public.qa_documentos_cliente(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_qa_doc_cliente_validade ON public.qa_documentos_cliente(data_validade);

-- Constraint de tipo
ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;
ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check
  CHECK (tipo_documento IN ('cr','craf','sinarm','gt','gte','autorizacao_compra','outro'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.qa_doc_cliente_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_doc_cliente_updated_at ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_doc_cliente_updated_at
  BEFORE UPDATE ON public.qa_documentos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.qa_doc_cliente_set_updated_at();

-- RLS
ALTER TABLE public.qa_documentos_cliente ENABLE ROW LEVEL SECURITY;

-- Cliente: acessa apenas documentos vinculados ao seu próprio customer
CREATE POLICY "client_select_own_docs"
  ON public.qa_documentos_cliente
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

CREATE POLICY "client_insert_own_docs"
  ON public.qa_documentos_cliente
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

CREATE POLICY "client_update_own_docs"
  ON public.qa_documentos_cliente
  FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

CREATE POLICY "client_delete_own_docs"
  ON public.qa_documentos_cliente
  FOR DELETE
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

-- Painel admin (anon e service): acesso total para gestão e validação
CREATE POLICY "anon_full_qa_doc_cliente"
  ON public.qa_documentos_cliente
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Storage policies para documentos do cliente no bucket qa-documentos
-- Cliente pode ler/escrever arquivos na pasta cliente-docs/{customer_id}/
CREATE POLICY "client_select_own_docs_storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'qa-documentos'
    AND (storage.foldername(name))[1] = 'cliente-docs'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "client_insert_own_docs_storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'qa-documentos'
    AND (storage.foldername(name))[1] = 'cliente-docs'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "client_delete_own_docs_storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'qa-documentos'
    AND (storage.foldername(name))[1] = 'cliente-docs'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.customers WHERE user_id = auth.uid()
    )
  );