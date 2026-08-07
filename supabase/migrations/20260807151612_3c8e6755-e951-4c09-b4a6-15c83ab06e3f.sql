-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 4 — FONTE ÚNICA DE VALIDADE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.qa_validade_documentos
  ADD COLUMN IF NOT EXISTS perpetuo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerta_dias integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'dias',
  ADD COLUMN IF NOT EXISTS rotulo text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qa_validade_documentos_unidade_chk'
  ) THEN
    ALTER TABLE public.qa_validade_documentos
      ADD CONSTRAINT qa_validade_documentos_unidade_chk
      CHECK (unidade IN ('dias', 'meses'));
  END IF;
END$$;

GRANT SELECT ON public.qa_validade_documentos TO authenticated;
GRANT ALL ON public.qa_validade_documentos TO service_role;

-- ── Regras canônicas ────────────────────────────────────────────────────────
INSERT INTO public.qa_validade_documentos
  (tipo_documento, validade_dias, unidade, perpetuo, alerta_dias, base_legal, rotulo, observacao)
VALUES
  -- Certidões federais / judiciais: 90 dias
  ('certidao_antecedente_federal', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão de antecedentes federal', 'Certidões federais (PF/JF)'),
  ('certidao_negativa_pf', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão negativa Polícia Federal', NULL),
  ('certidao_negativa_jf', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão negativa Justiça Federal', NULL),
  ('certidao_justica_federal', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão da Justiça Federal', 'Inclui SJSP / JEF / TRF'),
  ('certidao_justica_estadual', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão da Justiça Estadual', NULL),
  ('certidao_justica_militar', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão da Justiça Militar', NULL),
  ('certidao_justica_eleitoral', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão da Justiça Eleitoral', NULL),
  ('certidao_negativa_civil', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão cível', NULL),
  ('certidao_negativa_criminal', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão criminal', NULL),
  ('certidao_antecedente_estadual', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão de antecedentes estadual', NULL),
  ('certidao_antecedente_municipal', 90, 'dias', false, 7, 'Lei nº 7.115/83', 'Certidão de antecedentes municipal', NULL),

  -- Laudos: 12 meses
  ('laudo_psicologico', 12, 'meses', false, 30, 'Decreto 9.847/19, art. 21', 'Laudo psicológico', 'Válido por 12 meses'),
  ('laudo_capacidade_tecnica', 12, 'meses', false, 30, 'Decreto 9.847/19, art. 21', 'Laudo de capacidade técnica', 'Válido por 12 meses'),

  -- Residência: aproximação de 1 mês (próxima leitura da conta prevalece)
  ('comprovante_endereco', 1, 'meses', false, 7, 'Praxe administrativa PF', 'Comprovante de residência', 'Vence na próxima leitura impressa na conta quando informada'),
  ('comprovante_residencia', 1, 'meses', false, 7, 'Praxe administrativa PF', 'Comprovante de residência', 'Vence na próxima leitura impressa na conta quando informada'),

  -- Ocupação lícita: 30 dias, exceto nota fiscal (perpétua)
  ('cartao_cnpj', 30, 'dias', false, 7, 'Praxe administrativa PF', 'Cartão CNPJ', 'Documento recente da Receita Federal'),
  ('ccmei', 30, 'dias', false, 7, 'Praxe administrativa PF', 'CCMEI', NULL),
  ('quadro_societario_qsa', 30, 'dias', false, 7, 'Praxe administrativa PF', 'Quadro societário (QSA)', 'Herda a emissão do cartão CNPJ quando não traz data própria'),
  ('contracheque', 30, 'dias', false, 7, 'Praxe administrativa PF', 'Contracheque', NULL),
  ('holerite', 30, 'dias', false, 7, 'Praxe administrativa PF', 'Holerite', NULL),
  ('decore', 30, 'dias', false, 7, 'Praxe administrativa PF', 'DECORE', NULL),
  ('extrato_inss', 30, 'dias', false, 7, 'Praxe administrativa PF', 'Extrato de benefício INSS', NULL),
  ('nota_fiscal', 0, 'dias', true, 0, 'Sem prazo legal', 'Nota fiscal', 'Validade perpétua — comprova ocupação lícita na data do fato'),
  ('contrato_social', 0, 'dias', true, 0, 'Sem prazo legal', 'Contrato social', 'Documento constitutivo — perpétuo'),

  -- Identidade / filiação / procuração
  ('documento_identidade', 120, 'meses', false, 30, 'Praxe administrativa PF', 'Documento de identidade', 'CNH/CIN/RG — 10 anos'),
  ('identidade_funcional', 0, 'dias', true, 0, 'Sem prazo legal', 'Identidade funcional', 'Quando marcada INDETERM. / VITALÍCIA'),
  ('comprovante_filiacao_entidade_tiro', 12, 'meses', false, 30, 'Anuidade da entidade', 'Filiação a clube de tiro', 'Anuidade de 12 meses'),
  ('procuracao', 12, 'meses', false, 90, 'Praxe administrativa', 'Procuração', 'Renovação exige nova assinatura Gov.br'),

  -- Registros com prazo próprio de 12 meses
  ('craf', 12, 'meses', false, 120, 'Decreto 9.847/19', 'CRAF', NULL),
  ('gte', 12, 'meses', false, 120, 'Decreto 9.847/19', 'Guia de Trânsito', NULL),
  ('cr', 12, 'meses', false, 120, 'Decreto 9.847/19', 'Certificado de Registro (CR)', NULL),

  -- Sem vencimento
  ('certidao_nascimento', 0, 'dias', true, 0, 'Sem prazo legal', 'Certidão de nascimento', NULL),
  ('certidao_casamento', 0, 'dias', true, 0, 'Sem prazo legal', 'Certidão de casamento', NULL),
  ('declaracao_responsavel_imovel', 0, 'dias', true, 0, 'Sem prazo legal', 'Declaração do responsável pelo imóvel', 'Declarações não vencem isoladamente'),
  ('declaracao_compromisso_treino', 0, 'dias', true, 0, 'Sem prazo legal', 'Declaração de compromisso de treino', NULL),
  ('declaracao_sem_inquerito_processo_criminal', 0, 'dias', true, 0, 'Sem prazo legal', 'Declaração de ausência de inquérito', NULL),
  ('foto_3x4', 0, 'dias', true, 0, 'Sem prazo legal', 'Foto 3x4', NULL)
ON CONFLICT (tipo_documento) DO UPDATE SET
  validade_dias = EXCLUDED.validade_dias,
  unidade       = EXCLUDED.unidade,
  perpetuo      = EXCLUDED.perpetuo,
  alerta_dias   = EXCLUDED.alerta_dias,
  base_legal    = COALESCE(EXCLUDED.base_legal, public.qa_validade_documentos.base_legal),
  rotulo        = COALESCE(EXCLUDED.rotulo, public.qa_validade_documentos.rotulo),
  observacao    = COALESCE(EXCLUDED.observacao, public.qa_validade_documentos.observacao),
  ativo         = true,
  updated_at    = now();

-- comprovante_endereco_5_anos é histórico: nunca vence
UPDATE public.qa_validade_documentos
   SET perpetuo = true, validade_dias = 0, alerta_dias = 0, updated_at = now()
 WHERE tipo_documento = 'comprovante_endereco_5_anos';

-- ── Função canônica de cálculo ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_calcular_validade(
  _tipo_documento text,
  _data_emissao   date
)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _data_emissao IS NULL THEN NULL
    WHEN v.tipo_documento IS NULL THEN NULL
    WHEN v.perpetuo OR v.validade_dias = 0 THEN NULL
    WHEN v.unidade = 'meses' THEN (_data_emissao + (v.validade_dias || ' months')::interval)::date
    ELSE (_data_emissao + (v.validade_dias || ' days')::interval)::date
  END
  FROM (SELECT 1) x
  LEFT JOIN public.qa_validade_documentos v
    ON v.tipo_documento = lower(trim(_tipo_documento)) AND v.ativo
$$;

GRANT EXECUTE ON FUNCTION public.qa_calcular_validade(text, date) TO authenticated, service_role;