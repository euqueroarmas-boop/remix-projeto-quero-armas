CREATE TABLE IF NOT EXISTS public.qa_config_substituicoes_pessoais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto_original text NOT NULL,
  placeholder text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_qa_subst_texto UNIQUE (texto_original)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_config_substituicoes_pessoais TO authenticated;
GRANT ALL ON public.qa_config_substituicoes_pessoais TO service_role;

ALTER TABLE public.qa_config_substituicoes_pessoais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_subst_admin_all ON public.qa_config_substituicoes_pessoais;
CREATE POLICY qa_subst_admin_all ON public.qa_config_substituicoes_pessoais
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil = 'administrador')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil = 'administrador')
  );

INSERT INTO public.qa_config_substituicoes_pessoais (texto_original, placeholder, descricao)
VALUES
  ('Willian Massaroto',        '{{empresa_representante}}',      'Nome do sócio-administrador'),
  ('QUERO ARMAS LTDA',         '{{empresa_razao_social}}',       'Razão social da empresa'),
  ('CNPJ 00.000.000/0001-00',  '{{empresa_cnpj_completo}}',      'CNPJ formatado'),
  ('CNPJ: 00.000.000/0001-00', '{{empresa_cnpj_completo}}',      'CNPJ variação')
ON CONFLICT (texto_original) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.qa_procuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL,
  venda_id integer,
  servico_id integer,
  template_id uuid REFERENCES public.qa_contract_templates(id),
  template_versao integer,
  status text NOT NULL DEFAULT 'generated_pending_customer_signature',
  conteudo_renderizado text,
  arquivo_gerado_path text,
  arquivo_assinado_path text,
  outorgado_ate date,
  reaproveitada_de uuid REFERENCES public.qa_procuracoes(id),
  reaproveitada_de_hub_id uuid,
  customer_signature_uploaded_at timestamptz,
  validated_at timestamptz,
  validated_by uuid,
  rejection_reason text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_qa_procuracoes_status CHECK (status IN (
    'generated_pending_customer_signature',
    'customer_signature_uploaded',
    'validated',
    'rejected',
    'reaproveitada'
  ))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_procuracoes TO authenticated;
GRANT ALL ON public.qa_procuracoes TO service_role;

CREATE INDEX IF NOT EXISTS idx_qa_procuracoes_cliente ON public.qa_procuracoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_procuracoes_venda   ON public.qa_procuracoes(venda_id);
CREATE INDEX IF NOT EXISTS idx_qa_procuracoes_status  ON public.qa_procuracoes(status);
CREATE INDEX IF NOT EXISTS idx_qa_procuracoes_validade ON public.qa_procuracoes(outorgado_ate);

ALTER TABLE public.qa_procuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_procuracoes_staff_all ON public.qa_procuracoes;
CREATE POLICY qa_procuracoes_staff_all ON public.qa_procuracoes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil IN ('administrador','operador'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil IN ('administrador','operador'))
  );

DROP POLICY IF EXISTS qa_procuracoes_cliente_read ON public.qa_procuracoes;
CREATE POLICY qa_procuracoes_cliente_read ON public.qa_procuracoes
  FOR SELECT USING (
    cliente_id IN (
      SELECT qc.id
      FROM public.qa_clientes qc
      WHERE qc.user_id = auth.uid()
         OR qc.customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid())
    )
    OR cliente_id IN (
      SELECT qc.id_legado
      FROM public.qa_clientes qc
      WHERE qc.id_legado IS NOT NULL
        AND (
          qc.user_id = auth.uid()
          OR qc.customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid())
        )
    )
  );

DROP TRIGGER IF EXISTS trg_qa_procuracoes_touch ON public.qa_procuracoes;
CREATE TRIGGER trg_qa_procuracoes_touch
BEFORE UPDATE ON public.qa_procuracoes
FOR EACH ROW EXECUTE FUNCTION public.qa_set_updated_at();

DROP TRIGGER IF EXISTS trg_qa_subst_touch ON public.qa_config_substituicoes_pessoais;
CREATE TRIGGER trg_qa_subst_touch
BEFORE UPDATE ON public.qa_config_substituicoes_pessoais
FOR EACH ROW EXECUTE FUNCTION public.qa_set_updated_at();

CREATE OR REPLACE FUNCTION public.qa_dispatch_gerar_procuracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_service text;
BEGIN
  IF NEW.status <> 'pending_customer_signature' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending_customer_signature' THEN RETURN NEW; END IF;
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'edge_qa_gerar_procuracao_url' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_url := NULL; END;
  IF v_url IS NULL THEN
    BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'edge_base_url' LIMIT 1;
      IF v_url IS NOT NULL THEN v_url := v_url || '/qa-gerar-procuracao'; END IF;
    EXCEPTION WHEN OTHERS THEN v_url := NULL; END;
  END IF;
  IF v_url IS NULL THEN RETURN NEW; END IF;

  BEGIN
    SELECT decrypted_secret INTO v_service
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_service := NULL; END;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service, '')
    ),
    body := jsonb_build_object(
      'cliente_id', NEW.cliente_id,
      'venda_id',   NEW.venda_id,
      'contract_id', NEW.id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_contract_dispatch_procuracao ON public.qa_contracts;
CREATE TRIGGER trg_qa_contract_dispatch_procuracao
AFTER INSERT OR UPDATE OF status ON public.qa_contracts
FOR EACH ROW EXECUTE FUNCTION public.qa_dispatch_gerar_procuracao();