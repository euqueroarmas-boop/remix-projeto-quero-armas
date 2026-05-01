ALTER TABLE public.qa_geracoes_pecas
  ADD COLUMN IF NOT EXISTS correcoes_ia_usadas_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correcoes_ia_alertas_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.qa_geracoes_pecas.correcoes_ia_usadas_json IS
  'Fase 3 — Correções supervisionadas (qa_ia_correcoes_juridicas) injetadas no prompt desta geração. Estrutura: [{id, categoria, escopo, usado_em}].';

COMMENT ON COLUMN public.qa_geracoes_pecas.correcoes_ia_alertas_json IS
  'Fase 3 — Alertas detectados no pós-geração quando o texto gerado contém trechos próximos a erros já catalogados. Estrutura: [{correcao_id, categoria, trecho_suspeito, trecho_correto, similaridade}].';