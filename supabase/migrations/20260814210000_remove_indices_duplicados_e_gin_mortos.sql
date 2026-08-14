-- =============================================================================
-- LIMPEZA: 14 indices duplicados + 2 GIN sem consumidor
--
-- Origem: diagnostico no banco vivo em 14/08/2026, com estatisticas de 128
-- dias acumulados (stats_reset em 08/04) — "0 usos" aqui e dado, nao ruido.
--
-- ─── Duplicatas (14) ─────────────────────────────────────────────────────
-- Cada linha abaixo tem um gemeo na MESMA coluna que continua no lugar. O que
-- sai e sempre o que NAO sustenta constraint. Nenhuma busca perde indice.
--
-- ─── Os dois GIN (2) ─────────────────────────────────────────────────────
-- `idx_qa_processo_documentos_metadados_gin` (1928 kB) e
-- `idx_qa_documentos_cliente_metadados_gin` (48 kB) nunca foram usados, e nao
-- por acaso: GIN atende operador de contencao (@>, ?), e o app consulta esses
-- JSONB por extracao de texto (`metadados_documento_json->>'chave'`), que ja
-- tem indices de EXPRESSAO proprios. Verificado: nenhum @> sobre essas colunas
-- em migration, funcao ou codigo.
--
-- GIN e dos indices mais caros de manter. `qa_processo_documentos` e escrita a
-- cada upload, validacao de IA e mudanca de status — pagava por ele em toda
-- escrita, ha 128 dias, sem nunca ler.
--
-- ─── O que NAO esta aqui ─────────────────────────────────────────────────
-- `qa_clientes_id_legado_unique` e `qa_vendas_id_legado_unique`: ha FKs
-- apontando para `id_legado` (fk_qa_contracts_cliente/venda, ON DELETE
-- RESTRICT, entre outras). Uma FK se prende a UM indice unico especifico, e
-- derrubar justo o que ela usa faz o ALTER falhar. Precisa conferir o vinculo
-- (pg_constraint.conindid) antes — fica para um bloco proprio.
--
-- Reexecutavel (IF EXISTS).
-- =============================================================================

BEGIN;

-- ─── 1) Duplicatas: o gemeo permanece ────────────────────────────────────
DROP INDEX IF EXISTS public.idx_cliente_auth_links_qa_cliente_id;
DROP INDEX IF EXISTS public.idx_cliente_auth_links_user_id;
DROP INDEX IF EXISTS public.idx_cms_pages_slug;
DROP INDEX IF EXISTS public.idx_cms_redirects_from;
DROP INDEX IF EXISTS public.idx_unsubscribe_tokens_token;
DROP INDEX IF EXISTS public.qa_acervo_alertas_enviados_cli_idx;
DROP INDEX IF EXISTS public.qa_doc_incompat_alertas_cli_idx;
DROP INDEX IF EXISTS public.qa_gte_consist_alertas_cli_idx;
DROP INDEX IF EXISTS public.idx_qa_homologacao_sessoes_codigo;
DROP INDEX IF EXISTS public.qa_itens_venda_venda_id_idx;
DROP INDEX IF EXISTS public.idx_qa_monit_cfg_key;
DROP INDEX IF EXISTS public.idx_qa_servicos_com_exame_servico_id;
DROP INDEX IF EXISTS public.qa_vendas_cliente_id_idx;
DROP INDEX IF EXISTS public.idx_suppressed_emails_email;

-- ─── 2) GIN sem consumidor ───────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_qa_processo_documentos_metadados_gin;
DROP INDEX IF EXISTS public.idx_qa_documentos_cliente_metadados_gin;

COMMIT;
