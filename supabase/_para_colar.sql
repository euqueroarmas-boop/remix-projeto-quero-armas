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
-- O conceito de habitualidade não pertence a este fluxo: declarações,
-- comprovantes e perguntas sobre ele saem juntos. Isso encerra também
-- a discussão de 07/08 sobre fundir `declaracao_compromisso_habitualidade`
-- com `comprovante_habitualidade` — não se funde o que não é para ser pedido.
--
-- ─── O que sai ───────────────────────────────────────────────────────────
--   declaracao_habitualidade_clube        4 catálogo · 3 processos · fora do CHECK
--   declaracao_compromisso_treino         3 catálogo · 3 processos · fora do CHECK
--   declaracao_compromisso_habitualidade  2 catálogo · 3 processos · no CHECK
--   comprovante_habitualidade             0 catálogo · ? processos · no CHECK
--   comprovante_clube_tiro                0 catálogo · ? processos · no CHECK
--   pergunta_anexar_habitualidade_cac     1 catálogo · ? processos · fora do CHECK
--
-- Os três primeiros não são documento próprio nem viram outra coisa.
-- Os dois comprovantes têm zero catálogo e zero uso — ninguém os pede.
-- A pergunta oferecia anexar o que não é mais exigido.
--
-- ─── Efetiva necessidade: um documento, dois nomes ───────────────────────
-- Confirmado pelo usuário: `declaracao_necessidade_efetiva` é o MESMO
-- documento que `comprovante_efetiva_necessidade`. O primeiro nunca foi tipo
-- do Hub — 1 linha de catálogo e 5 exigências ativas apontando para um slug
-- que só existia do lado do processo. Passa a usar o nome do Hub, e o
-- casamento vira identidade.
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

-- Catálogo deixa de emitir
UPDATE public.qa_servicos_documentos sd
   SET ativo = false, updated_at = now()
  FROM _fora_do_processo f
 WHERE sd.tipo_documento = f.slug;

-- Exigências em aberto encerram
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

-- Biblioteca
DELETE FROM public.qa_documentos_biblioteca b
 USING _fora_do_processo f
 WHERE b.codigo = f.slug;

-- Apelidos
DELETE FROM public.qa_tipo_documento_aliases a
 USING _fora_do_processo f
 WHERE a.processo_tipo = f.slug OR a.hub_tipo = f.slug;

-- ─── 5) declaracao_compromisso_habitualidade sai do CHECK ────────────────
-- É o único dos três que é tipo do Hub.
DO $$
DECLARE
  v_def text;
  v_qtd bigint;
BEGIN
  SELECT count(*) INTO v_qtd
    FROM public.qa_documentos_cliente
   WHERE tipo_documento = 'declaracao_compromisso_habitualidade';

  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % documento(s) com tipo declaracao_compromisso_habitualidade no Hub. '
      'Reclassifique antes de remover o tipo da constraint.', v_qtd;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  IF v_def NOT LIKE '%declaracao_compromisso_habitualidade%' THEN
    RAISE NOTICE 'declaracao_compromisso_habitualidade já não consta do CHECK.';
  ELSE
    v_def := replace(v_def, '''declaracao_compromisso_habitualidade''::text, ', '');
    v_def := replace(v_def, ', ''declaracao_compromisso_habitualidade''::text', '');
    IF v_def LIKE '%declaracao_compromisso_habitualidade%' THEN
      RAISE EXCEPTION 'Não consegui remover o tipo do CHECK — formato inesperado.';
    END IF;
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def;
  END IF;
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

-- O apelido permanece: processo encerrado mantém o slug da época e sem ele
-- ficaria órfão.

-- ─── 7) comprovante_habitualidade e comprovante_clube_tiro saem do processo
-- e do Hub (têm zero uso no catálogo; o conceito inteiro não pertence ao fluxo).
-- pergunta_anexar_habitualidade_cac era a pergunta que oferecia anexar o que
-- já não é exigido — sai do catálogo e dos processos, não é tipo do Hub.
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

-- comprovante_habitualidade e comprovante_clube_tiro saem do CHECK
-- (pergunta_anexar_habitualidade_cac nunca foi tipo do Hub)
DO $$
DECLARE
  v_def text;
  v_qtd bigint;
BEGIN
  -- comprovante_habitualidade
  SELECT count(*) INTO v_qtd
    FROM public.qa_documentos_cliente
   WHERE tipo_documento = 'comprovante_habitualidade';
  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % documento(s) com tipo comprovante_habitualidade no Hub. '
      'Reclassifique antes de remover o tipo da constraint.', v_qtd;
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';
  IF v_def NOT LIKE '%comprovante_habitualidade%' THEN
    RAISE NOTICE 'comprovante_habitualidade já não consta do CHECK.';
  ELSE
    v_def := replace(v_def, '''comprovante_habitualidade''::text, ', '');
    v_def := replace(v_def, ', ''comprovante_habitualidade''::text', '');
    IF v_def LIKE '%comprovante_habitualidade%' THEN
      RAISE EXCEPTION 'Não consegui remover comprovante_habitualidade do CHECK — formato inesperado.';
    END IF;
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def;
  END IF;

  -- comprovante_clube_tiro
  SELECT count(*) INTO v_qtd
    FROM public.qa_documentos_cliente
   WHERE tipo_documento = 'comprovante_clube_tiro';
  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % documento(s) com tipo comprovante_clube_tiro no Hub. '
      'Reclassifique antes de remover o tipo da constraint.', v_qtd;
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';
  IF v_def NOT LIKE '%comprovante_clube_tiro%' THEN
    RAISE NOTICE 'comprovante_clube_tiro já não consta do CHECK.';
  ELSE
    v_def := replace(v_def, '''comprovante_clube_tiro''::text, ', '');
    v_def := replace(v_def, ', ''comprovante_clube_tiro''::text', '');
    IF v_def LIKE '%comprovante_clube_tiro%' THEN
      RAISE EXCEPTION 'Não consegui remover comprovante_clube_tiro do CHECK — formato inesperado.';
    END IF;
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def;
  END IF;
END $$;

-- ─── 8) Reavalia ─────────────────────────────────────────────────────────
SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'bloco4_declaracoes')
  FROM public.qa_processos p
 WHERE COALESCE(p.status, 'ativo') NOT IN ('finalizado','deferido','indeferido','cancelado','arquivado')
   AND EXISTS (
     SELECT 1 FROM public.qa_processo_documentos pd
      WHERE pd.processo_id = p.id
        AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
        AND (pd.tipo_documento LIKE 'declaracao%' OR pd.tipo_documento LIKE 'dsa_%'
          OR pd.tipo_documento = 'comprovante_efetiva_necessidade'
          OR pd.tipo_documento IN ('comprovante_habitualidade','comprovante_clube_tiro',
                                    'pergunta_anexar_habitualidade_cac'))
   );

COMMIT;
