-- ============================================================================
-- FECHA O ACESSO ANÔNIMO ÀS PEÇAS GERADAS (qa_geracoes_pecas)
-- ----------------------------------------------------------------------------
-- Achado da auditoria de ponta a ponta, 18/08/2026.
--
-- A migration 20260413235710 criou duas policies para o papel `anon`:
--
--   "Anon can select qa_geracoes_pecas"  FOR SELECT TO anon USING (true)
--   "Anon can insert qa_geracoes_pecas"  FOR INSERT TO anon WITH CHECK (true)
--
-- e nenhuma migration posterior as removeu. A chave `anon` é pública — está no
-- HTML do site. Com ela, qualquer pessoa lista TODAS as peças geradas: nome
-- completo, CPF, endereço, a narrativa do caso e a minuta inteira. E pode
-- inserir peças falsas na base que alimenta a fila de revisão e o treino da IA.
--
-- Este bloco:
--   1. derruba as duas policies anônimas;
--   2. tira o GRANT de tabela de `anon` (rede de segunda linha: se alguma
--      policy permissiva voltar por engano, o GRANT não estará aberto);
--   3. ADICIONA leitura para a Equipe Quero Armas e para o dono do processo —
--      sem tocar nas policies existentes (`qa_geracoes_service`,
--      `qa_geracoes_own`), conforme a regra de extensão sobre substituição.
--
-- A leitura do cliente é o alicerce da devolução da petição para aprovação
-- (Fase 4 do escopo): hoje nenhuma tela do portal lê esta tabela.
--
-- ATENÇÃO: o repositório não é a fonte da verdade deste projeto (ver
-- docs/SEGURANCA-PENDENCIAS.md). Rode a conferência do fim do arquivo ANTES e
-- DEPOIS para confirmar o estado real do banco.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) Derruba o acesso anônimo ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon can select qa_geracoes_pecas" ON public.qa_geracoes_pecas;
DROP POLICY IF EXISTS "Anon can insert qa_geracoes_pecas" ON public.qa_geracoes_pecas;

-- ── 2) Tira o GRANT de tabela de anon ───────────────────────────────────────
REVOKE ALL ON TABLE public.qa_geracoes_pecas FROM anon;

-- ── 3) Leitura da Equipe Quero Armas (ADITIVO) ──────────────────────────────
-- `qa_geracoes_own` limita cada operador às peças que ELE gerou. A fila de
-- revisão humana e os painéis precisam enxergar a produção inteira.
DROP POLICY IF EXISTS "qa_geracoes_staff_select" ON public.qa_geracoes_pecas;
CREATE POLICY "qa_geracoes_staff_select" ON public.qa_geracoes_pecas
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

-- ── 4) Leitura do próprio cliente (ADITIVO) ─────────────────────────────────
-- Só leitura, e só as peças dele. Aprovar/editar continuará passando por edge
-- function com service role — RLS não restringe coluna, e dar UPDATE aqui
-- daria ao cliente o direito de mexer em status e score da peça.
DROP POLICY IF EXISTS "qa_geracoes_cliente_select" ON public.qa_geracoes_pecas;
CREATE POLICY "qa_geracoes_cliente_select" ON public.qa_geracoes_pecas
  FOR SELECT TO authenticated
  USING (
    cliente_id IS NOT NULL
    AND cliente_id IN (
      public.qa_current_cliente_id(auth.uid()),
      public.qa_current_cliente_id_legado(auth.uid())
    )
  );

COMMIT;

-- ── CONFERÊNCIA ─────────────────────────────────────────────────────────────
-- (a) Nenhuma policy para `anon` pode sobrar. Esperado: 0 linhas.
--
-- SELECT policyname, roles, cmd
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename  = 'qa_geracoes_pecas'
--    AND 'anon' = ANY (roles);
--
-- (b) Estado final das policies. Esperado: qa_geracoes_service,
--     qa_geracoes_own, qa_geracoes_staff_select, qa_geracoes_cliente_select.
--
-- SELECT policyname, roles, cmd, qual
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'qa_geracoes_pecas'
--  ORDER BY policyname;
--
-- (c) anon não pode mais ter privilégio de tabela. Esperado: 0 linhas.
--
-- SELECT privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema = 'public'
--    AND table_name   = 'qa_geracoes_pecas'
--    AND grantee      = 'anon';
--
-- (d) Prova de fogo, de fora, com a chave anon pública — tem que voltar
--     `[]` ou erro de permissão, nunca uma lista de peças:
--
--     curl -s "$SUPABASE_URL/rest/v1/qa_geracoes_pecas?select=id,titulo_geracao&limit=3" \
--       -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
