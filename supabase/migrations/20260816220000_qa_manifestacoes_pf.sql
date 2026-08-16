-- ============================================================================
-- MANIFESTAÇÕES DA POLÍCIA FEDERAL — o que a PF escreveu, na tela do cliente
-- ----------------------------------------------------------------------------
-- Depois de protocolado, tudo o que acontece com o processo é escrito DENTRO do
-- SINARM, na conta do cliente. A equipe entra com o gov.br dele, abre "Ver
-- Notificação" / "Visualizar Parecer" / "Ver Manifestação", copia o texto e cola
-- aqui. A partir daí o cliente lê no portal, com as mesmas palavras do delegado.
--
-- POR QUE UMA TABELA E NÃO UM CAMPO: um processo produz VÁRIOS textos ao longo
-- da vida. Nos casos reais que analisamos, um mesmo requerimento acumulou
-- notificação → parecer → decisão de indeferimento → parecer do recurso →
-- manifestação do superintendente. Um campo só guardaria o último e apagaria a
-- história — justamente o que a linha do tempo precisa mostrar.
--
-- O texto é guardado COMO VEIO, sem edição. É prova do que a PF exigiu, é o que
-- fundamenta o recurso, e é o que a IA vai ler para dizer o que falta. Reescrever
-- para "ficar mais claro" destruiria as três coisas.
--
-- ── SOBRE AS POLÍTICAS ──────────────────────────────────────────────────────
-- A primeira versão desta migration usava os atalhos `qa_is_active_staff` e
-- `qa_current_cliente_id_legado`. A segunda NÃO EXISTE neste banco (a migration
-- que a cria nunca foi aplicada), e a colagem falhou inteira com
-- "function public.qa_current_cliente_id_legado(uuid) does not exist".
--
-- Por isso as políticas abaixo não chamam função nenhuma: consultam só tabelas
-- que sabidamente existem (`qa_usuarios_perfis`, `qa_clientes`,
-- `cliente_auth_links`, `qa_processos`). Fica mais verboso e roda em qualquer
-- estado do banco — que é o que importa quando a migration é colada à mão.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.qa_processo_manifestacoes_pf (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id       uuid NOT NULL REFERENCES public.qa_processos(id) ON DELETE CASCADE,

  -- notificacao | parecer | manifestacao | decisao
  tipo              text NOT NULL DEFAULT 'notificacao',
  -- Para onde o processo vai com este documento: notificado | em_analise_orgao
  -- | deferido | indeferido | recurso_administrativo
  status_processo   text,

  -- O texto EXATO copiado do SINARM. Nunca editado.
  texto             text NOT NULL,

  -- Extraídos do texto (pela equipe ou pela IA). Todos opcionais: um texto
  -- incompleto ainda vale mais para o cliente do que texto nenhum.
  delegado_nome     text,
  delegado_cargo    text,
  unidade_pf        text,
  data_documento    date,
  prazo_dias        integer,
  prazo_limite      date,
  -- sistema | email | presencial — como o cliente/equipe deve responder.
  canal_resposta    text,
  contato           text,
  -- Itens que a PF exigiu, quando a IA consegue separar.
  exigencias_json   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Análise estruturada da IA (vícios, fundamentos, o que anexar).
  analise_ia_json   jsonb,

  -- Já apareceu para o cliente? Serve para disparar aviso uma vez só.
  visto_cliente_em  timestamptz,

  registrado_por    uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_manifestacoes_processo
  ON public.qa_processo_manifestacoes_pf(processo_id, created_at DESC);

ALTER TABLE public.qa_processo_manifestacoes_pf ENABLE ROW LEVEL SECURITY;

-- Equipe: acesso total. Perfil ativo em qa_usuarios_perfis.
DROP POLICY IF EXISTS "qa_manifestacoes_staff_all" ON public.qa_processo_manifestacoes_pf;
CREATE POLICY "qa_manifestacoes_staff_all" ON public.qa_processo_manifestacoes_pf
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_usuarios_perfis up
     WHERE up.user_id = auth.uid() AND up.ativo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.qa_usuarios_perfis up
     WHERE up.user_id = auth.uid() AND up.ativo = true
  ));

-- Cliente: LÊ o que é do processo dele. Nunca escreve — o texto é da PF, não
-- dele, e permitir edição destruiria o valor probatório.
--
-- Duas portas de vínculo, as mesmas que o portal usa para achar o cadastro:
-- `qa_clientes.user_id` (login direto) e `cliente_auth_links` (login social).
DROP POLICY IF EXISTS "qa_manifestacoes_cliente_select" ON public.qa_processo_manifestacoes_pf;
CREATE POLICY "qa_manifestacoes_cliente_select" ON public.qa_processo_manifestacoes_pf
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.qa_processos p
      JOIN public.qa_clientes c ON c.id = p.cliente_id
     WHERE p.id = qa_processo_manifestacoes_pf.processo_id
       AND (
         c.user_id = auth.uid()
         OR EXISTS (
           SELECT 1
             FROM public.cliente_auth_links l
            WHERE l.user_id = auth.uid()
              AND l.qa_cliente_id = c.id
              AND l.status = 'active'
         )
       )
  ));

-- service_role (edges) segue livre.
DROP POLICY IF EXISTS "qa_manifestacoes_service" ON public.qa_processo_manifestacoes_pf;
CREATE POLICY "qa_manifestacoes_service" ON public.qa_processo_manifestacoes_pf
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Deve voltar TRÊS linhas (staff_all, cliente_select, service):
--
-- SELECT policyname, cmd
--   FROM pg_policies
--  WHERE tablename = 'qa_processo_manifestacoes_pf'
--  ORDER BY policyname;
