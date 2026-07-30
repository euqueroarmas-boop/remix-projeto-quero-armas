-- =============================================================================
-- Justiça Federal por região + separação dos dois militares
--
-- Decisões do usuário (30/07/2026):
--   1) O TRF3 só pode ser exigido de quem mora em SP ou MS. Para as demais
--      UFs, exigir o TRF da região correspondente.
--   2) Os slugs passam a carregar a região: antecedentes_federal_regional_trfX.
--   3) STM (União) e TJM (estadual) deixam de dividir o mesmo slug — um
--      nunca mais cumpre a exigência do outro.
--
-- NADA é apagado. Os slugs antigos continuam no CHECK e viram apelido, para
-- que documento já entregue e checklist já montado sigam casando.
--
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================================

BEGIN;

-- ─── 1) Mapa das regiões da Justiça Federal ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_trf_regioes (
  uf                     char(2) PRIMARY KEY,
  trf                    smallint NOT NULL CHECK (trf BETWEEN 1 AND 6),
  nome_trf               text NOT NULL,
  link_certidao_regional text,
  link_secao_judiciaria  text,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qa_trf_regioes IS
  'UF -> TRF competente. A Justiça Federal tem 6 regiões; a certidão de uma região não cobre outra. Links não confirmados ficam NULL de propósito.';

INSERT INTO public.qa_trf_regioes (uf, trf, nome_trf, link_certidao_regional, link_secao_judiciaria) VALUES
  ('AC', 1, 'TRF da 1ª Região', NULL, NULL),
  ('AL', 5, 'TRF da 5ª Região', NULL, NULL),
  ('AM', 1, 'TRF da 1ª Região', NULL, NULL),
  ('AP', 1, 'TRF da 1ª Região', NULL, NULL),
  ('BA', 1, 'TRF da 1ª Região', NULL, NULL),
  ('CE', 5, 'TRF da 5ª Região', NULL, NULL),
  ('DF', 1, 'TRF da 1ª Região', NULL, NULL),
  ('ES', 2, 'TRF da 2ª Região', NULL, NULL),
  ('GO', 1, 'TRF da 1ª Região', NULL, NULL),
  ('MA', 1, 'TRF da 1ª Região', NULL, NULL),
  ('MG', 6, 'TRF da 6ª Região', NULL, NULL),
  ('MS', 3, 'TRF da 3ª Região', 'https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao', NULL),
  ('MT', 1, 'TRF da 1ª Região', NULL, NULL),
  ('PA', 1, 'TRF da 1ª Região', NULL, NULL),
  ('PB', 5, 'TRF da 5ª Região', NULL, NULL),
  ('PE', 5, 'TRF da 5ª Região', NULL, NULL),
  ('PI', 1, 'TRF da 1ª Região', NULL, NULL),
  ('PR', 4, 'TRF da 4ª Região', NULL, NULL),
  ('RJ', 2, 'TRF da 2ª Região', NULL, NULL),
  ('RN', 5, 'TRF da 5ª Região', NULL, NULL),
  ('RO', 1, 'TRF da 1ª Região', NULL, NULL),
  ('RR', 1, 'TRF da 1ª Região', NULL, NULL),
  ('RS', 4, 'TRF da 4ª Região', NULL, NULL),
  ('SC', 4, 'TRF da 4ª Região', NULL, NULL),
  ('SE', 5, 'TRF da 5ª Região', NULL, NULL),
  ('SP', 3, 'TRF da 3ª Região', 'https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao', NULL),
  ('TO', 1, 'TRF da 1ª Região', NULL, NULL)
ON CONFLICT (uf) DO UPDATE
  SET trf = EXCLUDED.trf,
      nome_trf = EXCLUDED.nome_trf,
      link_certidao_regional = COALESCE(EXCLUDED.link_certidao_regional, public.qa_trf_regioes.link_certidao_regional),
      updated_at = now();

ALTER TABLE public.qa_trf_regioes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qa_trf_regioes_leitura ON public.qa_trf_regioes;
CREATE POLICY qa_trf_regioes_leitura ON public.qa_trf_regioes
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.qa_trf_da_uf(p_uf text)
RETURNS smallint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT trf FROM public.qa_trf_regioes WHERE uf = UPPER(TRIM(COALESCE(p_uf,'')));
$fn$;

-- ─── 2) CHECK de qa_documentos_cliente com os slugs novos ────────────────
ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check CHECK (tipo_documento = ANY (ARRAY[
    'cr','craf','sinarm','gt','gte','autorizacao_compra','nota_fiscal_arma',
    'rg_com_cpf','cin','cnh','cpf',
    'comprovante_residencia','declaracao_responsavel_imovel',
    'ctps','renda_holerite_mes_atual','renda_holerite_funcionario_publico',
    'renda_cartao_cnpj','renda_cnpj_autonomo','renda_contrato_social',
    'renda_nf_recente','renda_comprovante_beneficio','renda_extrato_inss',
    'renda_qsa','renda_ccmei','renda_carteira_funcional',
    'antecedentes_criminais','antecedentes_federal',
    'antecedentes_federal_trf3_regional','antecedentes_federal_sjsp_jef',
    'antecedentes_estadual','antecedentes_estadual_distribuicao',
    'antecedentes_estadual_execucoes','antecedentes_militar','antecedentes_eleitoral',
    'declaracao_sem_inquerito_processo_criminal','declaracao_guarda_responsavel',
    'declaracao_correlata','declaracao_guarda_acervo_1endereco',
    'declaracao_guarda_acervo_2enderecos','declaracao_homonimia',
    'declaracao_endereco_acervo','dsa_declaracao_seguranca_acervo',
    'laudo_psicologico','laudo_capacidade_tecnica',
    'comprovante_efetiva_necessidade','documento_complementar_caso',
    'comprovante_habitualidade','declaracao_compromisso_habitualidade',
    'comprovante_clube_tiro','comprovante_competicao',
    'comprovante_pagamento',
    'protocolo_processo','oficio','despacho','exigencia','indeferimento',
    'procuracao','procuracao_assinada','contrato_assinado',
    'recurso_administrativo_doc','mandado_seguranca_doc',
    'certidao_alteracao_nome',
    'outro',
    -- Justiça Federal por região (regional)
    'antecedentes_federal_regional_trf1','antecedentes_federal_regional_trf2','antecedentes_federal_regional_trf3',
    'antecedentes_federal_regional_trf4','antecedentes_federal_regional_trf5','antecedentes_federal_regional_trf6',
    -- Justiça Federal por seção judiciária (uma por UF)
    'antecedentes_federal_secao_judiciaria_ac','antecedentes_federal_secao_judiciaria_al','antecedentes_federal_secao_judiciaria_am',
    'antecedentes_federal_secao_judiciaria_ap','antecedentes_federal_secao_judiciaria_ba','antecedentes_federal_secao_judiciaria_ce',
    'antecedentes_federal_secao_judiciaria_df','antecedentes_federal_secao_judiciaria_es','antecedentes_federal_secao_judiciaria_go',
    'antecedentes_federal_secao_judiciaria_ma','antecedentes_federal_secao_judiciaria_mg','antecedentes_federal_secao_judiciaria_ms',
    'antecedentes_federal_secao_judiciaria_mt','antecedentes_federal_secao_judiciaria_pa','antecedentes_federal_secao_judiciaria_pb',
    'antecedentes_federal_secao_judiciaria_pe','antecedentes_federal_secao_judiciaria_pi','antecedentes_federal_secao_judiciaria_pr',
    'antecedentes_federal_secao_judiciaria_rj','antecedentes_federal_secao_judiciaria_rn','antecedentes_federal_secao_judiciaria_ro',
    'antecedentes_federal_secao_judiciaria_rr','antecedentes_federal_secao_judiciaria_rs','antecedentes_federal_secao_judiciaria_sc',
    'antecedentes_federal_secao_judiciaria_se','antecedentes_federal_secao_judiciaria_sp','antecedentes_federal_secao_judiciaria_to',
    -- Justiça Militar ESTADUAL (TJM) — separada do STM
    'antecedentes_militar_estadual'
  ]::text[]));

-- ─── 3) Biblioteca: um registro por região e por seção judiciária ────────
INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   observacao_cliente, validade_dias, formato_aceito, link_emissao, base_legal,
   emissor_padrao, ativo)
SELECT
  'antecedentes_federal_regional_trf' || r.trf,
  'Certidão Federal — ' || r.nome_trf,
  'certidoes',
  'Certidão criminal da Justiça Federal emitida pelo ' || r.nome_trf || '.',
  'Emita no site do ' || r.nome_trf || ' e envie o PDF original.',
  'Vale apenas para quem reside nos estados desta região.',
  60, ARRAY['pdf'], MAX(r.link_certidao_regional),
  'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 201',
  'cliente', true
FROM public.qa_trf_regioes r
GROUP BY r.trf, r.nome_trf
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, ativo = true, updated_at = now();

INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   observacao_cliente, validade_dias, formato_aceito, link_emissao, base_legal,
   emissor_padrao, ativo)
SELECT
  'antecedentes_federal_secao_judiciaria_' || LOWER(r.uf),
  'Certidão Federal — Seção Judiciária de ' || r.uf,
  'certidoes',
  'Certidão criminal da Seção Judiciária da Justiça Federal em ' || r.uf || ', incluindo Juizados Especiais Federais.',
  'Emita no site da Seção Judiciária de ' || r.uf || ' e envie o PDF original.',
  'Complementa a certidão regional do ' || r.nome_trf || '; não a substitui.',
  60, ARRAY['pdf'], r.link_secao_judiciaria,
  'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 201',
  'cliente', true
FROM public.qa_trf_regioes r
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, ativo = true, updated_at = now();

INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   observacao_cliente, validade_dias, formato_aceito, link_emissao, base_legal,
   emissor_padrao, ativo)
VALUES (
  'antecedentes_militar_estadual',
  'Certidão Criminal — Justiça Militar Estadual (TJM)',
  'certidoes',
  'Certidão do Tribunal de Justiça Militar do estado. Existe apenas em São Paulo, Minas Gerais e Rio Grande do Sul.',
  'Emita no site do Tribunal de Justiça Militar do seu estado e envie o PDF original.',
  'Não substitui a certidão do STM, que é da Justiça Militar da União.',
  60, ARRAY['pdf'], NULL,
  'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 201',
  'cliente', true
)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, ativo = true, updated_at = now();

UPDATE public.qa_documentos_biblioteca
   SET nome = 'Certidão Criminal — Justiça Militar da União (STM)',
       descricao_o_que_e = 'Certidão do Superior Tribunal Militar. Cobre crimes militares contra a União em todo o Brasil.',
       updated_at = now()
 WHERE codigo IN ('certidao_crimes_militares_stm','certidao_antecedentes_criminais_militar');

COMMIT;

-- ─── 4) Exigências do checklist: uma linha por região/UF ─────────────────
--
-- Hoje o catálogo tem UMA linha "TRF3" servindo qualquer cliente. Ela vira
-- seis linhas (uma por TRF) e vinte e sete (uma por seção judiciária), cada
-- uma restrita às UFs que atende. O checklist escolhe pela UF do cadastro,
-- então o cliente da Bahia recebe o TRF1 e nunca mais o TRF3.

BEGIN;

ALTER TABLE public.qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS condicao_uf text[];

COMMENT ON COLUMN public.qa_servicos_documentos.condicao_uf IS
  'UFs de residência que recebem esta exigência. NULL = todas. Usado por qa_explodir_checklist_processo.';

-- 4.1 Regional: replica a linha do TRF3 para as 6 regiões
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, emissor, escopo, formato_aceito, validade_dias,
  instrucoes, observacoes_cliente, orgao_emissor, prazo_recomendado_dias,
  condicao_profissional, condicao_uf, link_emissao, biblioteca_id, ativo
)
SELECT
  sd.servico_id,
  'antecedentes_federal_regional_trf' || r.trf,
  'Certidão Federal — ' || r.nome_trf,
  sd.etapa, sd.ordem, sd.obrigatorio,
  sd.obrigatorio_etapa02, sd.emissor, sd.escopo, sd.formato_aceito, sd.validade_dias,
  sd.instrucoes, sd.observacoes_cliente, r.nome_trf, sd.prazo_recomendado_dias,
  sd.condicao_profissional,
  ARRAY(SELECT uf FROM public.qa_trf_regioes WHERE trf = r.trf ORDER BY uf),
  (SELECT MAX(t.link_certidao_regional) FROM public.qa_trf_regioes t WHERE t.trf = r.trf),
  (SELECT id FROM public.qa_documentos_biblioteca
    WHERE codigo = 'antecedentes_federal_regional_trf' || r.trf),
  sd.ativo
FROM public.qa_servicos_documentos sd
CROSS JOIN (SELECT DISTINCT trf, nome_trf FROM public.qa_trf_regioes) r
WHERE sd.tipo_documento = 'antecedentes_federal_trf3_regional'
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_servicos_documentos x
     WHERE x.servico_id = sd.servico_id
       AND x.tipo_documento = 'antecedentes_federal_regional_trf' || r.trf
       AND COALESCE(x.condicao_profissional,'') = COALESCE(sd.condicao_profissional,'')
  );

-- 4.2 Seção judiciária: replica a linha SJSP/JEF para as 27 UFs
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, emissor, escopo, formato_aceito, validade_dias,
  instrucoes, observacoes_cliente, orgao_emissor, prazo_recomendado_dias,
  condicao_profissional, condicao_uf, link_emissao, biblioteca_id, ativo
)
SELECT
  sd.servico_id,
  'antecedentes_federal_secao_judiciaria_' || LOWER(r.uf),
  'Certidão Federal — Seção Judiciária de ' || r.uf,
  sd.etapa, sd.ordem, sd.obrigatorio,
  sd.obrigatorio_etapa02, sd.emissor, sd.escopo, sd.formato_aceito, sd.validade_dias,
  sd.instrucoes, sd.observacoes_cliente, 'Seção Judiciária de ' || r.uf, sd.prazo_recomendado_dias,
  sd.condicao_profissional, ARRAY[r.uf], r.link_secao_judiciaria,
  (SELECT id FROM public.qa_documentos_biblioteca
    WHERE codigo = 'antecedentes_federal_secao_judiciaria_' || LOWER(r.uf)),
  sd.ativo
FROM public.qa_servicos_documentos sd
CROSS JOIN public.qa_trf_regioes r
WHERE sd.tipo_documento = 'antecedentes_federal_sjsp_jef'
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_servicos_documentos x
     WHERE x.servico_id = sd.servico_id
       AND x.tipo_documento = 'antecedentes_federal_secao_judiciaria_' || LOWER(r.uf)
       AND COALESCE(x.condicao_profissional,'') = COALESCE(sd.condicao_profissional,'')
  );

-- 4.3 Desativa as linhas antigas presas a São Paulo.
--     Desativa, NÃO apaga: processo já montado continua enxergando o que pediu.
UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE tipo_documento IN ('antecedentes_federal_trf3_regional','antecedentes_federal_sjsp_jef');

-- ─── 5) Separa o militar estadual (TJM) do militar da União (STM) ────────
-- Só as linhas que vieram do item de biblioteca ESTADUAL são repontadas.
-- As demais continuam em antecedentes_militar, que passa a significar
-- exclusivamente STM/União.
UPDATE public.qa_servicos_documentos sd
   SET tipo_documento = 'antecedentes_militar_estadual',
       nome_documento = 'Certidão Criminal — Justiça Militar Estadual (TJM)',
       condicao_uf = ARRAY['SP','MG','RS'],
       biblioteca_id = (SELECT id FROM public.qa_documentos_biblioteca
                         WHERE codigo = 'antecedentes_militar_estadual'),
       updated_at = now()
 WHERE sd.tipo_documento = 'antecedentes_militar'
   AND sd.biblioteca_id IN (
     SELECT id FROM public.qa_documentos_biblioteca
      WHERE codigo IN ('certidao_estadual_justica_militar','certidao_criminal_tjmsp')
   );

-- O apelido que fazia o TJM cair no slot do STM deixa de existir.
DELETE FROM public.qa_tipo_documento_aliases
 WHERE processo_tipo = 'certidao_estadual_justica_militar'
   AND hub_tipo = 'antecedentes_militar';

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_estadual_justica_militar', 'antecedentes_militar_estadual'),
  ('certidao_criminal_tjmsp',           'antecedentes_militar_estadual'),
  ('certidao_crimes_militares_stm',     'antecedentes_militar'),
  ('antecedentes_federal_trf3_regional','antecedentes_federal_regional_trf3'),
  ('antecedentes_federal_sjsp_jef',     'antecedentes_federal_secao_judiciaria_sp'),
  ('certidao_federal_trf3_regional',    'antecedentes_federal_regional_trf3'),
  ('certidao_federal_trf3_sjsp_jef',    'antecedentes_federal_secao_judiciaria_sp')
ON CONFLICT DO NOTHING;

COMMIT;

-- ─── 6) Checklist passa a respeitar a UF do cadastro ─────────────────────
--
-- Reescreve qa_explodir_checklist_processo acrescentando UM filtro:
-- linhas com condicao_uf só entram para clientes daquela UF. O restante da
-- função é idêntico à versão de 18/07 (20260718025818).

BEGIN;

CREATE OR REPLACE FUNCTION public.qa_explodir_checklist_processo(p_processo_id uuid)
RETURNS TABLE(inseridos integer, ja_existentes integer, reaproveitados_cofre integer, pre_validados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proc                public.qa_processos%ROWTYPE;
  v_cli                 public.qa_clientes%ROWTYPE;
  v_condicao            text;
  v_profissao_upper     text;
  v_uf_cliente          text;
  v_ins                 integer := 0;
  v_exi                 integer := 0;
  v_dup                 integer := 0;
  v_invalid             integer := 0;
  v_prevalid            integer := 0;
  v_endereco_seed       integer := 0;
  v_endereco_aproveit   integer := 0;
  v_inserted_tipos      text[] := ARRAY[]::text[];
  v_existing_tipos      text[] := ARRAY[]::text[];
  v_duplicate_tipos     text[] := ARRAY[]::text[];
  v_invalid_items       jsonb := '[]'::jsonb;
  v_reuso               record;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  IF v_proc.servico_id IS NULL THEN
    RAISE EXCEPTION 'Processo % sem servico_id - fallback Posse proibido', p_processo_id;
  END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = v_proc.cliente_id;

  v_condicao := COALESCE(NULLIF(v_proc.condicao_profissional, ''), 'indefinido');
  v_profissao_upper := NULLIF(TRIM(UPPER(COALESCE(v_cli.profissao, ''))), '');
  -- UF do endereço do cadastro. É ela que decide TRF, seção judiciária e TJM.
  v_uf_cliente := NULLIF(TRIM(UPPER(COALESCE(v_cli.estado, ''))), '');

  WITH catalogo_bruto AS (
    SELECT sd.*,
           CASE
             WHEN sd.etapa IN ('base','complementar','tecnico','final') THEN sd.etapa
             WHEN sd.etapa = 'antecedentes' THEN 'base'
             WHEN sd.etapa = 'declaracoes' THEN 'complementar'
             WHEN sd.etapa = 'renda' THEN 'complementar'
             ELSE 'base'
           END AS etapa_segura,
           (sd.etapa IS NULL OR sd.etapa NOT IN ('base','complementar','tecnico','final')) AS etapa_invalida,
           row_number() OVER (
             PARTITION BY sd.tipo_documento
             ORDER BY
               CASE WHEN sd.condicao_profissional IS NULL THEN 0 ELSE 1 END,
               COALESCE(sd.ordem, 999),
               sd.created_at,
               sd.id
           ) AS rn
      FROM public.qa_servicos_documentos sd
     WHERE sd.servico_id = v_proc.servico_id
       AND sd.ativo = true
       AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_condicao)
       -- Exigência territorial: linha com condicao_uf só entra se a UF do
       -- cadastro estiver na lista. Sem UF conhecida, a exigência NÃO entra:
       -- é melhor faltar item do que cobrar do cliente a certidão de um
       -- tribunal que não julga os processos dele.
       AND (sd.condicao_uf IS NULL OR (v_uf_cliente IS NOT NULL AND v_uf_cliente = ANY(sd.condicao_uf)))
  ),
  desejados AS (SELECT * FROM catalogo_bruto WHERE rn = 1),
  duplicados AS (SELECT * FROM catalogo_bruto WHERE rn > 1),
  ja AS (SELECT DISTINCT tipo_documento FROM public.qa_processo_documentos WHERE processo_id = p_processo_id),
  inserted AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
      instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor,
      prazo_recomendado_dias, escopo
    )
    SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento,
           CASE WHEN v_profissao_upper IS NOT NULL
                 AND (d.tipo_documento ILIKE 'renda_%' OR d.tipo_documento ILIKE '%atividade%')
                THEN d.nome_documento || ' — ' || v_profissao_upper
                ELSE d.nome_documento END,
           d.etapa_segura, 'pendente', COALESCE(d.obrigatorio, true),
           d.validade_dias, d.formato_aceito, d.regra_validacao, d.link_emissao,
           d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url,
           d.orgao_emissor, d.prazo_recomendado_dias,
           COALESCE(d.escopo, 'processo')
      FROM desejados d
     WHERE NOT EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)
    RETURNING tipo_documento
  )
  SELECT
    COALESCE((SELECT COUNT(*) FROM inserted), 0)::int,
    COALESCE((SELECT COUNT(*) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)), 0)::int,
    COALESCE((SELECT COUNT(*) FROM duplicados), 0)::int,
    COALESCE((SELECT COUNT(*) FROM desejados d WHERE d.etapa_invalida), 0)::int,
    COALESCE((SELECT array_agg(tipo_documento ORDER BY tipo_documento) FROM inserted), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(d.tipo_documento ORDER BY d.tipo_documento) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(tipo_documento ORDER BY tipo_documento) FROM duplicados), ARRAY[]::text[]),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo_documento', d.tipo_documento, 'etapa_original', d.etapa, 'etapa_usada', d.etapa_segura) ORDER BY d.tipo_documento) FROM desejados d WHERE d.etapa_invalida), '[]'::jsonb)
  INTO v_ins, v_exi, v_dup, v_invalid, v_inserted_tipos, v_existing_tipos, v_duplicate_tipos, v_invalid_items;

  IF v_invalid > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_etapa_invalida_normalizada',
      format('Catálogo com %s etapa(s) inválida(s).', v_invalid),
      jsonb_build_object('servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao, 'itens', v_invalid_items),
      'sistema');
  END IF;

  IF v_dup > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_duplicados_ignorados',
      format('Checklist ignorou %s item(ns) duplicado(s).', v_dup),
      jsonb_build_object('servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao, 'tipos_documento', v_duplicate_tipos),
      'sistema');
  END IF;

  IF v_cli.cep IS NOT NULL AND v_cli.endereco IS NOT NULL
     AND v_cli.cidade IS NOT NULL AND v_cli.estado IS NOT NULL THEN
    UPDATE public.qa_processo_documentos
       SET observacoes = COALESCE(observacoes,'') ||
             CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
             '] Endereço pré-preenchido do cadastro: ' ||
             v_cli.endereco || ', ' || COALESCE(v_cli.numero, 's/n') || ' - ' ||
             v_cli.cidade || '/' || v_cli.estado || ' - CEP ' || v_cli.cep,
           updated_at = now()
     WHERE processo_id = p_processo_id
       AND tipo_documento ILIKE '%comprovante_residencia%'
       AND status = 'pendente';
    GET DIAGNOSTICS v_prevalid = ROW_COUNT;
  END IF;

  IF v_proc.servico_id IN (31, 44, 50, 51) THEN
    BEGIN
      v_endereco_seed     := public.qa_seed_endereco_5_anos(p_processo_id);
      v_endereco_aproveit := public.qa_aproveitar_endereco_cadastro_publico(p_processo_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qa_seed_endereco_5_anos / aproveitar falhou: %', SQLERRM;
    END;
  END IF;

  SELECT * INTO v_reuso
    FROM public.qa_reaproveitar_documentos_hub_processo(p_processo_id, 'checklist_explodido_pos_seed');

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (p_processo_id, 'checklist_explodido',
    format('Checklist explodido: %s ins, %s exist, %s dup, %s inv, %s cofre, %s slots end5anos, %s end aproveitados (svc=%s, cond=%s).',
           v_ins, v_exi, v_dup, v_invalid, COALESCE(v_reuso.reaproveitados, 0), v_endereco_seed, v_endereco_aproveit, v_proc.servico_id, v_condicao),
    jsonb_build_object(
      'servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao,
      'documentos_inseridos', v_inserted_tipos,
      'documentos_ja_existentes', v_existing_tipos,
      'documentos_ignorados_por_duplicidade', v_duplicate_tipos,
      'documentos_com_etapa_invalida_normalizada', v_invalid_items,
      'reaproveitados_cofre', COALESCE(v_reuso.reaproveitados, 0),
      'pre_validados', v_prevalid,
      'endereco_5_anos_slots_criados', v_endereco_seed,
      'endereco_cadastro_publico_aproveitado', v_endereco_aproveit
    ), 'sistema');

  inseridos := v_ins;
  ja_existentes := v_exi;
  reaproveitados_cofre := COALESCE(v_reuso.reaproveitados, 0);
  pre_validados := v_prevalid;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.qa_explodir_checklist_processo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_explodir_checklist_processo(uuid) TO authenticated, service_role;

COMMIT;
