-- Piloto Real: composição do valor final, valor total pago e reprocessamento auditável

-- 1) qa_vendas: novos campos de composição / valor total real pago pelo cliente
ALTER TABLE public.qa_vendas
  ADD COLUMN IF NOT EXISTS composicao_valor_final jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valor_servicos_catalogo numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_servicos_aplicado numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_despesas_extras numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_custo_financeiro numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_total_pago_cliente numeric(12,2),
  ADD COLUMN IF NOT EXISTS pagamento_parcelas integer,
  ADD COLUMN IF NOT EXISTS pagamento_adquirente text,
  ADD COLUMN IF NOT EXISTS pagamento_valor_parcela numeric(12,2),
  ADD COLUMN IF NOT EXISTS pagamento_valor_total_parcelado numeric(12,2),
  ADD COLUMN IF NOT EXISTS pagamento_diferenca_arredondamento numeric(12,2);

COMMENT ON COLUMN public.qa_vendas.composicao_valor_final IS
'Array de linhas da composição do valor final (piloto pacote fechado). Cada item: {tipo, descricao, valor, natureza, aparece_no_contrato, observacao?}. Tipos válidos: servico_qa, gru_taxa_gov, exame_laudo, clube_estande, despesa_operacional, deslocamento_logistica, custo_financeiro_adquirente, taxa_admin_intermediacao, outro.';

COMMENT ON COLUMN public.qa_vendas.valor_total_pago_cliente IS
'Valor total efetivamente cobrado do cliente (soma da composicao_valor_final). Fonte de verdade para financeiro e contrato quando pacote fechado.';

-- 2) qa_pagamento_auditoria: reforçar campos de forma de pagamento
ALTER TABLE public.qa_pagamento_auditoria
  ADD COLUMN IF NOT EXISTS parcelas integer,
  ADD COLUMN IF NOT EXISTS adquirente text,
  ADD COLUMN IF NOT EXISTS valor_parcela numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_total_parcelado numeric(12,2),
  ADD COLUMN IF NOT EXISTS diferenca_arredondamento numeric(12,2),
  ADD COLUMN IF NOT EXISTS composicao_snapshot jsonb;

-- 3) Reprocessamento financeiro do piloto: histórico de correções (before/after)
CREATE TABLE IF NOT EXISTS public.qa_piloto_reprocessamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id bigint NOT NULL,
  venda_id_legado text,
  motivo text NOT NULL,
  antes jsonb NOT NULL,
  depois jsonb NOT NULL,
  staff_user_id uuid,
  staff_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_piloto_reprocessamentos TO authenticated;
GRANT ALL ON public.qa_piloto_reprocessamentos TO service_role;

ALTER TABLE public.qa_piloto_reprocessamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff pode ler reprocessamentos do piloto"
  ON public.qa_piloto_reprocessamentos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qa_usuarios_perfis p
      WHERE p.user_id = auth.uid()
        AND p.perfil IN ('administrador','staff','financeiro')
    )
  );

CREATE INDEX IF NOT EXISTS idx_qa_piloto_reproc_venda ON public.qa_piloto_reprocessamentos(venda_id);
CREATE INDEX IF NOT EXISTS idx_qa_vendas_valor_total_pago ON public.qa_vendas(valor_total_pago_cliente) WHERE valor_total_pago_cliente IS NOT NULL;