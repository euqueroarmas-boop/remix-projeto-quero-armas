-- ============================================================================
-- ETAPAS DE LIBERAÇÃO + PRAZOS DE DOCUMENTOS (Quero Armas)
-- ============================================================================

-- 1) Em qa_processos: controla qual etapa do checklist está liberada para o cliente
--    e marcos de prazo do processo (mês de protocolo, 1º doc aprovado, etc).
ALTER TABLE public.qa_processos
  ADD COLUMN IF NOT EXISTS etapa_liberada_ate smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mes_protocolo_alvo date,                 -- 1º dia do mês alvo (ex: 2026-03-01)
  ADD COLUMN IF NOT EXISTS primeiro_doc_aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_critico_data date,                 -- menor validade calculada
  ADD COLUMN IF NOT EXISTS prazo_critico_doc_id uuid,               -- doc que dita o menor prazo
  ADD COLUMN IF NOT EXISTS observacao_prazo text;

COMMENT ON COLUMN public.qa_processos.etapa_liberada_ate IS
  'Maior número de etapa visível ao cliente. 1=Endereço, 2=Antecedentes, 3=Declarações, 4=Laudos.';

COMMENT ON COLUMN public.qa_processos.mes_protocolo_alvo IS
  'Primeiro dia do mês em que o processo será protocolado na PF. Documentos do mês corrente são válidos para esse mês.';

-- 2) Em qa_processo_documentos: dados extraídos pela IA + datas que governam validade.
ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS data_emissao date,
  ADD COLUMN IF NOT EXISTS proxima_leitura date,            -- só p/ contas de consumo (energia, água)
  ADD COLUMN IF NOT EXISTS data_validade_efetiva date,       -- min(emissao+validade_dias, proxima_leitura)
  ADD COLUMN IF NOT EXISTS extracao_ia_status text DEFAULT 'pendente'  -- pendente | extraido | confirmado | erro
    CHECK (extracao_ia_status IN ('pendente','extraido','confirmado','erro')),
  ADD COLUMN IF NOT EXISTS extracao_ia_json jsonb,           -- payload bruto retornado pela IA
  ADD COLUMN IF NOT EXISTS confirmado_pelo_cliente_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_qa_proc_docs_validade_efetiva
  ON public.qa_processo_documentos(processo_id, data_validade_efetiva)
  WHERE data_validade_efetiva IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_processos_etapa_liberada
  ON public.qa_processos(etapa_liberada_ate);

-- 3) Catálogo central de validades por tipo de documento (override por processo continua via qa_processo_documentos.validade_dias).
CREATE TABLE IF NOT EXISTS public.qa_validade_documentos (
  tipo_documento text PRIMARY KEY,
  validade_dias integer NOT NULL,
  base_legal text,
  observacao text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_validade_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QA staff lê validades" ON public.qa_validade_documentos;
CREATE POLICY "QA staff lê validades" ON public.qa_validade_documentos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_usuarios_perfis p
    WHERE p.user_id = auth.uid() AND p.ativo = true
  ));

DROP POLICY IF EXISTS "QA admin gerencia validades" ON public.qa_validade_documentos;
CREATE POLICY "QA admin gerencia validades" ON public.qa_validade_documentos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_usuarios_perfis p
    WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.qa_usuarios_perfis p
    WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'
  ));

-- Tabela base com as regras confirmadas pelo cliente
INSERT INTO public.qa_validade_documentos (tipo_documento, validade_dias, base_legal, observacao) VALUES
  ('comprovante_endereco',           90, 'Praxe administrativa PF',     'Conta de consumo: vence na próxima leitura informada se for antes dos 90 dias'),
  ('comprovante_endereco_5_anos',    90, 'Praxe administrativa PF',     'Histórico documental — sem prazo, mas precisa estar consistente'),
  ('certidao_antecedente_estadual',  30, 'Praxe administrativa PF',     'Certidões estaduais e municipais'),
  ('certidao_antecedente_municipal', 30, 'Praxe administrativa PF',     'Certidões estaduais e municipais'),
  ('certidao_antecedente_federal',   90, 'Lei nº 7.115/83',             'Certidões federais (PF/JF)'),
  ('certidao_negativa_pf',           90, 'Lei nº 7.115/83',             'Certidão negativa Polícia Federal'),
  ('certidao_negativa_jf',           90, 'Lei nº 7.115/83',             'Certidão negativa Justiça Federal'),
  ('certidao_negativa_civil',        30, 'Praxe administrativa PF',     'Certidão cível estadual'),
  ('certidao_negativa_criminal',     30, 'Praxe administrativa PF',     'Certidão criminal estadual'),
  ('laudo_psicologico',              365, 'Decreto 9.847/19, art. 21', 'Laudo psicológico válido por 12 meses'),
  ('laudo_capacidade_tecnica',       365, 'Decreto 9.847/19, art. 21', 'Laudo de capacidade técnica válido por 12 meses'),
  ('declaracao_responsavel_imovel',   0, 'Sem prazo legal',             'Declarações não vencem isoladamente'),
  ('declaracao_compromisso_treino',   0, 'Sem prazo legal',             'Declarações não vencem isoladamente'),
  ('declaracao_sem_inquerito_processo_criminal', 0, 'Sem prazo legal', 'Declarações não vencem isoladamente')
ON CONFLICT (tipo_documento) DO UPDATE SET
  validade_dias = EXCLUDED.validade_dias,
  base_legal = EXCLUDED.base_legal,
  observacao = EXCLUDED.observacao,
  updated_at = now();
