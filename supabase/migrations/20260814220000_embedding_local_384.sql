-- =============================================================================
-- EMBEDDING LOCAL: a coluna passa de vector(768) para vector(384)
--
-- Decisao do usuario (14/08/2026): usar o modelo embutido do Supabase
-- (gte-small, 384 dimensoes) em vez de contratar servico externo. Sem chave,
-- sem cartao, roda dentro da propria edge function.
--
-- Por que da para mexer sem medo: a coluna esta VAZIA. Medido no banco vivo —
-- 20 modelos aprovados, 0 com embedding_texto. Nada a migrar, nada a perder.
-- Ainda assim o bloco 1 aborta se encontrar qualquer valor preenchido.
--
-- ─── Por que o indice vetorial NAO volta ─────────────────────────────────
-- `idx_qa_modelos_embedding_cos` era ivfflat com lists=100 numa tabela de 20
-- linhas — 100 gavetas para 20 fichas. O Postgres nunca o usou (0 acessos em
-- 128 dias) e estava certo: varrer 20 linhas e mais rapido. Ele sai aqui porque
-- a mudanca de tipo exige, e nao volta por enquanto.
--
-- Recrie quando a tabela passar de ~1.000 modelos, com lists = linhas/1000:
--   CREATE INDEX idx_qa_modelos_embedding_cos
--     ON public.qa_documentos_modelos_aprovados
--     USING ivfflat (embedding_texto vector_cosine_ops) WITH (lists = 10);
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) Guard: so prossegue se a coluna estiver realmente vazia ──────────
DO $$
DECLARE v_preenchidos bigint;
BEGIN
  SELECT count(*) INTO v_preenchidos
    FROM public.qa_documentos_modelos_aprovados
   WHERE embedding_texto IS NOT NULL;

  IF v_preenchidos > 0 THEN
    RAISE EXCEPTION
      'Abortado: % modelo(s) ja tem embedding_texto. Trocar a dimensao apagaria '
      'esses vetores. Confira antes de continuar.', v_preenchidos;
  END IF;

  RAISE NOTICE 'Guard OK: nenhum embedding preenchido, seguro trocar a dimensao.';
END $$;

-- ─── 2) O indice sai (a troca de tipo exige) ─────────────────────────────
DROP INDEX IF EXISTS public.idx_qa_modelos_embedding_cos;

-- ─── 3) 768 -> 384 ───────────────────────────────────────────────────────
ALTER TABLE public.qa_documentos_modelos_aprovados
  ALTER COLUMN embedding_texto TYPE vector(384);

COMMENT ON COLUMN public.qa_documentos_modelos_aprovados.embedding_texto IS
  'Embedding gte-small (384 dim) gerado LOCALMENTE pelo runtime do Supabase. '
  'Ver supabase/functions/_shared/embedding.ts. Nunca preencher com vetor de '
  'outra origem sem alinhar a dimensao aqui e na RPC match_qa_modelos_aprovados.';

-- ─── 4) A RPC passa a aceitar 384 ────────────────────────────────────────
-- O typmod (768/384) nao faz parte da assinatura da funcao, entao CREATE OR
-- REPLACE substitui a versao antiga sem precisar de DROP.
CREATE OR REPLACE FUNCTION public.match_qa_modelos_aprovados(
  query_embedding vector(384),
  filtro_tipo TEXT,
  match_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  tipo_documento TEXT,
  nome_modelo TEXT,
  origem_emissora TEXT,
  similaridade NUMERIC,
  palavras_chave_json JSONB,
  campos_esperados_json JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.tipo_documento,
    m.nome_modelo,
    m.origem_emissora,
    (1 - (m.embedding_texto <=> query_embedding))::numeric AS similaridade,
    m.palavras_chave_json,
    m.campos_esperados_json
  FROM public.qa_documentos_modelos_aprovados m
  WHERE m.ativo = true
    AND m.embedding_texto IS NOT NULL
    AND (filtro_tipo IS NULL OR m.tipo_documento = filtro_tipo)
  ORDER BY m.embedding_texto <=> query_embedding ASC
  LIMIT GREATEST(match_limit, 1);
$$;

COMMIT;
