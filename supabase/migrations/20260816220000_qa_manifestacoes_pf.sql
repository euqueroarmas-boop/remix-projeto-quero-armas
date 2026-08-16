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

  /** O texto EXATO copiado do SINARM. Nunca editado. */
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
  /** Itens que a PF exigiu, quando a IA consegue separar. */
  exigencias_json   jsonb NOT NULL DEFAULT '[]'::jsonb,
  /** Análise estruturada da IA (vícios, fundamentos, o que anexar). */
  analise_ia_json   jsonb,

  /** Já apareceu para o cliente? Serve para disparar aviso uma vez só. */
  visto_cliente_em  timestamptz,

  registrado_por    uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_manifestacoes_processo
  ON public.qa_processo_manifestacoes_pf(processo_id, created_at DESC);

ALTER TABLE public.qa_processo_manifestacoes_pf ENABLE ROW LEVEL SECURITY;

-- Equipe: acesso total.
DROP POLICY IF EXISTS "qa_manifestacoes_staff_all" ON public.qa_processo_manifestacoes_pf;
CREATE POLICY "qa_manifestacoes_staff_all" ON public.qa_processo_manifestacoes_pf
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- Cliente: LÊ o que é do processo dele. Nunca escreve — o texto é da PF, não
-- dele, e permitir edição destruiria o valor probatório.
DROP POLICY IF EXISTS "qa_manifestacoes_cliente_select" ON public.qa_processo_manifestacoes_pf;
CREATE POLICY "qa_manifestacoes_cliente_select" ON public.qa_processo_manifestacoes_pf
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_processos p
    WHERE p.id = qa_processo_manifestacoes_pf.processo_id
      AND p.cliente_id IN (
        public.qa_current_cliente_id(auth.uid()),
        public.qa_current_cliente_id_legado(auth.uid())
      )
  ));

-- service_role (edges) segue livre.
DROP POLICY IF EXISTS "qa_manifestacoes_service" ON public.qa_processo_manifestacoes_pf;
CREATE POLICY "qa_manifestacoes_service" ON public.qa_processo_manifestacoes_pf
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Deve voltar a tabela criada e as três políticas:
--
-- SELECT tablename, policyname, cmd
--   FROM pg_policies
--  WHERE tablename = 'qa_processo_manifestacoes_pf'
--  ORDER BY policyname;
