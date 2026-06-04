-- ============================================================================
-- FASE 10 — Checklist somente após pagamento confirmado (corrigido)
-- ============================================================================

-- 1) Tabela canônica
CREATE TABLE IF NOT EXISTS public.qa_servicos_documentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id      integer NOT NULL REFERENCES public.qa_servicos(id) ON DELETE CASCADE,
  tipo_documento  text    NOT NULL,
  nome_documento  text    NOT NULL,
  etapa           text    NOT NULL DEFAULT 'base',
  obrigatorio     boolean NOT NULL DEFAULT true,
  validade_dias   integer,
  formato_aceito  text[]  NOT NULL DEFAULT ARRAY['pdf','jpg','jpeg','png'],
  regra_validacao jsonb,
  link_emissao    text,
  condicao_profissional text,
  ordem           integer NOT NULL DEFAULT 0,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Unicidade: (servico_id, tipo_documento, condicao_profissional) tratando NULL como ''
CREATE UNIQUE INDEX IF NOT EXISTS qa_servicos_documentos_unq
  ON public.qa_servicos_documentos
  (servico_id, tipo_documento, COALESCE(condicao_profissional, ''));

CREATE INDEX IF NOT EXISTS idx_qa_servicos_documentos_servico
  ON public.qa_servicos_documentos(servico_id) WHERE ativo;

ALTER TABLE public.qa_servicos_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_servicos_documentos_staff_all ON public.qa_servicos_documentos;
CREATE POLICY qa_servicos_documentos_staff_all
  ON public.qa_servicos_documentos
  FOR ALL TO authenticated
  USING (qa_is_active_staff(auth.uid()))
  WITH CHECK (qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_servicos_documentos_read_auth ON public.qa_servicos_documentos;
CREATE POLICY qa_servicos_documentos_read_auth
  ON public.qa_servicos_documentos
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.qa_servicos_documentos_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_qa_servicos_docs_updated_at ON public.qa_servicos_documentos;
CREATE TRIGGER trg_qa_servicos_docs_updated_at
  BEFORE UPDATE ON public.qa_servicos_documentos
  FOR EACH ROW EXECUTE FUNCTION public.qa_servicos_documentos_set_updated_at();

-- 2) Trava preventiva CTPS como renda
CREATE OR REPLACE FUNCTION public.qa_block_ctps_renda()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tipo_documento ILIKE 'renda_ctps%'
     OR NEW.tipo_documento ILIKE 'renda_carteira_trabalho%' THEN
    RAISE EXCEPTION 'CTPS nao pode ser usada como comprovante de renda (Fase 10). tipo=%', NEW.tipo_documento;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_servicos_docs_block_ctps ON public.qa_servicos_documentos;
CREATE TRIGGER trg_qa_servicos_docs_block_ctps
  BEFORE INSERT OR UPDATE ON public.qa_servicos_documentos
  FOR EACH ROW EXECUTE FUNCTION public.qa_block_ctps_renda();

-- 3) População do catálogo
-- Identificação alternativa (CTPS mantida como id; renda_ctps_digital REMOVIDA)
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, ordem)
SELECT s.id, v.tipo, v.nome, 'base', false, v.vd, v.fmt, v.regra::jsonb, v.link, v.ordem
FROM (VALUES
  ('rg_com_cpf', 'RG com CPF', NULL::int, ARRAY['pdf','jpg','jpeg','png'],
   '{"grupo_alternativo":"identificacao","minimo_grupo":1,"exige":["nome_completo","rg","cpf","data_nascimento","orgao_emissor"],"label_botao":"Enviar RG com CPF"}',
   NULL::text, 10),
  ('cnh', 'CNH (Carteira Nacional de Habilitacao)', NULL, ARRAY['pdf','jpg','jpeg','png'],
   '{"grupo_alternativo":"identificacao","minimo_grupo":1,"exige":["nome_completo","cpf","data_nascimento","validade"],"label_botao":"Enviar CNH"}',
   NULL, 11),
  ('ctps', 'Carteira de Trabalho', NULL, ARRAY['pdf','jpg','jpeg','png'],
   '{"grupo_alternativo":"identificacao","minimo_grupo":1,"exige":["nome_completo","cpf","data_nascimento"],"label_botao":"Enviar Carteira de Trabalho"}',
   NULL, 12)
) AS v(tipo, nome, vd, fmt, regra, link, ordem)
CROSS JOIN public.qa_servicos s
WHERE s.id IN (2, 3, 26)
ON CONFLICT DO NOTHING;

INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, ordem)
SELECT s.id, 'comprovante_residencia', 'Comprovante de residencia (ate 30 dias)', 'base', true, 30,
       ARRAY['pdf','jpg','jpeg','png'],
       '{"exige":["nome_titular","endereco_completo","data_emissao"],"label_botao":"Enviar Comprovante de Residencia"}'::jsonb,
       NULL, 20
FROM public.qa_servicos s WHERE s.id IN (2, 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, ordem)
SELECT s.id, 'justificativa_porte', 'Justificativa fundamentada de efetiva necessidade', 'complementar', true, 30,
       ARRAY['pdf'],
       '{"exige":["texto"],"label_botao":"Enviar Justificativa"}'::jsonb,
       NULL, 25
FROM public.qa_servicos s WHERE s.id = 3
ON CONFLICT DO NOTHING;

-- 8 certidões (Posse + Porte)
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, ordem)
SELECT s.id, c.tipo, c.nome, 'complementar', true, c.vd, ARRAY['pdf'], c.regra::jsonb, c.link, c.ordem
FROM (VALUES
  ('certidao_crimes_eleitorais_tse', 'Certidao Negativa de Crimes Eleitorais (TSE)', 90,
   '{"exige":["nome_titular","cpf","resultado","data_emissao"],"esperado":{"resultado":"NADA_CONSTA"},"label_botao":"Emitir Certidao de Crimes Eleitorais"}',
   'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/', 30),
  ('certidao_crimes_militares_stm', 'Certidao Negativa de Crimes Militares (STM)', 90,
   '{"exige":["nome_titular","cpf","resultado","data_emissao"],"esperado":{"resultado":"NADA_CONSTA"},"label_botao":"Emitir Certidao de Crimes Militares"}',
   'https://www.stm.jus.br/servicos-ao-cidadao/atendimentoaocidadao/certidao-negativa?view=default', 31),
  ('certidao_federal_trf3_regional', 'Certidao Federal TRF3 - Abrangencia Regional', 90,
   '{"exige":["nome_titular","cpf","resultado","data_emissao"],"esperado":{"resultado":"NADA_CONSTA"},"label_botao":"Emitir Certidao Federal Regional"}',
   'https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao', 32),
  ('certidao_federal_trf3_sjsp_jef', 'Certidao Federal TRF3 - Secao Judiciaria e JEF de Sao Paulo', 90,
   '{"exige":["nome_titular","cpf","resultado","data_emissao"],"esperado":{"resultado":"NADA_CONSTA"},"label_botao":"Emitir Certidao Federal da Secao Judiciaria de Sao Paulo"}',
   'https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao', 33),
  ('certidao_tjsp_execucoes_criminais', 'Certidao Estadual TJSP - Execucoes Criminais', 60,
   '{"exige":["nome_titular","cpf","resultado","data_emissao"],"esperado":{"resultado":"NADA_CONSTA"},"label_botao":"Emitir Certidao de Execucoes Criminais"}',
   'https://esaj.tjsp.jus.br/sco/abrirCadastro.do', 34),
  ('certidao_tjsp_distribuicao_criminal', 'Certidao Estadual TJSP - Distribuicao de Acoes Criminais', 60,
   '{"exige":["nome_titular","cpf","resultado","data_emissao"],"esperado":{"resultado":"NADA_CONSTA"},"label_botao":"Emitir Certidao de Distribuicao Criminal"}',
   'https://esaj.tjsp.jus.br/sco/abrirCadastro.do', 35),
  ('certidao_antecedentes_policia_civil_sp', 'Certidao de Antecedentes da Policia Civil', 90,
   '{"exige":["nome_titular","cpf","resultado","data_emissao"],"esperado":{"resultado":"NADA_CONSTA"},"label_botao":"Emitir Certidao de Antecedentes da Policia Civil"}',
   'https://servicos.sp.gov.br/fcarta/259d189e-dc87-4308-9812-7abed7494412', 36),
  ('certidao_criminal_tjmsp', 'Certidao Criminal do TJM-SP', 90,
   '{"exige":["nome_titular","cpf","resultado","data_emissao"],"esperado":{"resultado":"NADA_CONSTA"},"label_botao":"Emitir Certidao da Justica Militar Estadual"}',
   'https://certidaocriminal.tjmsp.jus.br', 37)
) AS c(tipo, nome, vd, regra, link, ordem)
CROSS JOIN public.qa_servicos s
WHERE s.id IN (2, 3)
ON CONFLICT DO NOTHING;

-- Laudos
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, ordem)
SELECT s.id, l.tipo, l.nome, 'tecnico', true, 365, ARRAY['pdf'], l.regra::jsonb, NULL::text, l.ordem
FROM (VALUES
  ('laudo_psicologico', 'Laudo Psicologico (psicologo credenciado PF)',
   '{"exige":["nome_titular","psicologo_crp","resultado","data_emissao"],"esperado":{"resultado":"APTO"},"label_botao":"Enviar Laudo Psicologico"}', 50),
  ('laudo_capacidade_tecnica', 'Atestado de Capacidade Tecnica (instrutor credenciado)',
   '{"exige":["nome_titular","instrutor_credencial","resultado","data_emissao"],"esperado":{"resultado":"APTO"},"label_botao":"Enviar Atestado Tecnico"}', 51)
) AS l(tipo, nome, regra, ordem)
CROSS JOIN public.qa_servicos s
WHERE s.id IN (2, 3)
ON CONFLICT DO NOTHING;

-- Renda CLT (sem renda_ctps_digital)
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, condicao_profissional, ordem)
SELECT s.id, r.tipo, r.nome, 'complementar', true, 30, ARRAY['pdf','jpg','jpeg','png'], r.regra::jsonb, r.link, 'clt', r.ordem
FROM (VALUES
  ('renda_holerite_mes_atual', 'Holerite mais recente (mes atual)',
   '{"exige":["nome_titular"],"label_botao":"Enviar Holerite"}', NULL::text, 40),
  ('renda_extrato_inss', 'Extrato completo de contribuicoes do INSS',
   '{"exige":["nome_titular"],"label_botao":"Enviar Extrato INSS"}', 'https://meu.inss.gov.br/', 42)
) AS r(tipo, nome, regra, link, ordem)
CROSS JOIN public.qa_servicos s
WHERE s.id IN (2, 3)
ON CONFLICT DO NOTHING;

-- Renda Autonomo
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, condicao_profissional, ordem)
SELECT s.id, r.tipo, r.nome, 'complementar', true, 30, ARRAY['pdf','jpg','jpeg','png'], r.regra::jsonb, r.link, 'autonomo', r.ordem
FROM (VALUES
  ('renda_cnpj_autonomo', 'Cartao CNPJ (autonomo / MEI)',
   '{"exige":["nome_titular"],"label_botao":"Enviar Cartao CNPJ"}',
   'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp', 40),
  ('renda_nf_recente', 'Nota fiscal recente emitida',
   '{"exige":["nome_titular"],"label_botao":"Enviar Nota Fiscal"}', NULL::text, 41)
) AS r(tipo, nome, regra, link, ordem)
CROSS JOIN public.qa_servicos s
WHERE s.id IN (2, 3)
ON CONFLICT DO NOTHING;

-- Renda Empresario
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, condicao_profissional, ordem)
SELECT s.id, r.tipo, r.nome, 'complementar', true, 30, ARRAY['pdf','jpg','jpeg','png'], r.regra::jsonb, r.link, 'empresario', r.ordem
FROM (VALUES
  ('renda_cartao_cnpj', 'Cartao CNPJ da empresa',
   '{"exige":["nome_titular"],"label_botao":"Enviar Cartao CNPJ"}',
   'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp', 40),
  ('renda_qsa', 'QSA (Quadro de Socios e Administradores)',
   '{"exige":["nome_titular"],"label_botao":"Enviar QSA"}', NULL::text, 41),
  ('renda_contrato_social', 'Contrato Social',
   '{"exige":["nome_titular"],"label_botao":"Enviar Contrato Social"}', NULL, 42),
  ('renda_nf_empresa', 'Nota fiscal recente da empresa (se aplicavel)',
   '{"exige":["nome_titular"],"label_botao":"Enviar Nota Fiscal"}', NULL, 43)
) AS r(tipo, nome, regra, link, ordem)
CROSS JOIN public.qa_servicos s
WHERE s.id IN (2, 3)
ON CONFLICT DO NOTHING;

-- Renda Aposentado
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, condicao_profissional, ordem)
SELECT s.id, r.tipo, r.nome, 'complementar', true, 30, ARRAY['pdf','jpg','jpeg','png'], r.regra::jsonb, r.link, 'aposentado', r.ordem
FROM (VALUES
  ('renda_comprovante_beneficio', 'Comprovante de beneficio (aposentadoria)',
   '{"exige":["nome_titular"],"label_botao":"Enviar Comprovante de Beneficio"}',
   'https://meu.inss.gov.br/', 40),
  ('renda_extrato_inss', 'Extrato completo de contribuicoes do INSS (se aplicavel)',
   '{"exige":["nome_titular"],"label_botao":"Enviar Extrato INSS"}',
   'https://meu.inss.gov.br/', 41)
) AS r(tipo, nome, regra, link, ordem)
CROSS JOIN public.qa_servicos s
WHERE s.id IN (2, 3)
ON CONFLICT DO NOTHING;

-- Renda Indefinida (placeholder)
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, condicao_profissional, ordem)
SELECT s.id, 'renda_definir_condicao',
       'Defina sua condicao profissional para liberar os comprovantes corretos',
       'complementar', true, NULL, ARRAY['pdf','jpg','jpeg','png'],
       '{"acao":"selecionar_condicao_profissional","label_botao":"Informar Condicao Profissional"}'::jsonb,
       NULL, 'indefinido', 40
FROM public.qa_servicos s WHERE s.id IN (2, 3)
ON CONFLICT DO NOTHING;

-- CRAF/SIGMA
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao, ordem)
SELECT s.id, c.tipo, c.nome, c.etapa, c.obr, NULL, ARRAY['pdf'], c.regra::jsonb, c.link, c.ordem
FROM (VALUES
  ('cr_cac', 'Certificado de Registro CAC vigente', 'base', true,
   '{"exige":["numero_cr","categoria","validade"],"label_botao":"Enviar CR"}',
   'https://www.gov.br/defesa/pt-br/assuntos/sfpc', 20),
  ('nota_fiscal_arma', 'Nota Fiscal da arma', 'complementar', true,
   '{"exige":["comprador_cpf","modelo","numero_serie","data_emissao"],"label_botao":"Enviar Nota Fiscal"}',
   NULL::text, 30),
  ('guia_trafego', 'Guia de Trafego (se houver)', 'complementar', false,
   '{"exige":["numero_guia","validade"],"label_botao":"Enviar Guia de Trafego"}',
   NULL, 31)
) AS c(tipo, nome, etapa, obr, regra, link, ordem)
CROSS JOIN public.qa_servicos s
WHERE s.id = 26
ON CONFLICT DO NOTHING;

-- 4) RPC idempotente: explode checklist após pagamento
CREATE OR REPLACE FUNCTION public.qa_explodir_checklist_processo(p_processo_id uuid)
RETURNS TABLE(inseridos integer, ja_existentes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc        public.qa_processos%ROWTYPE;
  v_condicao    text;
  v_ins         integer := 0;
  v_exi         integer := 0;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  IF v_proc.servico_id IS NULL THEN
    RAISE EXCEPTION 'Processo % sem servico_id - fallback Posse proibido', p_processo_id;
  END IF;

  v_condicao := COALESCE(v_proc.condicao_profissional, 'indefinido');

  WITH desejados AS (
    SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.validade_dias,
           sd.formato_aceito, sd.regra_validacao, sd.link_emissao
    FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = v_proc.servico_id
      AND sd.ativo = true
      AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_condicao)
  ),
  ja AS (
    SELECT tipo_documento FROM public.qa_processo_documentos
    WHERE processo_id = p_processo_id
  ),
  inserted AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao
    )
    SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento, d.nome_documento, d.etapa,
           'pendente', true, d.validade_dias, d.formato_aceito, d.regra_validacao, d.link_emissao
    FROM desejados d
    WHERE NOT EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM inserted)::int,
    (SELECT COUNT(*) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento))::int
  INTO v_ins, v_exi;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
  VALUES (
    p_processo_id, 'checklist_explodido',
    format('Checklist liberado pos-pagamento: %s novos, %s ja existentes (servico_id=%s, condicao=%s)',
           v_ins, v_exi, v_proc.servico_id, v_condicao),
    'sistema'
  );

  inseridos := v_ins;
  ja_existentes := v_exi;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.qa_explodir_checklist_processo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_explodir_checklist_processo(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.qa_explodir_checklist_processo(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.qa_explodir_checklist_processo(uuid) TO service_role;

-- 5) qa_criar_processo_logado: NÃO cria mais checklist
CREATE OR REPLACE FUNCTION public.qa_criar_processo_logado(
  p_cliente_id integer,
  p_catalogo_slug text,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid             uuid := auth.uid();
  v_cliente_owner   integer;
  v_is_staff        boolean;
  v_cat             public.qa_servicos_catalogo%ROWTYPE;
  v_servico_id      integer;
  v_servico_nome    text;
  v_processo_id     uuid;
BEGIN
  v_is_staff := public.qa_is_active_staff(v_uid);
  v_cliente_owner := public.qa_current_cliente_id(v_uid);
  IF NOT v_is_staff AND (v_cliente_owner IS NULL OR v_cliente_owner <> p_cliente_id) THEN
    RAISE EXCEPTION 'Nao autorizado a criar processo para este cliente.';
  END IF;

  SELECT * INTO v_cat FROM public.qa_servicos_catalogo WHERE slug = p_catalogo_slug AND ativo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servico nao encontrado ou inativo: %', p_catalogo_slug;
  END IF;

  IF v_cat.gera_processo = false THEN
    RAISE EXCEPTION 'Este item do catalogo nao gera processo: %', p_catalogo_slug;
  END IF;

  v_servico_id := v_cat.servico_id;
  IF v_servico_id IS NOT NULL THEN
    SELECT nome INTO v_servico_nome FROM public.qa_servicos WHERE id = v_servico_id;
  END IF;
  v_servico_nome := COALESCE(v_servico_nome, v_cat.nome);

  -- FASE 10: Cria processo SEM checklist. Checklist so apos pagamento confirmado.
  INSERT INTO public.qa_processos (
    cliente_id, servico_id, servico_nome,
    pagamento_status, status, observacoes_admin
  ) VALUES (
    p_cliente_id, v_servico_id, v_servico_nome,
    'aguardando', 'aguardando_pagamento',
    COALESCE(p_observacoes, 'Contratacao via portal do cliente (' || v_cat.slug || ')')
  )
  RETURNING id INTO v_processo_id;

  RETURN v_processo_id;
END;
$function$;
