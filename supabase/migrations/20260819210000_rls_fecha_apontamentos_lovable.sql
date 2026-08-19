-- ============================================================================
-- CORREÇÃO — apontamentos de segurança do Lovable (2026-08-19)
-- Fecha os itens: 1 (ciências/consentimentos), 3 (exames), 4 (identidades
-- funcionais), 5 (psicólogos não localizados), 9 (revisões de peças),
-- 7 (assinatura anônima do fluxo antigo) e 12 (search_path).
--
-- NÃO mexe de propósito:
--   2 (acréscimos) — falso positivo: o portal do cliente grava ali de
--     propósito, e a visibilidade já é limitada pelo registro-pai;
--   6 (MCP) — público por desenho (só busca na base pública de legislação);
--   8 (customers) — o checkout sem login precisa inserir (decisão antiga);
--   10/11 (REVOKE em funções) — exige mapear consumidores antes
--     (pendências 1 e 2 do docs/SEGURANCA-PENDENCIAS.md).
--
-- Padrão aplicado: cliente vê só o que é dele; equipe ativa
-- (qa_is_active_staff) vê e mantém tudo; service_role segue com passe livre.
-- Seguro para colar mais de uma vez. Tudo numa transação: ou aplica inteiro,
-- ou não aplica nada.
-- ============================================================================
BEGIN;

-- ── 1) Consentimentos/ciências: era "qualquer logado lê tudo" ───────────────
DROP POLICY IF EXISTS "Equipe autenticada le ciencias" ON public.qa_cliente_ciencias;
DROP POLICY IF EXISTS qa_ciencias_staff_select ON public.qa_cliente_ciencias;
DROP POLICY IF EXISTS qa_ciencias_owner_select ON public.qa_cliente_ciencias;

CREATE POLICY qa_ciencias_staff_select ON public.qa_cliente_ciencias
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

-- O portal lê a ciência do próprio cliente (passo do BO na efetiva
-- necessidade). Sem esta policy, o checklist do portal trava.
CREATE POLICY qa_ciencias_owner_select ON public.qa_cliente_ciencias
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

-- ── 3) Exames psicológicos/de tiro: era CRUD liberado a qualquer logado ─────
DROP POLICY IF EXISTS "Authenticated can view exames" ON public.qa_exames_cliente;
DROP POLICY IF EXISTS "Authenticated can insert exames" ON public.qa_exames_cliente;
DROP POLICY IF EXISTS "Authenticated can update exames observacoes" ON public.qa_exames_cliente;
DROP POLICY IF EXISTS "Authenticated can delete exames" ON public.qa_exames_cliente;
DROP POLICY IF EXISTS qa_exames_staff_all ON public.qa_exames_cliente;
DROP POLICY IF EXISTS qa_exames_owner_select ON public.qa_exames_cliente;

CREATE POLICY qa_exames_staff_all ON public.qa_exames_cliente
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- O portal lê os exames do próprio cliente (status agregado). cliente_id aqui
-- é sempre o id real de qa_clientes (regra do clientFK.ts).
CREATE POLICY qa_exames_owner_select ON public.qa_exames_cliente
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

-- Log de alertas de exame (mesma família): fecha a leitura geral e a brecha
-- de qualquer logado inserir alerta falso. O cron grava com service_role.
DROP POLICY IF EXISTS "Authenticated can view alertas" ON public.qa_exames_alertas_enviados;
DROP POLICY IF EXISTS "Authenticated can insert alertas" ON public.qa_exames_alertas_enviados;
DROP POLICY IF EXISTS qa_exames_alertas_staff_select ON public.qa_exames_alertas_enviados;

CREATE POLICY qa_exames_alertas_staff_select ON public.qa_exames_alertas_enviados
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

-- ── 4) Identidades funcionais (CPF/RG de policiais/militares): só equipe ────
DROP POLICY IF EXISTS "equipe_le_identidades_funcionais" ON public.qa_identidades_funcionais;
DROP POLICY IF EXISTS "equipe_mantem_identidades_funcionais" ON public.qa_identidades_funcionais;
DROP POLICY IF EXISTS qa_identidades_staff_all ON public.qa_identidades_funcionais;

CREATE POLICY qa_identidades_staff_all ON public.qa_identidades_funcionais
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- ── 5) Psicólogos não localizados: só equipe (todas as telas são internas) ──
DROP POLICY IF EXISTS "Equipe autenticada gerencia nao localizados" ON public.qa_psico_nao_localizados;
DROP POLICY IF EXISTS qa_psico_nao_loc_staff_all ON public.qa_psico_nao_localizados;

CREATE POLICY qa_psico_nao_loc_staff_all ON public.qa_psico_nao_localizados
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- ── 9) Revisões de peças: só equipe (grava a tela de histórico, interna) ────
DROP POLICY IF EXISTS qa_revisoes_select ON public.qa_revisoes_pecas;
DROP POLICY IF EXISTS qa_revisoes_insert ON public.qa_revisoes_pecas;
DROP POLICY IF EXISTS qa_revisoes_update ON public.qa_revisoes_pecas;
DROP POLICY IF EXISTS qa_revisoes_staff_all ON public.qa_revisoes_pecas;

CREATE POLICY qa_revisoes_staff_all ON public.qa_revisoes_pecas
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- ── 7) Fluxo antigo de contrato: fecha a inserção anônima de assinatura ─────
-- Nenhuma tela atual insere direto; as edge functions gravam com service_role
-- e continuam funcionando.
DROP POLICY IF EXISTS "Anyone can insert signature" ON public.contract_signatures;

-- ── 12) search_path fixo nas SECURITY DEFINER que não têm ───────────────────
-- ALTER não reescreve corpo nenhum — seguro para as funções que foram
-- corrigidas direto no banco (armadilha conhecida do pg_get_functiondef).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
      AND (p.proconfig IS NULL
           OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg
                          WHERE cfg LIKE 'search_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp',
                   r.assinatura);
  END LOOP;
END $$;

COMMIT;

-- ── Conferência (o grid mostra só este resultado) ───────────────────────────
-- Esperado: nenhuma linha com using/with_check = "true" para authenticated
-- nas tabelas abaixo, e a seção secdef_sem_search_path com "0 funcoes".
SELECT 'policies'::text AS secao,
       p.tablename::text AS item,
