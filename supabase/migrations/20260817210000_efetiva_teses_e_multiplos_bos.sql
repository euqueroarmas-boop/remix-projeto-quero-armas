-- =============================================================================
-- Efetiva necessidade — TESES DE DEFESA e MÚLTIPLOS BOLETINS
--
-- Furo real (17/08/2026, cliente Mizael): ele vive DUAS situações que não têm
-- relação nenhuma entre si — uma na família (ameaça do companheiro da irmã) e
-- outra no trabalho. O sistema guardava UM único `texto_bo` por processo, então
-- a IA amassou tudo num relato só. Ao chegar na delegacia eletrônica o texto não
-- cabia, não fazia sentido como ocorrência única, e ele acabou subindo o mesmo
-- boletim duas vezes.
--
-- Regra do usuário (17/08/2026):
--   • Com base no que o cliente conta, a IA PROPÕE teses de defesa — um núcleo
--     de risco por tese, sem correlação entre elas. O cliente confirma ou edita
--     os títulos na tela. Não há teto: quantas o caso pedir.
--   • Cada tese ganha o SEU texto de até 500 caracteres para abrir o boletim,
--     caracterizando risco iminente / atividade de risco — que é como a
--     delegacia entende o acesso dele a armas. Tudo dentro da lei: só fatos
--     que o próprio cliente narrou.
--   • Depois de cada boletim anexado o sistema pergunta se ele quer abrir
--     outro. SIM: trava aqui até o documento chegar — para sair sem o boletim
--     ele precisa abrir chamado com a equipe (destrava registrada e assinada).
--     NÃO: síntese nova com os dados lidos dos boletins, aprovação e carimbo.
--   • O boletim anexado é casado automaticamente com a tese pelo número e pela
--     natureza lida do documento; o cliente LÊ e confirma o encaixe.
-- =============================================================================

BEGIN;

-- ─── As teses: várias por questionário ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_efetiva_teses (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  efetiva_necessidade_id  uuid NOT NULL
    REFERENCES public.qa_efetiva_necessidade(id) ON DELETE CASCADE,

  ordem                   integer NOT NULL DEFAULT 1,
  /* Título curto do núcleo de risco ("Ameaça do companheiro da minha irmã").
     A IA propõe; o cliente confirma ou reescreve. */
  titulo                  text NOT NULL,
  /* Uma ou duas linhas explicando ao cliente o que entra nesta tese. */
  resumo                  text,

  /* O texto que ele leva à delegacia PARA ESTA TESE. Máximo 500 caracteres —
     limite do campo de relato da delegacia eletrônica. */
  texto_bo                text,
  texto_bo_gerado_em      timestamptz,

  titulo_editado_pelo_cliente     boolean NOT NULL DEFAULT false,
  texto_bo_editado_pelo_cliente   boolean NOT NULL DEFAULT false,

  /* Carimbos do cliente. Nenhum deles é apagado depois — são prova de sessão. */
  confirmada_em           timestamptz,          -- confirmou/editou o título
  registro_confirmado_em  timestamptz,          -- "já registrei este boletim"

  /* O boletim que cobre esta tese. ON DELETE SET NULL: apagar um anexo
     duplicado não pode derrubar a tese junto. */
  prova_id                uuid
    REFERENCES public.qa_efetiva_necessidade_provas(id) ON DELETE SET NULL,
  vinculo_confirmado_em   timestamptz,
  vinculo_origem          text CHECK (vinculo_origem IN ('automatico','cliente')),

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_efetiva_teses_pai
  ON public.qa_efetiva_teses(efetiva_necessidade_id, ordem);

-- Um boletim cobre UMA tese. É o que impede o mesmo documento de fechar duas
-- frentes diferentes — e o que barra a duplicidade que aconteceu em 17/08.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_efetiva_teses_prova
  ON public.qa_efetiva_teses(prova_id) WHERE prova_id IS NOT NULL;

-- ─── O laço "quer abrir outro boletim?" ──────────────────────────────────
ALTER TABLE public.qa_efetiva_necessidade
  ADD COLUMN IF NOT EXISTS teses_geradas_em      timestamptz,
  /* NULL = a pergunta está de pé. true = ele disse que vai abrir outro e o
     passo trava. false = encerrou o ciclo e seguiu para a síntese final. */
  ADD COLUMN IF NOT EXISTS bo_quer_outro         boolean,
  ADD COLUMN IF NOT EXISTS bo_aguardando_desde   timestamptz,
  /* Destrava da equipe — só por chamado, com motivo e autor. */
  ADD COLUMN IF NOT EXISTS bo_destravado_em      timestamptz,
  ADD COLUMN IF NOT EXISTS bo_destravado_por     uuid,
  ADD COLUMN IF NOT EXISTS bo_destravado_por_nome text,
  ADD COLUMN IF NOT EXISTS bo_destrava_motivo    text;

-- ─── RLS: mesmo vínculo do resto do portal ───────────────────────────────
ALTER TABLE public.qa_efetiva_teses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS efetiva_teses_cliente ON public.qa_efetiva_teses;
CREATE POLICY efetiva_teses_cliente ON public.qa_efetiva_teses
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_efetiva_necessidade e
      JOIN public.qa_clientes c ON c.id = e.cliente_id
     WHERE e.id = qa_efetiva_teses.efetiva_necessidade_id
       AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.qa_efetiva_necessidade e
      JOIN public.qa_clientes c ON c.id = e.cliente_id
     WHERE e.id = qa_efetiva_teses.efetiva_necessidade_id
       AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS efetiva_teses_equipe_select ON public.qa_efetiva_teses;
CREATE POLICY efetiva_teses_equipe_select ON public.qa_efetiva_teses
  FOR SELECT TO authenticated
  USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador','operador','advogado']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_efetiva_teses TO authenticated;

-- ─── Quem já tinha o texto único não recomeça nada ───────────────────────
-- O texto que já estava gravado vira a tese 1, JÁ CONFIRMADA: ninguém que
-- estava no meio do caminho é obrigado a reconfirmar título nenhum.
INSERT INTO public.qa_efetiva_teses
  (efetiva_necessidade_id, ordem, titulo, resumo, texto_bo, texto_bo_gerado_em,
   texto_bo_editado_pelo_cliente, confirmada_em, registro_confirmado_em)
SELECT
  e.id, 1, 'Situação relatada',
  'Frente de risco montada antes da separação em teses.',
  e.texto_bo, e.texto_bo_gerado_em,
  COALESCE(e.texto_bo_editado_pelo_cliente, false),
  COALESCE(e.updated_at, now()),
  e.bo_registro_confirmado_em
FROM public.qa_efetiva_necessidade e
WHERE COALESCE(btrim(e.texto_bo), '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_efetiva_teses t WHERE t.efetiva_necessidade_id = e.id
  );

COMMIT;
