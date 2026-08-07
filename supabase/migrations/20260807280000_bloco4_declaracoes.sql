-- =============================================================================
-- BLOCO 4 de 7 — DECLARAÇÕES: habitualidade e treino saem do processo
--
-- Decisão do usuário (07/08/2026): "declaracao_habitualidade_clube,
-- declaracao_compromisso_treino, declaracao_compromisso_habitualidade —
-- excluir todos pois não pertence ao processo."
--
-- Os três não são documento próprio nem viram outra coisa: a exigência
-- simplesmente não existe neste fluxo. Isso encerra também a discussão de
-- 07/08 sobre fundir `declaracao_compromisso_habitualidade` com
-- `comprovante_habitualidade` — não se funde o que não é para ser pedido.
--
-- ─── O que sai ───────────────────────────────────────────────────────────
--   declaracao_habitualidade_clube        4 catálogo · 3 processos · fora do CHECK
--   declaracao_compromisso_treino         3 catálogo · 3 processos · fora do CHECK
--   declaracao_compromisso_habitualidade  2 catálogo · 3 processos · NO CHECK
--
-- Só o terceiro é tipo do Hub, e por isso é o único que exige mexer na
-- constraint. Nenhum documento de declaração existe no Hub hoje — o
-- levantamento voltou zero linhas para todas —, então a remoção é limpa. A
-- guarda confere isso mesmo assim.
--
-- ─── O que NÃO sai, e por quê ────────────────────────────────────────────
-- `comprovante_habitualidade` e `comprovante_clube_tiro` permanecem no CHECK.
-- Não foram citados, têm ZERO linha de catálogo — ninguém os pede — e tirar
-- tipo sem uso que o usuário não mandou tirar é decidir no lugar dele.
--
-- `pergunta_anexar_habitualidade_cac` (1 linha de catálogo) fica para o
-- Bloco 5, junto com os demais `pergunta_*`. Fica o registro: se a
-- habitualidade não pertence ao processo, uma pergunta que oferece anexá-la
-- provavelmente também não — mas isso é decisão do usuário, não dedução minha.
--
-- ─── Ainda em aberto ─────────────────────────────────────────────────────
-- `declaracao_necessidade_efetiva` (1 catálogo · 5 processos ativos) segue
-- fora deste bloco até se saber se é o mesmo documento que
-- `comprovante_efetiva_necessidade` ou peça distinta.
--
-- Idempotente.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _fora_do_processo (slug text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _fora_do_processo (slug) VALUES
  ('declaracao_habitualidade_clube'),
  ('declaracao_compromisso_treino'),
  ('declaracao_compromisso_habitualidade');

-- ─── 1) Catálogo deixa de emitir ─────────────────────────────────────────
UPDATE public.qa_servicos_documentos sd
   SET ativo = false, updated_at = now()
  FROM _fora_do_processo f
 WHERE sd.tipo_documento = f.slug;

-- ─── 2) Exigências em aberto encerram ────────────────────────────────────
-- nao_aplicavel, não apagado: a linha é histórico do processo e o status já
-- conta como cumprido, então sai da contagem de pendências do cliente.
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

-- ─── 3) Biblioteca ───────────────────────────────────────────────────────
DELETE FROM public.qa_documentos_biblioteca b
 USING _fora_do_processo f
 WHERE b.codigo = f.slug;

-- ─── 4) Apelidos ─────────────────────────────────────────────────────────
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

COMMIT;
