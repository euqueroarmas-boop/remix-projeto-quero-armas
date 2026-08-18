-- ============================================================================
-- TIRA O INSERT ANÔNIMO-LOGADO DA TABELA DE PEÇAS
-- ----------------------------------------------------------------------------
-- Resíduo anotado quando fechamos o vazamento de `qa_geracoes_pecas`
-- (migration 20260818100000) e confirmado na reauditoria de 18/08/2026.
--
-- A policy `qa_geracoes_own` é `FOR ALL TO authenticated USING (usuario_id =
-- auth.uid())`. `FOR ALL` inclui INSERT — e `authenticated` inclui o CLIENTE,
-- porque `qa-cliente-criar-conta-publica` é aberta: basta se cadastrar no site.
--
-- Não vaza nada (o `WITH CHECK` prende cada linha ao próprio uid), mas permite
-- injetar peças na tabela que alimenta a fila de revisão humana, as contagens
-- do painel e o treino da IA. Ninguém precisa disso: TODA criação de peça
-- acontece em `qa-gerar-peca`, com service role, que não passa por RLS. Não há
-- um único INSERT vindo do front — conferido na reauditoria.
--
-- Trocamos o `FOR ALL` por SELECT + UPDATE, que é o que as telas realmente
-- usam (histórico, fila de revisão, marcação de status). DELETE também sai:
-- não existe exclusão de peça pelo front, e apagar peça é apagar rastro.
--
-- As demais policies da tabela ficam intactas: `qa_geracoes_service`
-- (service_role), `qa_geracoes_staff_select` e `qa_geracoes_cliente_select`.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "qa_geracoes_own" ON public.qa_geracoes_pecas;

-- Cada operador continua enxergando o que gerou (a leitura ampla da Equipe vem
-- de `qa_geracoes_staff_select`, criada em 20260818100000).
DROP POLICY IF EXISTS "qa_geracoes_own_select" ON public.qa_geracoes_pecas;
CREATE POLICY "qa_geracoes_own_select" ON public.qa_geracoes_pecas
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

-- E continua podendo revisar/atualizar a própria peça pelo painel.
DROP POLICY IF EXISTS "qa_geracoes_own_update" ON public.qa_geracoes_pecas;
CREATE POLICY "qa_geracoes_own_update" ON public.qa_geracoes_pecas
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

COMMIT;

-- ── CONFERÊNCIA ─────────────────────────────────────────────────────────────
-- (a) Nenhuma policy de INSERT/ALL para `authenticated`. Esperado: só
--     service_role pode inserir.
--
-- SELECT policyname, cmd, roles
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'qa_geracoes_pecas'
--  ORDER BY cmd, policyname;
--
-- Esperado (5 linhas):
--   ALL    qa_geracoes_service        {service_role}
--   SELECT qa_geracoes_cliente_select {authenticated}
--   SELECT qa_geracoes_own_select     {authenticated}
--   SELECT qa_geracoes_staff_select   {authenticated}
--   UPDATE qa_geracoes_own_update     {authenticated}
--
-- (b) A geração de peça continua funcionando: ela roda em qa-gerar-peca com
--     service role. Gere uma peça pelo painel depois de aplicar e confirme que
--     ela aparece no histórico.
