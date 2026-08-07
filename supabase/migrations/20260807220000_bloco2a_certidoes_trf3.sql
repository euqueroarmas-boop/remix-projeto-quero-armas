-- =============================================================================
-- BLOCO 2A de 7 — CERTIDÕES: TRF3 e os dois apelidos confirmados
--
-- Parte SEGURA do bloco de certidões: só mexe no que não tem ambiguidade.
-- A convergência `certidao_* → antecedentes_*` e a questão do 2º grau ficam
-- para o 2B, porque envolvem colapsar documentos distintos e precisam de
-- decisão antes.
--
-- ─── 1) O slug do TRF3/SJSP existe em três grafias ───────────────────────
--   certidao_federal_trf3_sjsp_jef                                (canônico)
--   certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari  (truncado
--                                em 60 chars — é ESTE que está no banco)
--   certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciaria_e_
--     juizado_especial_federal_de_sao_paulo         (só no frontend)
--
-- Decisão do usuário (07/08/2026): as três são o MESMO documento — a certidão
-- da Seção Judiciária de SP com Juizado Especial Federal. Ficam reduzidas ao
-- canônico.
--
-- Ordem importa: as exigências são MIGRADAS antes de os apelidos saírem. Se
-- os apelidos saíssem primeiro, as exigências com o nome truncado ficariam
-- órfãs — sem tipo no Hub e sem ponte, nunca mais fechariam.
--
-- ─── 2) TRF3 continua sendo DUAS exigências ──────────────────────────────
-- Para SP e MS a Justiça Federal cobra duas certidões distintas:
--   certidao_federal_trf3_regional  'Certidão Federal TRF3 — Abrangência Regional'
--   certidao_federal_trf3_sjsp_jef  'Certidão Federal TRF3 — Seção Judiciária de São Paulo (SJSP/JEF)'
-- Uma não substitui a outra. Este bloco não as junta — apenas garante que os
-- nomes exibidos sejam esses.
--
-- ─── 3) Dois apelidos confirmados pelo usuário ───────────────────────────
-- Slugs ativos no catálogo cujo tipo do Hub não tinha ponte. O cliente
-- entregava, o documento gravava certo, e a exigência ficava pendente.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) Migra as exigências das grafias variantes para o canônico ────────
-- Caso A: o processo NÃO tem o canônico — a exigência é renomeada.
UPDATE public.qa_processo_documentos pd
   SET tipo_documento = 'certidao_federal_trf3_sjsp_jef',
       nome_documento = 'Certidão Federal TRF3 — Seção Judiciária de São Paulo (SJSP/JEF)',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Grafia normalizada para certidao_federal_trf3_sjsp_jef (era ' || pd.tipo_documento || ').',
       updated_at = now()
 WHERE pd.tipo_documento IN (
         'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari',
         'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciaria_e_juizado_especial_federal_de_sao_paulo'
       )
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_processo_documentos x
      WHERE x.processo_id = pd.processo_id
        AND x.tipo_documento = 'certidao_federal_trf3_sjsp_jef'
   );

-- Caso B: o processo JÁ tem o canônico — a variante é duplicata. Marcada como
-- nao_aplicavel, não apagada: a linha é histórico e pode ter arquivo anexado.
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Duplicata de certidao_federal_trf3_sjsp_jef, que já existe neste processo.',
       updated_at = now()
 WHERE pd.tipo_documento IN (
         'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari',
         'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciaria_e_juizado_especial_federal_de_sao_paulo'
       )
   AND pd.status NOT IN ('aprovado','nao_aplicavel');

-- Catálogo deixa de emitir as variantes.
UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE tipo_documento IN (
   'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari',
   'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciaria_e_juizado_especial_federal_de_sao_paulo'
 );

-- Só agora os apelidos das variantes podem sair.
DELETE FROM public.qa_tipo_documento_aliases
 WHERE processo_tipo IN (
   'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari',
   'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciaria_e_juizado_especial_federal_de_sao_paulo'
 );

-- ─── 2) Nomes exibidos das duas exigências do TRF3 ───────────────────────
UPDATE public.qa_servicos_documentos
   SET nome_documento = 'Certidão Federal TRF3 — Abrangência Regional', updated_at = now()
 WHERE tipo_documento = 'certidao_federal_trf3_regional';

UPDATE public.qa_processo_documentos
   SET nome_documento = 'Certidão Federal TRF3 — Abrangência Regional', updated_at = now()
 WHERE tipo_documento = 'certidao_federal_trf3_regional';

UPDATE public.qa_servicos_documentos
   SET nome_documento = 'Certidão Federal TRF3 — Seção Judiciária de São Paulo (SJSP/JEF)', updated_at = now()
 WHERE tipo_documento = 'certidao_federal_trf3_sjsp_jef';

UPDATE public.qa_processo_documentos
   SET nome_documento = 'Certidão Federal TRF3 — Seção Judiciária de São Paulo (SJSP/JEF)', updated_at = now()
 WHERE tipo_documento = 'certidao_federal_trf3_sjsp_jef';

-- ─── 3) Apelidos confirmados ─────────────────────────────────────────────
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_estadual_distribuicao_acoes_criminais', 'antecedentes_estadual_distribuicao'),
  ('certidao_estadual_execucoes_criminais',          'antecedentes_estadual_execucoes')
ON CONFLICT DO NOTHING;

-- ─── 4) Reavalia as exigências de certidão em aberto ─────────────────────
SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'bloco2a_certidoes_trf3')
  FROM public.qa_processos p
 WHERE COALESCE(p.status, 'ativo') NOT IN ('finalizado','deferido','indeferido','cancelado','arquivado')
   AND EXISTS (
     SELECT 1 FROM public.qa_processo_documentos pd
      WHERE pd.processo_id = p.id
        AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
        AND pd.tipo_documento LIKE 'certidao_%'
   );

COMMIT;
