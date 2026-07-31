-- =============================================================================
-- Efetiva necessidade — Parte A: questionário e recepção das provas
--
-- Hoje o checklist pede "Declaração de efetiva necessidade" e o cliente não
-- sabe o que enviar. É a única pendência de defesa pessoal sem caminho: ele
-- trava ali e ninguém sabe por quê.
--
-- Regra de negócio (usuário, 31/07/2026):
--   PRIMEIRO chamam-se as provas, DEPOIS a narrativa. As perguntas induzem o
--   cliente a entregar o que ele já tem — BO, inquérito, ação criminal — em vez
--   de pedir que ele "explique sua necessidade" no vazio.
--   Só quem não tem prova nenhuma cai no relato detalhado.
--
-- Duas tabelas porque são coisas diferentes: o QUESTIONÁRIO é um por processo;
-- as PROVAS são muitas, e cada uma tem seus próprios dados extraídos.
--
-- A Parte B (narrativa cronológica, aprovação do cliente e encaminhamento à
-- equipe) usa estas mesmas tabelas — por isso os campos dela já existem aqui,
-- vazios.
-- =============================================================================

BEGIN;

-- ─── Questionário: um por processo ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_efetiva_necessidade (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id           uuid NOT NULL REFERENCES public.qa_processos(id) ON DELETE CASCADE,
  cliente_id            bigint NOT NULL,

  -- Respostas do questionário. NULL = ainda não respondeu; false = respondeu
  -- que não tem. A diferença importa: uma é pendência, a outra é resposta.
  tem_bo                boolean,
  tem_inquerito         boolean,
  tem_acao_criminal     boolean,
  sofre_ameaca          boolean,

  /* Relato do cliente. Obrigatório para quem não tem prova nenhuma — é o único
     material que a equipe terá. */
  relato_cliente        text,
  /* Contexto que qualifica o risco: profissão, rotina, valores transportados,
     local de moradia. Perguntado a todos. */
  contexto_risco        text,

  /* Parte B — preenchidos depois. */
  narrativa_gerada      text,
  narrativa_gerada_em   timestamptz,
  aprovado_cliente      boolean NOT NULL DEFAULT false,
  aprovado_cliente_em   timestamptz,
  enviado_equipe_em     timestamptz,

  status                text NOT NULL DEFAULT 'coletando'
    CHECK (status IN ('coletando','aguardando_aprovacao','aprovado','com_equipe','concluido')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Um questionário por processo. Reabrir é atualizar, não criar outro.
  CONSTRAINT uq_efetiva_necessidade_processo UNIQUE (processo_id)
);

CREATE INDEX IF NOT EXISTS idx_efetiva_nec_cliente
  ON public.qa_efetiva_necessidade(cliente_id);

-- ─── Provas: várias por questionário ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_efetiva_necessidade_provas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  efetiva_necessidade_id uuid NOT NULL
    REFERENCES public.qa_efetiva_necessidade(id) ON DELETE CASCADE,

  tipo                  text NOT NULL
    CHECK (tipo IN ('boletim_ocorrencia','inquerito_policial','acao_criminal','outro')),

  arquivo_storage_path  text,
  arquivo_nome          text,

  /* Campos lidos do documento. O BO é lido LOCALMENTE pelo parser — sem IA.
     `leitura_por` registra a origem para auditoria: parser ou ia. */
  numero                text,
  protocolo             text,
  orgao                 text,
  data_fato             date,
  local_fato            text,
  /* Tipificações: "Código Penal - Ameaça (art. 147)". */
  naturezas             text[],
  vitima_nome           text,
  relato                text,
  dados_extraidos       jsonb NOT NULL DEFAULT '{}'::jsonb,
  leitura_por           text CHECK (leitura_por IN ('parser','ia','manual')),

  /* A prova é do próprio cliente? BO de terceiro não sustenta a necessidade
     dele. NULL = não foi possível conferir. */
  confere_com_cliente   boolean,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_efetiva_nec_provas_pai
  ON public.qa_efetiva_necessidade_provas(efetiva_necessidade_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.qa_efetiva_necessidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_efetiva_necessidade_provas ENABLE ROW LEVEL SECURITY;

-- O cliente enxerga e edita apenas o que é dele. O vínculo é o mesmo usado no
-- resto do portal: qa_clientes.user_id.
DROP POLICY IF EXISTS efetiva_nec_cliente ON public.qa_efetiva_necessidade;
CREATE POLICY efetiva_nec_cliente ON public.qa_efetiva_necessidade
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_clientes c
     WHERE c.id = qa_efetiva_necessidade.cliente_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.qa_clientes c
     WHERE c.id = qa_efetiva_necessidade.cliente_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS efetiva_nec_provas_cliente ON public.qa_efetiva_necessidade_provas;
CREATE POLICY efetiva_nec_provas_cliente ON public.qa_efetiva_necessidade_provas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_efetiva_necessidade e
      JOIN public.qa_clientes c ON c.id = e.cliente_id
     WHERE e.id = qa_efetiva_necessidade_provas.efetiva_necessidade_id
       AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.qa_efetiva_necessidade e
      JOIN public.qa_clientes c ON c.id = e.cliente_id
     WHERE e.id = qa_efetiva_necessidade_provas.efetiva_necessidade_id
       AND c.user_id = auth.uid()
  ));

GRANT SELECT, INSERT, UPDATE ON public.qa_efetiva_necessidade TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_efetiva_necessidade_provas TO authenticated;

COMMIT;
