-- ============================================================
-- qa_gte_documentos — documentos completos de GTE com extração IA
-- Política Zero Regressão: NÃO altera qa_gtes existente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.qa_gte_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL,

  -- Arquivo
  storage_path text NOT NULL,
  nome_original text,
  mime_type text,
  tamanho_bytes bigint,

  -- Origem
  origem_envio text NOT NULL DEFAULT 'cliente' CHECK (origem_envio IN ('cliente','equipe')),
  enviado_por uuid,

  -- Dados extraídos da GTE
  numero_gte text,
  orgao_emissor text,
  requerente_nome text,
  requerente_cpf text,
  data_emissao date,
  data_validade date,
  endereco_origem text,
  endereco_destino text,

  -- Totais agregados
  armas_total integer NOT NULL DEFAULT 0,
  enderecos_total integer NOT NULL DEFAULT 0,

  -- Listas estruturadas
  armas_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  enderecos_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  clubes_json jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Auditoria de extração (todos os dados crus que a IA retornou)
  dados_extraidos_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes_ia text,

  -- Estado do processamento
  status_processamento text NOT NULL DEFAULT 'pendente'
    CHECK (status_processamento IN ('pendente','processando','concluido','erro')),
  erro_mensagem text,
  processado_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_gte_documentos_cliente ON public.qa_gte_documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_gte_documentos_validade ON public.qa_gte_documentos(data_validade);
CREATE INDEX IF NOT EXISTS idx_qa_gte_documentos_status ON public.qa_gte_documentos(status_processamento);

-- updated_at trigger (reusa função pública padrão se existir; senão cria)
CREATE OR REPLACE FUNCTION public.qa_gte_documentos_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_gte_documentos_updated_at ON public.qa_gte_documentos;
CREATE TRIGGER trg_qa_gte_documentos_updated_at
  BEFORE UPDATE ON public.qa_gte_documentos
  FOR EACH ROW EXECUTE FUNCTION public.qa_gte_documentos_set_updated_at();

ALTER TABLE public.qa_gte_documentos ENABLE ROW LEVEL SECURITY;

-- Cliente vê apenas suas GTEs
CREATE POLICY "qa_gte_doc_owner_select"
  ON public.qa_gte_documentos FOR SELECT
  TO authenticated
  USING (cliente_id = qa_current_cliente_id(auth.uid()));

-- Equipe interna vê tudo
CREATE POLICY "qa_gte_doc_staff_select"
  ON public.qa_gte_documentos FOR SELECT
  TO authenticated
  USING (qa_is_active_staff(auth.uid()));

-- Cliente pode inserir GTE do próprio cadastro
CREATE POLICY "qa_gte_doc_owner_insert"
  ON public.qa_gte_documentos FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = qa_current_cliente_id(auth.uid()));

-- Equipe pode inserir/atualizar
CREATE POLICY "qa_gte_doc_staff_insert"
  ON public.qa_gte_documentos FOR INSERT
  TO authenticated
  WITH CHECK (qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_gte_doc_staff_update"
  ON public.qa_gte_documentos FOR UPDATE
  TO authenticated
  USING (qa_is_active_staff(auth.uid()))
  WITH CHECK (qa_is_active_staff(auth.uid()));

-- Apenas admin exclui
CREATE POLICY "qa_gte_doc_admin_delete"
  ON public.qa_gte_documentos FOR DELETE
  TO authenticated
  USING (qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));