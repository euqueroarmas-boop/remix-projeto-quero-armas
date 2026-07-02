-- =============================================================================
-- FIX RLS — políticas de dono das tabelas encadeadas por id_legado
-- -----------------------------------------------------------------------------
-- Convenção canônica (src/components/quero-armas/clientes/clientFK.ts):
--   qa_vendas.cliente_id        → qa_clientes.id_legado
--   qa_itens_venda.venda_id     → qa_vendas.id_legado
--   qa_contracts.cliente_id     → qa_clientes.id_legado (FK)
--   qa_processos.cliente_id     → id_legado (via qa-liberar-servicos-contrato)
--
-- BUG: as políticas de dono comparavam essas colunas com
-- qa_current_cliente_id(auth.uid()), que retorna o ID REAL (qa_clientes.id).
-- Para todo cliente com id ≠ id_legado (todos os novos, após o backfill de
-- 20260417130538), o cliente LOGADO não enxergava a própria venda, contrato,
-- processo nem documentos — o checkout logado parecia "não funcionar" mesmo
-- com o webhook Asaas processando tudo corretamente (fluxo público funciona
-- porque usa edge functions com service role, sem RLS).
-- =============================================================================

-- 1) Helper: id_legado do cliente logado (fallback para id se legado nulo).
CREATE OR REPLACE FUNCTION public.qa_current_cliente_id_legado(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(c.id_legado, c.id)
  FROM public.qa_clientes c
  WHERE c.id = public.qa_current_cliente_id(_uid)
$$;

REVOKE ALL ON FUNCTION public.qa_current_cliente_id_legado(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.qa_current_cliente_id_legado(uuid) TO authenticated;

-- 2) qa_vendas — dono enxerga a própria venda (chave id_legado).
DROP POLICY IF EXISTS qa_vendas_owner_select ON public.qa_vendas;
CREATE POLICY qa_vendas_owner_select ON public.qa_vendas
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id_legado(auth.uid()));

-- 3) qa_itens_venda — venda_id referencia qa_vendas.id_legado (tolera vínculo
--    antigo por qa_vendas.id; a posse continua amarrada ao cliente da venda).
DROP POLICY IF EXISTS qa_itens_venda_owner_select ON public.qa_itens_venda;
CREATE POLICY qa_itens_venda_owner_select ON public.qa_itens_venda
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_vendas v
    WHERE (v.id_legado = qa_itens_venda.venda_id OR v.id = qa_itens_venda.venda_id)
      AND v.cliente_id = public.qa_current_cliente_id_legado(auth.uid())
  ));

-- 4) qa_processos — dados históricos mistos (admin criava por id real;
--    pipeline de contrato cria por id_legado): aceita ambas as chaves do
--    MESMO cliente logado.
DROP POLICY IF EXISTS "qa_processos_cliente_select" ON public.qa_processos;
CREATE POLICY "qa_processos_cliente_select" ON public.qa_processos
  FOR SELECT TO authenticated
  USING (cliente_id IN (
    public.qa_current_cliente_id(auth.uid()),
    public.qa_current_cliente_id_legado(auth.uid())
  ));

-- 5) qa_processo_documentos — idem (select + insert do cliente).
DROP POLICY IF EXISTS "qa_processo_doc_cliente_select" ON public.qa_processo_documentos;
CREATE POLICY "qa_processo_doc_cliente_select" ON public.qa_processo_documentos
  FOR SELECT TO authenticated
  USING (cliente_id IN (
    public.qa_current_cliente_id(auth.uid()),
    public.qa_current_cliente_id_legado(auth.uid())
  ));

DROP POLICY IF EXISTS "qa_processo_doc_cliente_insert" ON public.qa_processo_documentos;
CREATE POLICY "qa_processo_doc_cliente_insert" ON public.qa_processo_documentos
  FOR INSERT TO authenticated
  WITH CHECK (cliente_id IN (
    public.qa_current_cliente_id(auth.uid()),
    public.qa_current_cliente_id_legado(auth.uid())
  ));

-- 6) qa_processo_eventos — timeline do processo do próprio cliente.
DROP POLICY IF EXISTS "qa_processo_eventos_cliente_select" ON public.qa_processo_eventos;
CREATE POLICY "qa_processo_eventos_cliente_select" ON public.qa_processo_eventos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_processos p
    WHERE p.id = qa_processo_eventos.processo_id
      AND p.cliente_id IN (
        public.qa_current_cliente_id(auth.uid()),
        public.qa_current_cliente_id_legado(auth.uid())
      )
  ));

-- 7) qa_contracts — FK garante id_legado.
DROP POLICY IF EXISTS "qa_contracts_owner_select" ON public.qa_contracts;
CREATE POLICY "qa_contracts_owner_select" ON public.qa_contracts
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id_legado(auth.uid()));
