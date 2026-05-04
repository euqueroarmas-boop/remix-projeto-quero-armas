
CREATE TABLE IF NOT EXISTS public.qa_prazos_procedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_peca text,
  procedimento_servico text,
  evento_base text,
  prazo_dias integer NOT NULL,
  tipo_contagem text NOT NULL DEFAULT 'corridos' CHECK (tipo_contagem IN ('corridos','uteis')),
  base_calculo text NOT NULL DEFAULT 'data_notificacao',
  janela_alerta_dias integer NOT NULL DEFAULT 5,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  prioridade integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_prazos_tipo_peca ON public.qa_prazos_procedimentos(tipo_peca) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_qa_prazos_procedimento ON public.qa_prazos_procedimentos(procedimento_servico) WHERE ativo;

ALTER TABLE public.qa_prazos_procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_prazos_select_authenticated"
  ON public.qa_prazos_procedimentos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "qa_prazos_admin_all"
  ON public.qa_prazos_procedimentos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_qa_prazos_updated_at
  BEFORE UPDATE ON public.qa_prazos_procedimentos
  FOR EACH ROW EXECUTE FUNCTION public.qa_set_updated_at();

INSERT INTO public.qa_prazos_procedimentos
  (tipo_peca, procedimento_servico, evento_base, prazo_dias, tipo_contagem, base_calculo, janela_alerta_dias, descricao, prioridade)
VALUES
  ('recurso_administrativo', NULL, 'indeferimento', 10, 'corridos', 'data_indeferimento', 3,
   'Prazo padrão para recurso administrativo contra indeferimento da PF.', 50),
  ('resposta_a_notificacao', NULL, 'notificacao', 30, 'corridos', 'data_notificacao', 5,
   'Prazo padrão para resposta a notificação / cumprimento de exigência da PF.', 50),
  (NULL, 'cumprimento_exigencia', 'notificacao', 30, 'corridos', 'data_notificacao', 5,
   'Prazo padrão para cumprimento de exigência administrativa.', 60),
  (NULL, 'restituicao', 'indeferimento', 30, 'corridos', 'data_indeferimento', 5,
   'Prazo padrão para pedido de restituição.', 60),
  (NULL, 'indeferimento', 'indeferimento', 10, 'corridos', 'data_indeferimento', 3,
   'Prazo padrão de impugnação ao indeferimento.', 60),
  (NULL, 'acompanhamento_processual', 'notificacao', 15, 'corridos', 'data_notificacao', 5,
   'Prazo padrão de acompanhamento processual.', 80);
