-- =============================================================================
-- INDICES: as 17 FKs orfas + a busca de credenciado IAT
--
-- Origem: diagnostico rodado no banco vivo em 14/08/2026.
--
-- ─── 1) qa_iat_credenciados (uf, nome) — o unico achado de performance ───
-- 145.780 varreduras sequenciais numa tabela de 2.626 linhas.
--
-- `qa-iat-credenciados-buscar` filtra SEMPRE por `.eq("uf", uf)` e ordena por
-- `nome`. O unico indice que tocava `uf` era PARCIAL:
--     (uf, id) WHERE lat IS NULL AND geocode_falhou IS NOT TRUE AND ...
-- ou seja, so cobria linha pendente de geocodificacao. A busca nao carrega
-- essa condicao, entao o planner nao podia usa-lo e varria a tabela inteira a
-- cada consulta. O indice composto (uf, nome) atende filtro e ordenacao.
--
-- ─── 2) As 17 chaves estrangeiras sem indice ─────────────────────────────
-- FK sem indice cobra em dois momentos: no JOIN e, pior, no DELETE/UPDATE da
-- linha PAI — o Postgres varre a tabela FILHA inteira para cada linha do pai.
-- Todas as tabelas envolvidas sao pequenas ou medias, entao o custo de manter
-- o indice e irrisorio perto do risco.
--
-- Idempotente (IF NOT EXISTS). Nao remove nada.
-- =============================================================================

BEGIN;

-- ─── 1) Busca de credenciado IAT ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qa_iat_credenciados_uf_nome
  ON public.qa_iat_credenciados (uf, nome);

-- ─── 2) FKs orfas ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qa_branding_updated_by
  ON public.qa_branding (updated_by);

CREATE INDEX IF NOT EXISTS idx_qa_chat_mensagens_aprovada_por
  ON public.qa_chat_mensagens (aprovada_por);

CREATE INDEX IF NOT EXISTS idx_qa_chat_mensagens_doc_kb_id
  ON public.qa_chat_mensagens (doc_kb_id);

CREATE INDEX IF NOT EXISTS idx_qa_cliente_credenciais_audit_credencial_id
  ON public.qa_cliente_credenciais_audit (credencial_id);

CREATE INDEX IF NOT EXISTS idx_qa_clientes_clube_atual_id
  ON public.qa_clientes (clube_atual_id);

CREATE INDEX IF NOT EXISTS idx_qa_competencia_materia_fonte_normativa_id
  ON public.qa_competencia_materia (fonte_normativa_id);

CREATE INDEX IF NOT EXISTS idx_qa_contracts_template_id
  ON public.qa_contracts (template_id);

CREATE INDEX IF NOT EXISTS idx_qa_document_examples_servico_id
  ON public.qa_document_examples (servico_id);

CREATE INDEX IF NOT EXISTS idx_qa_filiacao_alertas_enviados_filiacao_id
  ON public.qa_filiacao_alertas_enviados (filiacao_id);

CREATE INDEX IF NOT EXISTS idx_qa_kb_article_reviews_screenshot_id
  ON public.qa_kb_article_reviews (screenshot_id);

CREATE INDEX IF NOT EXISTS idx_qa_notificacoes_cliente_criado_por
  ON public.qa_notificacoes_cliente (criado_por);

CREATE INDEX IF NOT EXISTS idx_qa_processo_documentos_modelo_aprovado_id
  ON public.qa_processo_documentos (modelo_aprovado_id);

CREATE INDEX IF NOT EXISTS idx_qa_processo_eventos_documento_id
  ON public.qa_processo_eventos (documento_id);

CREATE INDEX IF NOT EXISTS idx_qa_procuracoes_reaproveitada_de
  ON public.qa_procuracoes (reaproveitada_de);

CREATE INDEX IF NOT EXISTS idx_qa_procuracoes_template_id
  ON public.qa_procuracoes (template_id);

CREATE INDEX IF NOT EXISTS idx_qa_servicos_catalogo_servico_id
  ON public.qa_servicos_catalogo (servico_id);

CREATE INDEX IF NOT EXISTS idx_qa_tipos_documento_servicos_tipo_documento
  ON public.qa_tipos_documento_servicos (tipo_documento);

COMMIT;
