-- ============================================================================
-- Modelos de declaração v2 (sem cabeçalho) + link da filiação LNTD
-- ----------------------------------------------------------------------------
-- 1) TROCA DE TEMPLATE PELO NOME, NÃO PELO ARQUIVO. O Storage não sobrescreve
--    arquivo de mesmo nome, e por isso 5 modelos continuavam na versão de maio
--    (com cabeçalho da Quero Armas e, no compromisso, o texto antigo "por
--    calibre"). Em vez de brigar com o delete do bucket, os 5 modelos limpos
--    sobem com sufixo `_v2` — nome novo, upload sem conflito — e este bloco
--    aponta os botões para as chaves novas. Vale para TODOS os serviços que
--    usam essas declarações (posse inclusive) e para os processos em aberto.
--    Os arquivos de maio viram órfãos e podem ser apagados quando quiserem.
--
--    ANTES de rodar: subir os 5 arquivos `_v2.docx` em
--    Storage → qa-templates → declaracoes/. Se rodar antes do upload, o botão
--    "baixar declaração" dá "template não encontrado" até o arquivo subir.
--
-- 2) LINK DA FILIAÇÃO. URL informada pelo titular em 20/08/2026:
--    https://www.liganacionaltirodefensivo.com.br/filiacao-atleta/
--    Entra como link de emissão nos dois passos da filiação do CR — o do
--    boleto (onde o cliente se cadastra) e o da declaração (onde ele volta
--    para baixá-la depois do pagamento reconhecido).
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1a) template_key direto: catálogo e processos em aberto ─────────────────
WITH mapa(antiga, nova) AS (VALUES
  ('declaracao_nao_possuir_segundo_endereco',   'declaracao_nao_possuir_segundo_endereco_v2'),
  ('declaracao_sem_inquerito_processo_criminal','declaracao_sem_inquerito_processo_criminal_v2'),
  ('declaracao_compromisso_habitualidade',      'declaracao_compromisso_habitualidade_v2'),
  ('declaracao_responsavel_imovel_atual',       'declaracao_responsavel_imovel_atual_v2'),
  ('declaracao_responsavel_imovel_passado',     'declaracao_responsavel_imovel_passado_v2')
)
UPDATE public.qa_servicos_documentos sd
   SET regra_validacao = jsonb_set(sd.regra_validacao, '{template_key}', to_jsonb(m.nova)),
       updated_at      = now()
  FROM mapa m
 WHERE sd.regra_validacao ->> 'template_key' = m.antiga;

WITH mapa(antiga, nova) AS (VALUES
  ('declaracao_nao_possuir_segundo_endereco',   'declaracao_nao_possuir_segundo_endereco_v2'),
  ('declaracao_sem_inquerito_processo_criminal','declaracao_sem_inquerito_processo_criminal_v2'),
  ('declaracao_compromisso_habitualidade',      'declaracao_compromisso_habitualidade_v2'),
  ('declaracao_responsavel_imovel_atual',       'declaracao_responsavel_imovel_atual_v2'),
  ('declaracao_responsavel_imovel_passado',     'declaracao_responsavel_imovel_passado_v2')
)
UPDATE public.qa_processo_documentos pd
   SET regra_validacao = jsonb_set(pd.regra_validacao, '{template_key}', to_jsonb(m.nova)),
       updated_at      = now()
  FROM mapa m, public.qa_processos p
 WHERE p.id = pd.processo_id
   AND public.qa_processo_em_aberto(p.status)
   AND pd.regra_validacao ->> 'template_key' = m.antiga;

-- ── 1b) template_quando (declaração do responsável pelo imóvel usa duas
--        variantes dentro de um array) — catálogo e processos em aberto ──────
UPDATE public.qa_servicos_documentos sd
   SET regra_validacao = jsonb_set(sd.regra_validacao, '{template_quando}', (
         SELECT jsonb_agg(
           CASE WHEN elem ->> 'template_key' IN ('declaracao_responsavel_imovel_atual',
                                                 'declaracao_responsavel_imovel_passado')
                THEN jsonb_set(elem, '{template_key}',
                               to_jsonb((elem ->> 'template_key') || '_v2'))
                ELSE elem END)
           FROM jsonb_array_elements(sd.regra_validacao -> 'template_quando') AS elem
       )),
       updated_at = now()
 WHERE jsonb_typeof(sd.regra_validacao -> 'template_quando') = 'array'
   AND sd.regra_validacao::text LIKE '%declaracao_responsavel_imovel_%'
   AND sd.regra_validacao::text NOT LIKE '%_v2%';

UPDATE public.qa_processo_documentos pd
   SET regra_validacao = jsonb_set(pd.regra_validacao, '{template_quando}', (
         SELECT jsonb_agg(
           CASE WHEN elem ->> 'template_key' IN ('declaracao_responsavel_imovel_atual',
                                                 'declaracao_responsavel_imovel_passado')
                THEN jsonb_set(elem, '{template_key}',
                               to_jsonb((elem ->> 'template_key') || '_v2'))
                ELSE elem END)
           FROM jsonb_array_elements(pd.regra_validacao -> 'template_quando') AS elem
       )),
       updated_at = now()
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND public.qa_processo_em_aberto(p.status)
   AND jsonb_typeof(pd.regra_validacao -> 'template_quando') = 'array'
   AND pd.regra_validacao::text LIKE '%declaracao_responsavel_imovel_%'
   AND pd.regra_validacao::text NOT LIKE '%_v2%';

-- ── 2) Link da filiação LNTD nos dois passos do CR ──────────────────────────
UPDATE public.qa_servicos_documentos
   SET link_emissao = 'https://www.liganacionaltirodefensivo.com.br/filiacao-atleta/',
       updated_at   = now()
 WHERE servico_id = 44
   AND tipo_documento IN ('boleto_filiacao_entidade', 'comprovante_filiacao_entidade_tiro');

UPDATE public.qa_processo_documentos pd
   SET link_emissao = 'https://www.liganacionaltirodefensivo.com.br/filiacao-atleta/',
       updated_at   = now()
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND p.servico_id = 44
   AND public.qa_processo_em_aberto(p.status)
   AND pd.tipo_documento IN ('boleto_filiacao_entidade', 'comprovante_filiacao_entidade_tiro');

COMMIT;

-- ── Conferência (uma consulta só) ───────────────────────────────────────────
-- Cruza as chaves apontadas pelos botões com os arquivos do Storage: toda
-- linha do bloco 'chaves' precisa ter par no bloco 'storage' com data de hoje.
--
-- SELECT 'chaves' AS bloco, to_jsonb(t.*) AS dados FROM (
--   SELECT DISTINCT COALESCE(regra_validacao ->> 'template_key',
--                            elem ->> 'template_key') AS template_key
--     FROM public.qa_servicos_documentos sd
--     LEFT JOIN LATERAL jsonb_array_elements(
--       CASE WHEN jsonb_typeof(sd.regra_validacao -> 'template_quando') = 'array'
--            THEN sd.regra_validacao -> 'template_quando' ELSE '[]'::jsonb END) elem ON true
--    WHERE sd.ativo
--      AND COALESCE(regra_validacao ->> 'template_key', elem ->> 'template_key') IS NOT NULL
-- ) t
-- UNION ALL
-- SELECT 'storage', to_jsonb(s.*) FROM (
--   SELECT name, created_at FROM storage.objects
--    WHERE bucket_id = 'qa-templates' AND name LIKE 'declaracoes/%'
--    ORDER BY name
-- ) s;
