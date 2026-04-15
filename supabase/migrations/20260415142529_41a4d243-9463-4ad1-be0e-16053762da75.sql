ALTER TABLE public.qa_feedback_geracoes
  ADD COLUMN IF NOT EXISTS resultado_pratico text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS classificacao_aprendizado text DEFAULT 'nao_avaliada',
  ADD COLUMN IF NOT EXISTS peso_aprendizado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incorporada_aprendizado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS incorporada_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

COMMENT ON COLUMN public.qa_feedback_geracoes.resultado_pratico IS 'Resultado prático da peça: pendente, deferida, indeferida, parcialmente_deferida';
COMMENT ON COLUMN public.qa_feedback_geracoes.classificacao_aprendizado IS 'Classificação para aprendizado: nao_avaliada, excelente_fundamentacao, peca_modelo, precisa_melhorar, nao_usar';
COMMENT ON COLUMN public.qa_feedback_geracoes.peso_aprendizado IS 'Peso calculado para uso como referência de aprendizado (0 a 1.0)';
COMMENT ON COLUMN public.qa_feedback_geracoes.incorporada_aprendizado IS 'Se a peça já foi incorporada ao acervo de aprendizado da IA';

CREATE INDEX IF NOT EXISTS idx_qa_feedback_aprendizado 
  ON public.qa_feedback_geracoes (aprovada_como_modelo, resultado_pratico, peso_aprendizado DESC)
  WHERE aprovada_como_modelo = true OR resultado_pratico = 'deferida';