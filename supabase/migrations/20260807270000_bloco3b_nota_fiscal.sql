-- =============================================================================
-- BLOCO 3B de 7 — RENDA: a nota fiscal deixa de precisar ser "recente"
--
-- Decisão do usuário (07/08/2026): "renda_nf_recente não existe. Deve ser
-- substituída por renda_nf_empresa pois a nota fiscal não precisa ser recente."
--
-- O nome antigo embutia uma regra que não existe. Slug que afirma exigência
-- falsa é pior do que slug feio: alguém lê "recente", conclui que há prazo, e
-- passa a reprovar nota fiscal válida.
--
-- Direção INVERTIDA em relação ao que eu havia escrito no Bloco 3. Lá o rename
-- era `renda_nf_empresa → renda_nf_recente`, porque o apelido de 18/06 apontava
-- nessa direção e o CHECK só conhecia `renda_nf_recente`. Estava indo para o
-- lado errado — e o usuário pegou antes de rodar.
--
-- ─── Nomes exibidos ──────────────────────────────────────────────────────
-- O catálogo e a biblioteca recebem 'Nota Fiscal da Empresa'.
--
-- As exigências JÁ MONTADAS ficam com o nome que têm. Não é descuido:
-- `qa_explodir_checklist_processo` acrescenta a profissão ao nome de todo slug
-- `renda_*` ("Nota Fiscal — ELETRICISTA"), e sobrescrever com texto fixo
-- apagaria esse sufixo. Só o tipo é renomeado. Se sobrar a palavra "recente"
-- em algum nome já montado, corrige-se depois com um replace pontual, sem
-- perder a profissão.
--
-- ─── Validade ────────────────────────────────────────────────────────────
-- `validade_dias` vai a NULL nas duas tabelas: se a nota não precisa ser
-- recente, não pode haver prazo de validade contando contra ela.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) O tipo novo entra no CHECK ───────────────────────────────────────
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Constraint qa_doc_cliente_tipo_check não encontrada.';
  ELSIF v_def LIKE '%renda_nf_empresa%' THEN
    RAISE NOTICE 'renda_nf_empresa já consta do CHECK.';
  ELSE
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE replace(
      'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def,
      '''outro''::text',
      '''outro''::text, ''renda_nf_empresa''::text'
    );
  END IF;
END $$;

-- ─── 2) Exigências dos processos em andamento ────────────────────────────
UPDATE public.qa_processo_documentos pd
   SET tipo_documento = 'renda_nf_empresa',
       validade_dias  = NULL,
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Slug normalizado: renda_nf_recente → renda_nf_empresa. A nota fiscal não precisa ser recente.',
       updated_at = now()
  FROM public.qa_processos p
 WHERE pd.processo_id = p.id
   AND pd.tipo_documento = 'renda_nf_recente'
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado')
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_processo_documentos x
      WHERE x.processo_id = pd.processo_id AND x.tipo_documento = 'renda_nf_empresa'
   );

UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Duplicata: renda_nf_empresa já existe neste processo.',
       updated_at = now()
  FROM public.qa_processos p
 WHERE pd.processo_id = p.id
   AND pd.tipo_documento = 'renda_nf_recente'
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado')
   AND pd.status NOT IN ('aprovado','nao_aplicavel');

-- ─── 3) Catálogo ─────────────────────────────────────────────────────────
UPDATE public.qa_servicos_documentos sd
   SET tipo_documento = 'renda_nf_empresa',
       nome_documento = 'Nota Fiscal da Empresa',
       validade_dias  = NULL,
       updated_at     = now()
 WHERE sd.tipo_documento = 'renda_nf_recente'
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_servicos_documentos x
      WHERE x.servico_id = sd.servico_id
        AND x.tipo_documento = 'renda_nf_empresa'
        AND COALESCE(x.condicao_profissional,'') = COALESCE(sd.condicao_profissional,'')
   );

UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE tipo_documento = 'renda_nf_recente';

-- As linhas que já eram renda_nf_empresa também perdem o prazo.
UPDATE public.qa_servicos_documentos
   SET nome_documento = 'Nota Fiscal da Empresa',
       validade_dias  = NULL,
       updated_at     = now()
 WHERE tipo_documento = 'renda_nf_empresa';

-- ─── 4) Biblioteca ───────────────────────────────────────────────────────
UPDATE public.qa_documentos_biblioteca
   SET codigo = 'renda_nf_empresa', updated_at = now()
 WHERE codigo = 'renda_nf_recente'
   AND NOT EXISTS (SELECT 1 FROM public.qa_documentos_biblioteca y WHERE y.codigo = 'renda_nf_empresa');

UPDATE public.qa_documentos_biblioteca
   SET ativo = false, updated_at = now()
 WHERE codigo = 'renda_nf_recente';

UPDATE public.qa_documentos_biblioteca
   SET nome = 'Nota Fiscal da Empresa',
       validade_dias = NULL,
       observacao_cliente = 'A nota fiscal não precisa ser recente — não há prazo de validade para este documento.',
       ativo = true,
       updated_at = now()
 WHERE codigo = 'renda_nf_empresa';

-- ─── 5) Apelidos ─────────────────────────────────────────────────────────
-- O apelido de 18/06 apontava para o lado que agora deixa de existir.
DELETE FROM public.qa_tipo_documento_aliases
 WHERE processo_tipo = 'renda_nf_empresa' AND hub_tipo = 'renda_nf_recente';

-- Sentido inverso, para exigência de processo ENCERRADO que mantém o slug
-- antigo continuar fechando com o documento novo.
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('renda_nf_recente', 'renda_nf_empresa')
ON CONFLICT DO NOTHING;

-- ─── 6) renda_nf_recente sai do CHECK ────────────────────────────────────
DO $$
DECLARE
  v_def text;
  v_qtd bigint;
BEGIN
  SELECT count(*) INTO v_qtd
    FROM public.qa_documentos_cliente WHERE tipo_documento = 'renda_nf_recente';

  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % documento(s) com tipo renda_nf_recente no Hub. '
      'Reclassifique para renda_nf_empresa antes de remover o tipo.', v_qtd;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  IF v_def NOT LIKE '%''renda_nf_recente''::text%' THEN
    RAISE NOTICE 'renda_nf_recente já não consta do CHECK.';
  ELSE
    v_def := replace(v_def, '''renda_nf_recente''::text, ', '');
    v_def := replace(v_def, ', ''renda_nf_recente''::text', '');
    IF v_def LIKE '%''renda_nf_recente''::text%' THEN
      RAISE EXCEPTION 'Não consegui remover renda_nf_recente do CHECK — formato inesperado.';
    END IF;
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def;
  END IF;
END $$;

-- ─── 7) Reavalia ─────────────────────────────────────────────────────────
SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'bloco3b_nota_fiscal')
  FROM public.qa_processos p
 WHERE COALESCE(p.status, 'ativo') NOT IN ('finalizado','deferido','indeferido','cancelado','arquivado')
   AND EXISTS (
     SELECT 1 FROM public.qa_processo_documentos pd
      WHERE pd.processo_id = p.id
        AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
        AND pd.tipo_documento IN ('renda_nf_empresa','renda_nf_recente')
   );

COMMIT;
