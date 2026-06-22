-- Corrige finding de segurança: qualquer usuário autenticado podia ler e
-- escrever em QUALQUER arquivo do bucket privado qa-documentos (RG, CPF,
-- comprovantes de outros clientes), porque duas migrations antigas criaram
-- políticas amplas sem escopo e elas NUNCA foram removidas:
--
--   1) 20260415031215 — "qa_storage_auth_upload"/"qa_storage_auth_read"
--      (qualquer authenticated, bucket inteiro, sem checar dono/staff)
--   2) 20260415223451 — "Authenticated users can read/upload/update
--      qa-documentos" (idem, duplicada)
--
-- Migrations posteriores (20260423052012, 20260504041041, 20260618220000)
-- já criaram políticas corretas e restritas (cliente só lê/escreve a
-- própria pasta; staff ativo só nas pastas de anexos de munições), mas
-- como políticas RLS permissivas se combinam com OR, as policies antigas
-- amplas continuavam liberando acesso a tudo independentemente das novas.
--
-- Remove as políticas amplas e adiciona uma política de leitura para
-- staff ativo cobrindo qa-documentos de forma geral (equivalente ao que
-- a política ampla fazia, mas restrita a quem de fato precisa: a equipe
-- Quero Armas, não qualquer cliente autenticado) e mantém leitura/escrita
-- de staff para qa-templates/qa-geracoes (buckets de uso interno).

DROP POLICY IF EXISTS "qa_storage_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "qa_storage_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read qa-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to qa-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update qa-documentos" ON storage.objects;

-- Staff ativo (qa_usuarios_perfis.ativo = true) continua podendo ler e
-- gerenciar qualquer arquivo do bucket qa-documentos — necessário para o
-- painel administrativo revisar documentos de qualquer cliente.
CREATE POLICY "qa_staff_read_qa_documentos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'qa-documentos'
    AND public.qa_is_active_staff(auth.uid())
  );

CREATE POLICY "qa_staff_manage_qa_documentos"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'qa-documentos'
    AND public.qa_is_active_staff(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'qa-documentos'
    AND public.qa_is_active_staff(auth.uid())
  );

-- qa-templates / qa-geracoes (uso interno da equipe, base de conhecimento
-- jurídico) — restaura o acesso de staff que a policy ampla cobria.
CREATE POLICY "qa_staff_read_qa_templates_geracoes"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('qa-templates', 'qa-geracoes')
    AND public.qa_is_active_staff(auth.uid())
  );

CREATE POLICY "qa_staff_write_qa_templates_geracoes"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('qa-templates', 'qa-geracoes')
    AND public.qa_is_active_staff(auth.uid())
  );

-- ============================================================
-- Finding relacionado: qa_documentos_cliente tinha uma policy
-- "anon_full_qa_doc_cliente" liberando leitura/escrita TOTAL para o role
-- anon (ou seja, qualquer requisição com a chave pública, sem precisar de
-- login, conseguia ler ou apagar documentos de QUALQUER cliente). A tabela
-- também está na publicação supabase_realtime, então isso também expunha
-- os eventos de Realtime de documentos de outros clientes para qualquer
-- ouvinte anônimo — exatamente o finding "realtime_messages_no_rls".
--
-- Verificado: nenhum fluxo legítimo do frontend depende de acesso anon
-- nessa tabela. O componente que a usa em contexto "público"
-- (DadosFormularioPublicoSection) só é montado dentro do painel da
-- equipe (QAClientesPage), ou seja, roda autenticado como staff. As
-- escritas do fluxo de cadastro público (visitante sem conta) passam por
-- edge functions com service_role (qa-cadastro-refinado-persistir-docs e
-- afins), que já bypassam RLS — não precisam da policy anon.
-- ============================================================
DROP POLICY IF EXISTS "anon_full_qa_doc_cliente" ON public.qa_documentos_cliente;

CREATE POLICY "qa_staff_full_qa_documentos_cliente"
  ON public.qa_documentos_cliente
  FOR ALL
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- ============================================================
-- revenue_intelligence — leitura e inserção liberadas para o role
-- "public" (qualquer requisição, autenticada ou não). Dados internos de
-- scoring de leads e estratégia de vendas. O UPDATE já tinha sido
-- corrigido em 20260426195325 (restrito a admin) — esta migration aplica
-- a mesma regra ao SELECT e ao INSERT, que ficaram esquecidos.
-- ============================================================
DROP POLICY IF EXISTS "Public read revenue_intelligence" ON public.revenue_intelligence;
DROP POLICY IF EXISTS "Public insert revenue_intelligence" ON public.revenue_intelligence;

CREATE POLICY "Admins read revenue_intelligence"
  ON public.revenue_intelligence FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

CREATE POLICY "Admins insert revenue_intelligence"
  ON public.revenue_intelligence FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ============================================================
-- test_runs / test_alert_config — as policies "Service role full access
-- on ..." foram criadas com USING (true) WITH CHECK (true) mas SEM
-- "TO service_role". Em Postgres, uma policy sem cláusula de role se
-- aplica a PUBLIC (todo mundo: anon, authenticated e service_role), não
-- só ao role pretendido pelo nome/comentário da policy. Resultado: logs
-- de CI/CD (com URLs de screenshot, vídeo, relatório) e a configuração
-- de alertas (telefone WhatsApp, e-mail, URL de webhook) ficavam com
-- leitura E escrita públicas. Recria as duas explicitamente como
-- TO service_role.
-- ============================================================
DROP POLICY IF EXISTS "Service role full access on test_runs" ON public.test_runs;
CREATE POLICY "Service role full access on test_runs"
  ON public.test_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on test_alert_config" ON public.test_alert_config;
CREATE POLICY "Service role full access on test_alert_config"
  ON public.test_alert_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- SUPA_security_definer_view — views criadas sem `security_invoker = true`
-- rodam com o privilégio de quem CRIOU a view (geralmente o owner do
-- schema), não de quem está consultando. Isso pode contornar a RLS das
-- tabelas de origem para qualquer usuário com acesso à view. Aplica o
-- reparo padrão recomendado pelo Supabase: força security_invoker=true,
-- fazendo a view respeitar a RLS de quem está consultando.
-- ============================================================
DO $$
DECLARE v text;
BEGIN
  FOR v IN SELECT unnest(ARRAY[
    'qa_exames_cliente_status',
    'qa_incident_reconciliation_plan',
    'qa_senha_gov_incident_audit',
    'qa_gov_password_reconciliation_view',
    'qa_gov_password_reconciliation_by_cpf',
    'qa_cliente_armas',
    'qa_clientes_homologacao_dry_run',
    'qa_clientes_homologacao_kpis',
    'qa_servico_documentos_obrigatorios',
    'qa_status_divergencias',
    'qa_arsenal_fila_revisao',
    'qa_municoes_saldos',
    'qa_municoes_em_revisao'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = v) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    END IF;
  END LOOP;
END $$;
