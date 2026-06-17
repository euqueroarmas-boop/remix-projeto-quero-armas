BEGIN;

ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS categoria_hub text,
  ADD COLUMN IF NOT EXISTS subcategoria_hub text,
  ADD COLUMN IF NOT EXISTS escopo_documental text,
  ADD COLUMN IF NOT EXISTS reaproveitavel_global boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS revisao_humana_obrigatoria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS servicos_compativeis text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS vigencia_regra text,
  ADD COLUMN IF NOT EXISTS fonte_normativa text[] DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.qa_tipos_documento_catalogo (
  tipo_documento text PRIMARY KEY,
  categoria_hub text NOT NULL,
  subcategoria_hub text,
  escopo_documental text NOT NULL,
  label_publico text NOT NULL,
  descricao_upload text,
  aceita_ia boolean NOT NULL DEFAULT false,
  aceita_vinculo_arma boolean NOT NULL DEFAULT false,
  exige_validade boolean NOT NULL DEFAULT false,
  reaproveitavel_global boolean NOT NULL DEFAULT true,
  revisao_humana_obrigatoria boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 100,
  fonte_normativa text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qa_tipos_documento_servicos (
  id bigserial PRIMARY KEY,
  servico_id bigint NOT NULL,
  tipo_documento text NOT NULL,
  modo_reaproveitamento text NOT NULL DEFAULT 'assistido',
  validade_dias integer,
  obrigatorio boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 100,
  observacao_regra text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_tipos_documento_servicos_tipo_documento_fkey
    FOREIGN KEY (tipo_documento) REFERENCES public.qa_tipos_documento_catalogo(tipo_documento) ON DELETE CASCADE,
  CONSTRAINT qa_tipos_documento_servicos_unique UNIQUE (servico_id, tipo_documento)
);

ALTER TABLE public.qa_tipos_documento_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_tipos_documento_servicos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qa_tipos_documento_catalogo'
      AND policyname = 'qa_tipos_documento_catalogo_select_authenticated'
  ) THEN
    CREATE POLICY qa_tipos_documento_catalogo_select_authenticated
      ON public.qa_tipos_documento_catalogo
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qa_tipos_documento_servicos'
      AND policyname = 'qa_tipos_documento_servicos_select_authenticated'
  ) THEN
    CREATE POLICY qa_tipos_documento_servicos_select_authenticated
      ON public.qa_tipos_documento_servicos
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

WITH catalogo (
  tipo_documento,
  categoria_hub,
  subcategoria_hub,
  escopo_documental,
  label_publico,
  descricao_upload,
  aceita_ia,
  aceita_vinculo_arma,
  exige_validade,
  reaproveitavel_global,
  revisao_humana_obrigatoria,
  ordem,
  fonte_normativa
) AS (
  VALUES
    ('rg_com_cpf', 'identificacao', 'rg', 'permanente', 'RG com CPF', 'Documento civil do titular.', true, false, false, true, false, 10, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('cin', 'identificacao', 'cin', 'permanente', 'CIN — Carteira de Identidade Nacional', 'Documento civil do titular.', true, false, false, true, false, 11, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('cnh', 'identificacao', 'cnh', 'permanente', 'CNH — Carteira Nacional de Habilitação', 'Documento civil do titular.', true, false, false, true, false, 12, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('cpf', 'identificacao', 'cpf', 'permanente', 'CPF', 'Documento do titular.', true, false, false, true, false, 13, ARRAY['Lei 10.826/2003']),
    ('comprovante_residencia', 'endereco', 'residencia', 'permanente', 'Comprovante de residência', 'Comprovante residencial compatível com o cadastro.', true, false, true, true, false, 20, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('declaracao_responsavel_imovel', 'endereco', 'terceiro', 'permanente', 'Declaração do responsável pelo imóvel', 'Declaração complementar para comprovante em nome de terceiro.', false, false, false, true, true, 21, ARRAY['IN DG/PF 201', 'IN DG/PF 311']),
    ('ctps', 'renda_ocupacao', 'trabalho', 'permanente', 'Carteira de Trabalho (CTPS)', 'Comprovante da atividade profissional.', true, false, false, true, false, 30, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('renda_holerite_mes_atual', 'renda_ocupacao', 'holerite', 'permanente', 'Holerite mais recente', 'Comprovante de renda do titular.', true, false, true, true, false, 31, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('renda_holerite_funcionario_publico', 'renda_ocupacao', 'holerite_servidor', 'permanente', 'Holerite recente (servidor público)', 'Comprovante de renda do servidor.', true, false, true, true, false, 32, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('renda_cartao_cnpj', 'renda_ocupacao', 'cnpj', 'permanente', 'Cartão CNPJ', 'Comprovante cadastral de atividade.', true, false, false, true, false, 33, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('renda_contrato_social', 'renda_ocupacao', 'societario', 'permanente', 'Contrato Social', 'Documento societário do titular.', false, false, false, true, false, 34, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('renda_cnpj_autonomo', 'renda_ocupacao', 'mei', 'permanente', 'Cartão CNPJ (autônomo / MEI)', 'Comprovante de atividade para autônomo / MEI.', true, false, false, true, false, 35, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('renda_nf_recente', 'renda_ocupacao', 'nota_fiscal', 'permanente', 'Nota fiscal recente', 'Comprovante recente de atividade.', true, false, true, true, false, 36, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('renda_comprovante_beneficio', 'renda_ocupacao', 'beneficio', 'permanente', 'Comprovante de benefício', 'Comprovante previdenciário / benefício.', true, false, true, true, false, 37, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('renda_extrato_inss', 'renda_ocupacao', 'inss', 'permanente', 'Extrato INSS', 'Extrato previdenciário.', true, false, true, true, false, 38, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('antecedentes_criminais', 'antecedentes_regularidade', 'criminal', 'permanente', 'Antecedentes criminais', 'Certidão de antecedentes do titular.', false, false, true, true, false, 40, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('antecedentes_federal', 'antecedentes_regularidade', 'federal', 'permanente', 'Antecedentes federais', 'Certidão federal do titular.', false, false, true, true, false, 41, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('antecedentes_estadual', 'antecedentes_regularidade', 'estadual', 'permanente', 'Antecedentes estaduais', 'Certidão estadual do titular.', false, false, true, true, false, 42, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('antecedentes_militar', 'antecedentes_regularidade', 'militar', 'permanente', 'Antecedentes militares', 'Certidão militar do titular.', false, false, true, true, false, 43, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('antecedentes_eleitoral', 'antecedentes_regularidade', 'eleitoral', 'permanente', 'Antecedentes eleitorais', 'Certidão eleitoral do titular.', false, false, true, true, false, 44, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('declaracao_sem_inquerito_processo_criminal', 'declaracoes', 'penal', 'permanente', 'Declaração de não responder a inquérito/processo', 'Declaração pessoal do requerente.', false, false, false, true, true, 50, ARRAY['IN DG/PF 201', 'IN DG/PF 311']),
    ('declaracao_guarda_responsavel', 'declaracoes', 'guarda', 'permanente', 'Declaração de guarda responsável', 'Declaração de guarda do armamento em local seguro.', false, false, false, true, true, 51, ARRAY['Lei 10.826/2003', 'Decreto 11.615/2023', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('declaracao_guarda_acervo_1endereco', 'declaracoes', 'guarda_acervo', 'cac_atividade', 'Declaração de guarda de acervo — 1 endereço', 'Declaração de guarda de acervo para CAC.', false, false, false, true, true, 52, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024', 'IN DG/PF 311']),
    ('declaracao_guarda_acervo_2enderecos', 'declaracoes', 'guarda_acervo', 'cac_atividade', 'Declaração de guarda de acervo — 2 endereços', 'Declaração de guarda de acervo em mais de um endereço.', false, false, false, true, true, 53, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024', 'IN DG/PF 311']),
    ('laudo_psicologico', 'laudos_exames', 'psicologico', 'permanente', 'Laudo psicológico', 'Laudo emitido por profissional credenciado.', true, false, true, true, false, 60, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('laudo_capacidade_tecnica', 'laudos_exames', 'tecnico', 'permanente', 'Atestado de capacidade técnica', 'Laudo de capacidade técnica do requerente.', true, false, true, true, false, 61, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('comprovante_efetiva_necessidade', 'efetiva_necessidade', 'necessidade', 'processo', 'Comprovação de efetiva necessidade', 'Documento contextual e estratégico do processo.', false, false, false, false, true, 70, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('cr', 'arma_acervo', 'registro_cac', 'arma', 'CR — Certificado de Registro', 'Documento principal do acervo CAC.', true, false, true, true, false, 80, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024', 'IN DG/PF 311']),
    ('craf', 'arma_acervo', 'registro_arma', 'arma', 'CRAF — Registro da arma', 'Documento vinculado a uma arma específica.', true, true, true, true, false, 81, ARRAY['Lei 10.826/2003', 'Decreto 11.615/2023', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('sinarm', 'arma_acervo', 'registro_pf', 'arma', 'SINARM — Posse / porte (PF)', 'Registro/posse vinculada ao Sinarm.', true, true, true, true, false, 82, ARRAY['Lei 10.826/2003', 'IN DG/PF 201']),
    ('gt', 'arma_acervo', 'trafego', 'arma', 'GT — Guia de Tráfego', 'Guia vinculada ao acervo do cliente.', true, true, true, true, false, 83, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024', 'IN DG/PF 311']),
    ('gte', 'arma_acervo', 'trafego_especial', 'arma', 'GTE — Guia de Tráfego Especial', 'Guia especial vinculada ao acervo do cliente.', true, true, true, true, false, 84, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024', 'IN DG/PF 311']),
    ('autorizacao_compra', 'arma_acervo', 'autorizacao', 'arma', 'Autorização de compra', 'Documento de aquisição vinculado à arma / processo.', true, true, true, true, false, 85, ARRAY['Lei 10.826/2003', 'Decreto 11.615/2023', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('nota_fiscal_arma', 'arma_acervo', 'nota_fiscal', 'arma', 'Nota fiscal da arma', 'Nota fiscal vinculada a uma arma específica.', true, true, false, true, false, 86, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024']),
    ('comprovante_habitualidade', 'cac_atividade', 'habitualidade', 'cac_atividade', 'Comprovante de habitualidade', 'Comprovação de prática / atividade CAC.', false, false, true, true, false, 90, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024', 'IN DG/PF 311']),
    ('comprovante_clube_tiro', 'cac_atividade', 'clube', 'cac_atividade', 'Comprovante de clube / entidade', 'Documento de vínculo com clube ou entidade.', false, false, true, true, false, 91, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024', 'IN DG/PF 311']),
    ('comprovante_competicao', 'cac_atividade', 'competicao', 'cac_atividade', 'Comprovante de competição / atividade', 'Registro de competição ou atividade esportiva.', false, false, true, true, false, 92, ARRAY['Decreto 11.615/2023', 'Decreto 12.345/2024', 'IN DG/PF 311']),
    ('protocolo_processo', 'documentos_processo', 'protocolo', 'processo', 'Protocolo do processo', 'Documento específico do processo atual.', false, false, false, false, true, 100, ARRAY['IN DG/PF 201', 'IN DG/PF 311']),
    ('despacho', 'documentos_processo', 'despacho', 'processo', 'Despacho / movimentação', 'Documento específico do processo atual.', false, false, false, false, true, 101, ARRAY['IN DG/PF 201', 'IN DG/PF 311']),
    ('exigencia', 'documentos_processo', 'exigencia', 'processo', 'Exigência administrativa', 'Documento específico do processo atual.', false, false, false, false, true, 102, ARRAY['IN DG/PF 201', 'IN DG/PF 311']),
    ('indeferimento', 'documentos_processo', 'indeferimento', 'processo', 'Indeferimento', 'Documento específico do processo atual.', false, false, false, false, true, 103, ARRAY['IN DG/PF 201', 'IN DG/PF 311']),
    ('procuracao', 'juridico', 'procuracao', 'processo', 'Procuração', 'Documento jurídico do processo.', false, false, false, false, true, 110, ARRAY['Lei 10.826/2003']),
    ('recurso_administrativo_doc', 'juridico', 'recurso', 'processo', 'Recurso administrativo', 'Documento jurídico do processo.', false, false, false, false, true, 111, ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']),
    ('mandado_seguranca_doc', 'juridico', 'mandado', 'processo', 'Mandado de segurança / peça jurídica', 'Documento jurídico do processo.', false, false, false, false, true, 112, ARRAY['Lei 10.826/2003']),
    ('outro', 'outros', 'outros', 'processo', 'Outro documento', 'Anexo complementar sem classificação específica.', false, false, false, false, false, 999, ARRAY['Lei 10.826/2003'])
)
INSERT INTO public.qa_tipos_documento_catalogo (
  tipo_documento,
  categoria_hub,
  subcategoria_hub,
  escopo_documental,
  label_publico,
  descricao_upload,
  aceita_ia,
  aceita_vinculo_arma,
  exige_validade,
  reaproveitavel_global,
  revisao_humana_obrigatoria,
  ordem,
  fonte_normativa
)
SELECT
  tipo_documento,
  categoria_hub,
  subcategoria_hub,
  escopo_documental,
  label_publico,
  descricao_upload,
  aceita_ia,
  aceita_vinculo_arma,
  exige_validade,
  reaproveitavel_global,
  revisao_humana_obrigatoria,
  ordem,
  fonte_normativa
FROM catalogo
ON CONFLICT (tipo_documento) DO UPDATE
SET
  categoria_hub = EXCLUDED.categoria_hub,
  subcategoria_hub = EXCLUDED.subcategoria_hub,
  escopo_documental = EXCLUDED.escopo_documental,
  label_publico = EXCLUDED.label_publico,
  descricao_upload = EXCLUDED.descricao_upload,
  aceita_ia = EXCLUDED.aceita_ia,
  aceita_vinculo_arma = EXCLUDED.aceita_vinculo_arma,
  exige_validade = EXCLUDED.exige_validade,
  reaproveitavel_global = EXCLUDED.reaproveitavel_global,
  revisao_humana_obrigatoria = EXCLUDED.revisao_humana_obrigatoria,
  ordem = EXCLUDED.ordem,
  fonte_normativa = EXCLUDED.fonte_normativa,
  updated_at = now();

WITH compat AS (
  SELECT DISTINCT ON (sd.servico_id::bigint, lower(sd.tipo_documento))
    sd.servico_id::bigint AS servico_id,
    lower(sd.tipo_documento) AS tipo_documento,
    sd.obrigatorio,
    sd.ordem,
    c.escopo_documental,
    c.revisao_humana_obrigatoria,
    c.exige_validade
  FROM public.qa_servicos_documentos sd
  JOIN public.qa_tipos_documento_catalogo c
    ON c.tipo_documento = lower(sd.tipo_documento)
  ORDER BY
    sd.servico_id::bigint,
    lower(sd.tipo_documento),
    coalesce(sd.ordem, 100),
    sd.obrigatorio DESC
)
INSERT INTO public.qa_tipos_documento_servicos (
  servico_id,
  tipo_documento,
  modo_reaproveitamento,
  validade_dias,
  obrigatorio,
  ordem,
  observacao_regra
)
SELECT
  servico_id,
  tipo_documento,
  CASE
    WHEN escopo_documental = 'processo' OR revisao_humana_obrigatoria THEN 'assistido'
    WHEN escopo_documental IN ('permanente', 'arma', 'cac_atividade') THEN 'automatico'
    ELSE 'assistido'
  END AS modo_reaproveitamento,
  CASE WHEN exige_validade THEN 365 ELSE NULL END AS validade_dias,
  coalesce(obrigatorio, false),
  coalesce(ordem, 100),
  CASE
    WHEN escopo_documental = 'processo' THEN 'Documento contextual do processo; reaproveitamento assistido.'
    WHEN revisao_humana_obrigatoria THEN 'Requer revisão humana antes do reaproveitamento.'
    ELSE 'Compatibilidade base herdada do catálogo do serviço.'
  END
FROM compat
ON CONFLICT (servico_id, tipo_documento) DO UPDATE
SET
  modo_reaproveitamento = EXCLUDED.modo_reaproveitamento,
  validade_dias = EXCLUDED.validade_dias,
  obrigatorio = EXCLUDED.obrigatorio,
  ordem = EXCLUDED.ordem,
  observacao_regra = EXCLUDED.observacao_regra,
  updated_at = now();

UPDATE public.qa_documentos_cliente d
SET
  categoria_hub = c.categoria_hub,
  subcategoria_hub = c.subcategoria_hub,
  escopo_documental = c.escopo_documental,
  reaproveitavel_global = c.reaproveitavel_global,
  revisao_humana_obrigatoria = c.revisao_humana_obrigatoria,
  fonte_normativa = c.fonte_normativa
FROM public.qa_tipos_documento_catalogo c
WHERE lower(d.tipo_documento) = c.tipo_documento
  AND (
    d.categoria_hub IS DISTINCT FROM c.categoria_hub OR
    d.subcategoria_hub IS DISTINCT FROM c.subcategoria_hub OR
    d.escopo_documental IS DISTINCT FROM c.escopo_documental OR
    d.reaproveitavel_global IS DISTINCT FROM c.reaproveitavel_global OR
    d.revisao_humana_obrigatoria IS DISTINCT FROM c.revisao_humana_obrigatoria OR
    d.fonte_normativa IS DISTINCT FROM c.fonte_normativa
  );

UPDATE public.qa_documentos_cliente
SET
  categoria_hub = 'arma_acervo',
  escopo_documental = 'arma'
WHERE (
    coalesce(arma_numero_serie, '') <> '' OR
    coalesce(numero_cad_sinarm, '') <> '' OR
    coalesce(numero_registro_sigma, '') <> '' OR
    lower(tipo_documento) IN ('cr', 'craf', 'sinarm', 'gt', 'gte', 'autorizacao_compra', 'nota_fiscal_arma')
  )
  AND (
    categoria_hub IS NULL OR categoria_hub = 'outros' OR escopo_documental IS NULL
  );

UPDATE public.qa_documentos_cliente
SET
  categoria_hub = 'outros',
  escopo_documental = 'processo'
WHERE categoria_hub IS NULL OR escopo_documental IS NULL;

COMMIT;
