-- =============================================================================
-- BLOCO 4 de 7 — DECLARAÇÕES: habitualidade sai inteira do processo
--
-- Decisões do usuário (07/08/2026):
--   (a) "declaracao_habitualidade_clube, declaracao_compromisso_treino,
--        declaracao_compromisso_habitualidade — excluir todos pois não
--        pertence ao processo."
--   (b) "quero remover do banco de dados e do front end:
--        comprovante_habitualidade e comprovante_clube_tiro,
--        pergunta_anexar_habitualidade_cac"
--
-- ─── Estado do CHECK antes deste bloco (pg_get_constraintdef 07/08/2026 08:24) ─
-- declaracao_compromisso_habitualidade: JÁ AUSENTE (removido em 20260807180000).
-- comprovante_habitualidade: presente → removido aqui.
-- comprovante_clube_tiro: presente → removido aqui.
-- Abordagem: DDL direto com lista hardcoded (sem EXECUTE + replace),
-- que é mais confiável em Supabase.
--
-- ─── Efetiva necessidade: um documento, dois nomes ───────────────────────
-- `declaracao_necessidade_efetiva` = `comprovante_efetiva_necessidade` (confirmado).
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1–4) Declarações que não pertencem ao processo ──────────────────────
CREATE TEMP TABLE _fora_do_processo (slug text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _fora_do_processo (slug) VALUES
  ('declaracao_habitualidade_clube'),
  ('declaracao_compromisso_treino'),
  ('declaracao_compromisso_habitualidade');

UPDATE public.qa_servicos_documentos sd
   SET ativo = false, updated_at = now()
  FROM _fora_do_processo f
 WHERE sd.tipo_documento = f.slug;

UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Exigência removida: este documento não pertence ao processo.',
       updated_at = now()
  FROM _fora_do_processo f, public.qa_processos p
 WHERE pd.tipo_documento = f.slug
   AND p.id = pd.processo_id
   AND pd.status NOT IN ('aprovado','nao_aplicavel')
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado');

DELETE FROM public.qa_documentos_biblioteca b
 USING _fora_do_processo f
 WHERE b.codigo = f.slug;

DELETE FROM public.qa_tipo_documento_aliases a
 USING _fora_do_processo f
 WHERE a.processo_tipo = f.slug OR a.hub_tipo = f.slug;

-- ─── 5) Guard: declaracao_compromisso_habitualidade já não está no CHECK ──
-- Já foi removido pela migration 20260807180000. Apenas confirma zero docs.
DO $$
DECLARE v_qtd bigint;
BEGIN
  SELECT count(*) INTO v_qtd FROM public.qa_documentos_cliente
   WHERE tipo_documento = 'declaracao_compromisso_habitualidade';
  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % doc(s) com tipo declaracao_compromisso_habitualidade no Hub. '
      'Reclassifique antes de continuar.', v_qtd;
  END IF;
  RAISE NOTICE 'declaracao_compromisso_habitualidade: 0 doc(s) no Hub. OK.';
END $$;

-- ─── 6) declaracao_necessidade_efetiva → comprovante_efetiva_necessidade ──
UPDATE public.qa_processo_documentos pd
   SET tipo_documento = 'comprovante_efetiva_necessidade',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Slug normalizado: declaracao_necessidade_efetiva → comprovante_efetiva_necessidade.',
       updated_at = now()
  FROM public.qa_processos p
 WHERE pd.processo_id = p.id
   AND pd.tipo_documento = 'declaracao_necessidade_efetiva'
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado')
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_processo_documentos x
      WHERE x.processo_id = pd.processo_id
        AND x.tipo_documento = 'comprovante_efetiva_necessidade'
   );

UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Duplicata: comprovante_efetiva_necessidade já existe neste processo.',
       updated_at = now()
  FROM public.qa_processos p
 WHERE pd.processo_id = p.id
   AND pd.tipo_documento = 'declaracao_necessidade_efetiva'
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado')
   AND pd.status NOT IN ('aprovado','nao_aplicavel');

UPDATE public.qa_servicos_documentos sd
   SET tipo_documento = 'comprovante_efetiva_necessidade',
       biblioteca_id  = COALESCE(
         (SELECT b.id FROM public.qa_documentos_biblioteca b
           WHERE b.codigo = 'comprovante_efetiva_necessidade'),
         sd.biblioteca_id),
       updated_at = now()
 WHERE sd.tipo_documento = 'declaracao_necessidade_efetiva'
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_servicos_documentos x
      WHERE x.servico_id = sd.servico_id
        AND x.tipo_documento = 'comprovante_efetiva_necessidade'
        AND COALESCE(x.condicao_profissional,'') = COALESCE(sd.condicao_profissional,'')
   );

UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE tipo_documento = 'declaracao_necessidade_efetiva';

UPDATE public.qa_documentos_biblioteca
   SET codigo = 'comprovante_efetiva_necessidade', updated_at = now()
 WHERE codigo = 'declaracao_necessidade_efetiva'
   AND NOT EXISTS (SELECT 1 FROM public.qa_documentos_biblioteca y
                    WHERE y.codigo = 'comprovante_efetiva_necessidade');

UPDATE public.qa_documentos_biblioteca
   SET ativo = false, updated_at = now()
 WHERE codigo = 'declaracao_necessidade_efetiva';

-- O apelido permanece: processo encerrado mantém o slug da época.

-- ─── 7) comprovante_habitualidade, comprovante_clube_tiro e ──────────────
--         pergunta_anexar_habitualidade_cac saem do processo
CREATE TEMP TABLE _fora_hab (slug text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _fora_hab (slug) VALUES
  ('comprovante_habitualidade'),
  ('comprovante_clube_tiro'),
  ('pergunta_anexar_habitualidade_cac');

UPDATE public.qa_servicos_documentos sd
   SET ativo = false, updated_at = now()
  FROM _fora_hab f
 WHERE sd.tipo_documento = f.slug;

UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Exigência removida: este documento não pertence ao processo.',
       updated_at = now()
  FROM _fora_hab f, public.qa_processos p
 WHERE pd.tipo_documento = f.slug
   AND p.id = pd.processo_id
   AND pd.status NOT IN ('aprovado','nao_aplicavel')
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado');

DELETE FROM public.qa_documentos_biblioteca b
 USING _fora_hab f
 WHERE b.codigo = f.slug;

DELETE FROM public.qa_tipo_documento_aliases a
 USING _fora_hab f
 WHERE a.processo_tipo = f.slug OR a.hub_tipo = f.slug;

-- ─── 8) comprovante_habitualidade e comprovante_clube_tiro saem do CHECK ──
-- Guard: aborta se qualquer doc no Hub ainda usar esses tipos.
-- DDL direto (sem EXECUTE + replace) — lista hardcoded do estado real do
-- banco em 07/08/2026 08:24, com os dois tipos removidos.
DO $$
DECLARE v_qtd bigint;
BEGIN
  SELECT count(*) INTO v_qtd FROM public.qa_documentos_cliente
   WHERE tipo_documento = 'comprovante_habitualidade';
  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % doc(s) com tipo comprovante_habitualidade no Hub. '
      'Reclassifique antes de remover da constraint.', v_qtd;
  END IF;

  SELECT count(*) INTO v_qtd FROM public.qa_documentos_cliente
   WHERE tipo_documento = 'comprovante_clube_tiro';
  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % doc(s) com tipo comprovante_clube_tiro no Hub. '
      'Reclassifique antes de remover da constraint.', v_qtd;
  END IF;

  RAISE NOTICE 'Guards OK: 0 doc(s) com comprovante_habitualidade e comprovante_clube_tiro no Hub.';
END $$;

-- Guard geral: qualquer tipo no Hub que não conste da lista nova faria o
-- ALTER falhar com 23514 (erro genérico, sem dizer qual valor). Este bloco
-- nomeia o(s) valor(es) causador(es) antes de tentar, para não haver mais
-- tentativa às cegas.
DO $$
DECLARE v_ofensores text;
BEGIN
  SELECT string_agg(DISTINCT tipo_documento, ', ') INTO v_ofensores
    FROM public.qa_documentos_cliente
   WHERE tipo_documento <> ALL (ARRAY[
     'rg_com_cpf','cin','cnh','certidao_alteracao_nome','comprovante_residencia',
     'declaracao_responsavel_imovel','documento_identificacao_terceiro','ctps',
     'renda_holerite_mes_atual','renda_holerite_funcionario_publico','renda_carteira_funcional',
     'renda_cartao_cnpj','renda_qsa','renda_contrato_social','renda_ccmei','renda_cnpj_autonomo',
     'renda_comprovante_beneficio','renda_extrato_inss','antecedentes_criminais','antecedentes_federal',
     'antecedentes_estadual','antecedentes_federal_trf3_regional','antecedentes_federal_sjsp_jef',
     'antecedentes_estadual_distribuicao','antecedentes_estadual_execucoes','antecedentes_militar',
     'antecedentes_eleitoral','declaracao_sem_inquerito_processo_criminal','declaracao_guarda_responsavel',
     'declaracao_correlata','declaracao_guarda_acervo_1endereco','declaracao_guarda_acervo_2enderecos',
     'declaracao_endereco_acervo','dsa_declaracao_seguranca_acervo','declaracao_nao_possuir_segundo_endereco',
     'declaracao_homonimia','laudo_psicologico','laudo_capacidade_tecnica','comprovante_efetiva_necessidade',
     'documento_complementar_caso','cr','craf','sinarm','gt','gte','autorizacao_compra','nota_fiscal_arma',
     'habilitacao_cacador_ibama','comprovante_competicao','comprovante_pagamento',
     'requerimento_de_posse_de_arma_de_fogo','protocolo_processo','oficio','despacho','exigencia',
     'indeferimento','procuracao','procuracao_assinada','contrato_assinado','recurso_administrativo_doc',
     'mandado_seguranca_doc','outro','renda_nf_empresa','renda_contra_cheque_mes_atual','boletim_ocorrencia',
     'foto_3x4','renda_ficha_cadastral_jucesp','antecedentes_militar_estadual'
   ]);

  IF v_ofensores IS NOT NULL THEN
    RAISE EXCEPTION
      'Abortado: documento(s) no Hub com tipo(s) fora da nova lista do CHECK: %. '
      'Inclua esse(s) tipo(s) na lista ou reclassifique os documentos antes de continuar.',
      v_ofensores;
  END IF;

  RAISE NOTICE 'Guard geral OK: todo tipo_documento do Hub está coberto pela nova lista.';
END $$;

ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check
  CHECK (tipo_documento = ANY (ARRAY[
    'rg_com_cpf'::text,
    'cin'::text,
    'cnh'::text,
    'certidao_alteracao_nome'::text,
    'comprovante_residencia'::text,
    'declaracao_responsavel_imovel'::text,
    'documento_identificacao_terceiro'::text,
    'ctps'::text,
    'renda_holerite_mes_atual'::text,
    'renda_holerite_funcionario_publico'::text,
    'renda_carteira_funcional'::text,
    'renda_cartao_cnpj'::text,
    'renda_qsa'::text,
    'renda_contrato_social'::text,
    'renda_ccmei'::text,
    'renda_cnpj_autonomo'::text,
    'renda_comprovante_beneficio'::text,
    'renda_extrato_inss'::text,
    'antecedentes_criminais'::text,
    'antecedentes_federal'::text,
    'antecedentes_estadual'::text,
    'antecedentes_federal_trf3_regional'::text,
    'antecedentes_federal_sjsp_jef'::text,
    'antecedentes_estadual_distribuicao'::text,
    'antecedentes_estadual_execucoes'::text,
    'antecedentes_militar'::text,
    'antecedentes_eleitoral'::text,
    'declaracao_sem_inquerito_processo_criminal'::text,
    'declaracao_guarda_responsavel'::text,
    'declaracao_correlata'::text,
    'declaracao_guarda_acervo_1endereco'::text,
    'declaracao_guarda_acervo_2enderecos'::text,
    'declaracao_endereco_acervo'::text,
    'dsa_declaracao_seguranca_acervo'::text,
    'declaracao_nao_possuir_segundo_endereco'::text,
    'declaracao_homonimia'::text,
    'laudo_psicologico'::text,
    'laudo_capacidade_tecnica'::text,
    'comprovante_efetiva_necessidade'::text,
    'documento_complementar_caso'::text,
    'cr'::text,
    'craf'::text,
    'sinarm'::text,
    'gt'::text,
    'gte'::text,
    'autorizacao_compra'::text,
    'nota_fiscal_arma'::text,
    -- 'comprovante_habitualidade' REMOVIDO — habitualidade não pertence ao processo
    -- 'comprovante_clube_tiro'    REMOVIDO — idem
    'habilitacao_cacador_ibama'::text,
    'comprovante_competicao'::text,
    'comprovante_pagamento'::text,
    'requerimento_de_posse_de_arma_de_fogo'::text,
    'protocolo_processo'::text,
    'oficio'::text,
    'despacho'::text,
    'exigencia'::text,
    'indeferimento'::text,
    'procuracao'::text,
    'procuracao_assinada'::text,
    'contrato_assinado'::text,
    'recurso_administrativo_doc'::text,
    'mandado_seguranca_doc'::text,
    'outro'::text,
    'renda_nf_empresa'::text,
    'renda_contra_cheque_mes_atual'::text,
    'boletim_ocorrencia'::text,
    'foto_3x4'::text,
    'renda_ficha_cadastral_jucesp'::text,
    'antecedentes_militar_estadual'::text
  ]));

-- ─── 9) Reavalia ─────────────────────────────────────────────────────────
SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'bloco4_declaracoes')
  FROM public.qa_processos p
 WHERE COALESCE(p.status, 'ativo') NOT IN ('finalizado','deferido','indeferido','cancelado','arquivado')
   AND EXISTS (
     SELECT 1 FROM public.qa_processo_documentos pd
      WHERE pd.processo_id = p.id
        AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
        AND (pd.tipo_documento LIKE 'declaracao%' OR pd.tipo_documento LIKE 'dsa_%'
          OR pd.tipo_documento = 'comprovante_efetiva_necessidade')
   );

COMMIT;

-- =============================================================================
-- BLOCO 4B — Autorização de Compra/Posse de Arma de Fogo para Defesa Pessoal:
-- remove exigências de documentos que não pertencem a este serviço
--
-- Decisão do usuário (07/08/2026): os tipos abaixo são de outros fluxos —
-- acervo de coleção e CAC (colecionador/atirador/caçador) — e não deveriam
-- ser exigidos no serviço de compra/posse de arma de fogo para defesa pessoal:
--   declaracao_guarda_acervo_1endereco       (acervo de coleção)
--   declaracao_guarda_acervo_2enderecos      (acervo de coleção)
--   declaracao_nao_possuir_segundo_endereco  (acervo de coleção)
--   gte                                      (guia de trânsito especial — CAC)
--   habilitacao_cacador_ibama                (CAC caçador)
--   comprovante_competicao                   (CAC atirador)
--   outro                                    (genérico, sem função neste serviço)
--
-- Os sete tipos continuam válidos no CHECK do Hub — outros serviços/processos
-- (CAC, acervo) seguem usando-os. Este bloco só os tira do CATÁLOGO e das
-- EXIGÊNCIAS do serviço "Autorização de Compra/Posse de Arma de Fogo para
-- Defesa Pessoal" especificamente.
--
-- Idempotente.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _tipos_indevidos_defesa_pessoal (slug text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _tipos_indevidos_defesa_pessoal (slug) VALUES
  ('declaracao_guarda_acervo_1endereco'),
  ('declaracao_guarda_acervo_2enderecos'),
  ('declaracao_nao_possuir_segundo_endereco'),
  ('gte'),
  ('habilitacao_cacador_ibama'),
  ('comprovante_competicao'),
  ('outro');

-- Catálogo do serviço deixa de exigir estes tipos
UPDATE public.qa_servicos_documentos sd
   SET ativo = false, updated_at = now()
  FROM _tipos_indevidos_defesa_pessoal t, public.qa_servicos s
 WHERE sd.tipo_documento = t.slug
   AND sd.servico_id = s.id
   AND s.nome_servico = 'Autorização de Compra/Posse de Arma de Fogo para Defesa Pessoal';

-- Exigências abertas em processos ativos deste serviço encerram
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Exigência removida: este documento não pertence ao serviço de defesa pessoal.',
       updated_at = now()
  FROM _tipos_indevidos_defesa_pessoal t, public.qa_processos p, public.qa_servicos s
 WHERE pd.tipo_documento = t.slug
   AND p.id = pd.processo_id
   AND p.servico_id = s.id
   AND s.nome_servico = 'Autorização de Compra/Posse de Arma de Fogo para Defesa Pessoal'
   AND pd.status NOT IN ('aprovado','nao_aplicavel')
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado');

COMMIT;
