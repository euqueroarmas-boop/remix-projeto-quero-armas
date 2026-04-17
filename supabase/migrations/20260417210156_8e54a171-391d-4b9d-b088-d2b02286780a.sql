ALTER TABLE public.qa_itens_venda
ADD COLUMN IF NOT EXISTS data_indeferimento_recurso date;

COMMENT ON COLUMN public.qa_itens_venda.data_indeferimento_recurso IS 'Data em que o recurso administrativo foi indeferido (não acatado) pela autoridade competente.';