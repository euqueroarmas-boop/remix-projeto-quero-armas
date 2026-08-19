-- =============================================================================
-- COMPROVANTE DE RESIDÊNCIA: 30 DIAS, E O NOME PASSA A DIZER ISSO
--
-- DECISÃO DO USUÁRIO (19/08/2026). O nome e o prazo discordavam:
--
--   • Onde havia prazo preenchido, ele era 30.
--   • Vários serviços chamavam a exigência de "Comprovante de residência
--     (últimos 90 dias)" — e é ESSE texto que o cliente lê no portal.
--
-- Ou seja: o sistema aceitava 30, o cliente lia 90. Quem seguisse o que está
-- escrito na tela traria um documento que o sistema já considera vencido.
--
-- Decisão: vale 30. O número fica, o NOME é que se corrige.
--
-- O QUE MUDA:
--   1. Todo serviço sem prazo para `comprovante_residencia` passa a ter 30.
--   2. "(últimos 90 dias)" vira "(últimos 30 dias)" no catálogo.
--   3. E também nos PROCESSOS ABERTOS — a linha do checklist guarda a própria
--      cópia do nome, e é ela que aparece para o cliente. Corrigir só o
--      catálogo deixaria quem já está em andamento lendo 90.
--
-- O QUE NÃO MUDA: `comprovante_residencia_ano_1` a `_ano_4`. São prova de onde
-- a pessoa morava em 2022, 2023, 2024 e 2025 — documento histórico não vence,
-- e o ano dele não muda. Continuam sem prazo, de propósito.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) O prazo ──────────────────────────────────────────────────────────
UPDATE public.qa_servicos_documentos sd
   SET validade_dias = 30,
       updated_at    = now()
 WHERE sd.ativo = true
   AND sd.validade_dias IS NULL
   AND lower(sd.tipo_documento) = 'comprovante_residencia';

-- ─── 2) O nome, no catálogo ──────────────────────────────────────────────
UPDATE public.qa_servicos_documentos sd
   SET nome_documento = replace(sd.nome_documento, '90 dias', '30 dias'),
       updated_at     = now()
 WHERE lower(sd.tipo_documento) = 'comprovante_residencia'
   AND sd.nome_documento LIKE '%90 dias%';

-- ─── 3) O nome, em quem já está em andamento ─────────────────────────────
-- É esta cópia que o cliente enxerga no portal.
UPDATE public.qa_processo_documentos pd
   SET nome_documento = replace(pd.nome_documento, '90 dias', '30 dias')
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND p.status NOT IN ('concluido', 'cancelado', 'excluido_lgpd')
   AND lower(pd.tipo_documento) = 'comprovante_residencia'
   AND pd.nome_documento LIKE '%90 dias%';

-- ─── 4) Propaga: catálogo → processos abertos → datas de validade ────────
DO $$
DECLARE v_r jsonb;
BEGIN
  SELECT public.qa_manutencao_validade_documentos() INTO v_r;
  RAISE NOTICE 'Propagação imediata: %', v_r;
END $$;

COMMIT;
