-- ============================================================================
-- RLS — 6 clientes não enxergam as próprias vendas e contratos
-- ----------------------------------------------------------------------------
-- MEDIDO NO BANCO (16/08/2026), não deduzido:
--
--   qa_clientes ativos ......... 60, dos quais 6 têm id_legado <> id
--   qa_vendas .................. 82 linhas: 82 casam por id_legado, só 76 por id
--   qa_processos ............... 28 linhas: 28 casam por id (todas)
--
-- Ou seja, as duas tabelas usam convenções DIFERENTES:
--   qa_vendas.cliente_id     → qa_clientes.id_legado   (FK confirma)
--   qa_contracts.cliente_id  → qa_clientes.id_legado   (FK confirma)
--   qa_processos.cliente_id  → qa_clientes.id          (dado confirma)
--
-- Mas TODAS as políticas de dono comparam com `qa_current_cliente_id`, que
-- devolve o id REAL. Para os 54 clientes em que id = id_legado dá no mesmo. Para
-- os 6 em que difere, o cliente logado NÃO VÊ as próprias vendas, os próprios
-- itens de venda nem os próprios contratos. O processo aparece (essa política
-- está certa), o histórico de compras e os contratos não — um sintoma torto o
-- bastante para nunca ter sido reportado como bug de permissão.
--
-- POR QUE ESTA MIGRATION E NÃO A 20260701231000: aquela reescreve TAMBÉM as
-- políticas de qa_processos, qa_processo_documentos e qa_processo_eventos para
-- usar id_legado. Nos dados de hoje essas três estão CERTAS com o id real —
-- aplicá-la cegaria os mesmos 6 clientes do outro lado. Esta aqui mexe só no
-- que está quebrado.
--
-- POR QUE `COALESCE(id_legado, id)` E NÃO `IN (id, id_legado)`: comparar contra
-- os dois valores abriria vazamento. `id` é sequencial e `id_legado` vem do
-- sistema antigo — nada impede o id de um cliente coincidir com o id_legado de
-- outro, e aí um veria as vendas do outro. A chave tem que ser UMA.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- 1) Helper: a chave que as tabelas legadas usam para o cliente logado.
CREATE OR REPLACE FUNCTION public.qa_current_cliente_id_legado(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(c.id_legado, c.id)
    FROM public.qa_clientes c
   WHERE c.id = public.qa_current_cliente_id(_uid)
$$;

REVOKE ALL ON FUNCTION public.qa_current_cliente_id_legado(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.qa_current_cliente_id_legado(uuid) TO authenticated;

-- 2) qa_vendas — dono enxerga a própria venda.
DROP POLICY IF EXISTS qa_vendas_owner_select ON public.qa_vendas;
CREATE POLICY qa_vendas_owner_select ON public.qa_vendas
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id_legado(auth.uid()));

-- 3) qa_itens_venda — a ligação com a venda já tolerava id/id_legado; o que
--    faltava era o lado do cliente. Passa a `authenticated`: estava aberta ao
--    papel `public`, sozinha entre todas as políticas destas tabelas. Não
--    vazava (visitante anônimo não casa com cliente nenhum), mas é uma porta
--    que não tem motivo para ficar destrancada.
DROP POLICY IF EXISTS qa_itens_venda_owner_select ON public.qa_itens_venda;
CREATE POLICY qa_itens_venda_owner_select ON public.qa_itens_venda
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_vendas v
     WHERE COALESCE(v.id_legado, v.id) = qa_itens_venda.venda_id
       AND v.cliente_id = public.qa_current_cliente_id_legado(auth.uid())
  ));

-- 4) qa_contracts — FK aponta para qa_clientes(id_legado).
DROP POLICY IF EXISTS qa_contracts_owner_select ON public.qa_contracts;
CREATE POLICY qa_contracts_owner_select ON public.qa_contracts
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id_legado(auth.uid()));

-- qa_processos, qa_processo_documentos e qa_processo_eventos ficam COMO ESTÃO:
-- usam o id real e os dados confirmam que está correto.

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Nenhum cliente pode ficar órfão. As três contagens têm que dar ZERO:
--
-- SELECT
--   (SELECT count(*) FROM public.qa_vendas v
--     WHERE NOT EXISTS (SELECT 1 FROM public.qa_clientes c
--                        WHERE COALESCE(c.id_legado, c.id) = v.cliente_id))   AS vendas_orfas,
--   (SELECT count(*) FROM public.qa_contracts k
--     WHERE NOT EXISTS (SELECT 1 FROM public.qa_clientes c
--                        WHERE COALESCE(c.id_legado, c.id) = k.cliente_id))   AS contratos_orfaos,
--   (SELECT count(*) FROM public.qa_processos p
--     WHERE NOT EXISTS (SELECT 1 FROM public.qa_clientes c
--                        WHERE c.id = p.cliente_id))                          AS processos_orfaos;
