-- =============================================================================
-- AS CERTIDÕES DE ANTECEDENTES PASSAM A TER UM PRAZO SÓ
--
-- DECISÃO DO USUÁRIO (19/08/2026): "há certidões que vencem em 30 — normalmente
-- as que não têm data de validade impressa — e há certidões que vencem em 90, e
-- essas trazem a data no próprio documento."
--
-- Conferido contra o acervo real (40 arquivos, 19/08/2026) e contra os parsers.
-- Três parsers leem o prazo de DENTRO do PDF, e são exatamente os que cobrem os
-- quatro tipos de 90 dias:
--
--   TRF3 — "no prazo de 90 (noventa) dias"  → SJSP/JEF e Regional
--   STM  — "válida por N dias"              → Justiça Militar da União
--   TJM  — "PRAZO DE N (...)"               → Justiça Militar estadual
--
-- SSP (Polícia Civil), TJSP Distribuições, TJSP Execuções e TSE não declaram
-- prazo em lugar nenhum do documento. Para essas o prazo é convenção nossa: 30.
--
-- ── O QUE O CATÁLOGO TINHA ──────────────────────────────────────────────────
--   antecedentes_criminais              30 · 60 · 90  (+1 serviço sem prazo)
--   antecedentes_estadual_distribuicao  30 · 60 · 90  (+1 sem prazo)
--   antecedentes_estadual_execucoes     30 · 60 · 90  (+1 sem prazo)
--   antecedentes_eleitoral              30 · 90       (+1 sem prazo)
--   antecedentes_militar                30 · 90
--   antecedentes_federal_trf3_regional  90            (+1 sem prazo)
--   antecedentes_federal_sjsp_jef       90
--   antecedentes_militar_estadual       90
--
-- Os 60 dias não vêm de documento nenhum — aparecem só em dois serviços e são
-- número digitado. O 30 no militar e o 90 no SSP/TJSP/TSE são o mesmo caso.
--
-- ── O QUE MUDA JUNTO, DO LADO DO CÓDIGO ─────────────────────────────────────
-- `src/lib/quero-armas/validadeCertidoes.ts` (novo) passa a ser a tabela única,
-- e o Hub deixa de ter uma segunda lista. Lá o `antecedentes_federal_sjsp_jef`
-- saiu do grupo de um mês para o de 90: é a MESMA certidão do MESMO tribunal
-- que a `trf3_regional`, sai do MESMO parser, e estava classificada diferente.
-- No acervo isso já produziu cinco arquivos com 90 dias e dois com 31 — mesma
-- certidão, validade decidida por o PDF ter saído legível ou não.
--
-- ── POR QUE DÁ PARA CORRIGIR O ACERVO SEM PEDIR NADA A NINGUÉM ──────────────
-- Encurtar validade (os 92 dias do Anthony em SSP e Distribuições) não incomoda
-- cliente: pela regra de 20260819080000, documento vencido é MARCADO como
-- vencido e a reemissão só é pedida quando o processo fica pronto para
-- protocolar. Alongar (os 31 dias indevidos da SJSP/JEF) só devolve tempo.
-- Nos dois casos a equipe passa a ver a data certa.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) A tabela única, no banco ─────────────────────────────────────────
-- Espelho de `src/lib/quero-armas/validadeCertidoes.ts`. As duas mudam juntas.
CREATE OR REPLACE FUNCTION public.qa_prazo_certidao(p_tipo text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE btrim(lower(coalesce(p_tipo, '')))
    -- Declaram o próprio prazo no documento.
    WHEN 'antecedentes_federal_trf3_regional' THEN 90
    WHEN 'antecedentes_federal_sjsp_jef'      THEN 90
    WHEN 'antecedentes_militar'               THEN 90
    WHEN 'antecedentes_militar_estadual'      THEN 90
    -- Não declaram prazo: convenção de 30 dias.
    WHEN 'antecedentes_criminais'             THEN 30
    WHEN 'antecedentes_estadual_distribuicao' THEN 30
    WHEN 'antecedentes_estadual_execucoes'    THEN 30
    WHEN 'antecedentes_eleitoral'             THEN 30
    WHEN 'antecedentes_federal'               THEN 30
    WHEN 'antecedentes_estadual'              THEN 30
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.qa_prazo_certidao(text) IS
  'Prazo canônico da certidão de antecedentes, em dias. 90 para as que trazem a '
  'validade impressa (TRF3, STM, TJM); 30 para as que não trazem (SSP, TJSP, TSE). '
  'Espelho de src/lib/quero-armas/validadeCertidoes.ts.';

GRANT EXECUTE ON FUNCTION public.qa_prazo_certidao(text) TO authenticated, service_role;

-- ─── 2) O catálogo passa a seguir a tabela ───────────────────────────────
UPDATE public.qa_servicos_documentos sd
   SET validade_dias = public.qa_prazo_certidao(sd.tipo_documento),
       updated_at    = now()
 WHERE sd.ativo = true
   AND public.qa_prazo_certidao(sd.tipo_documento) IS NOT NULL
   AND sd.validade_dias IS DISTINCT FROM public.qa_prazo_certidao(sd.tipo_documento);

-- ─── 3) Os processos abertos acompanham ──────────────────────────────────
-- Aqui SOBRESCREVE, ao contrário de `qa_realinhar_validade_dias_checklist`, que
-- só preenche branco. A ressalva daquela função era não saber escolher entre 30
-- e 90; agora há tabela, e a escolha está feita.
UPDATE public.qa_processo_documentos pd
   SET validade_dias = public.qa_prazo_certidao(pd.tipo_documento)
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND p.status NOT IN ('concluido', 'cancelado', 'excluido_lgpd')
   AND public.qa_prazo_certidao(pd.tipo_documento) IS NOT NULL
   AND pd.validade_dias IS DISTINCT FROM public.qa_prazo_certidao(pd.tipo_documento);

-- ─── 4) O acervo: corrige a data de quem ficou com prazo errado ──────────
-- Só onde há data de emissão e onde a data gravada não bate com a tabela.
WITH corrigidas AS (
  UPDATE public.qa_documentos_cliente dc
     SET data_validade = dc.data_emissao + public.qa_prazo_certidao(dc.tipo_documento),
         updated_at    = now()
   WHERE dc.data_emissao IS NOT NULL
     AND public.qa_prazo_certidao(dc.tipo_documento) IS NOT NULL
     AND dc.data_validade IS DISTINCT FROM
         (dc.data_emissao + public.qa_prazo_certidao(dc.tipo_documento))
  RETURNING dc.id, dc.qa_cliente_id, dc.tipo_documento,
            dc.data_emissao, dc.data_validade
)
INSERT INTO public.qa_documentos_cliente_eventos
  (documento_id, qa_cliente_id, acao, ator_tipo, detalhes)
SELECT c.id,
       c.qa_cliente_id,
       'editado',
       'sistema',
       jsonb_build_object(
         'motivo', 'validade da certidão alinhada à tabela única',
         'tipo_documento', c.tipo_documento,
         'regra', CASE WHEN public.qa_prazo_certidao(c.tipo_documento) = 90
                       THEN 'documento declara o prazo (90 dias)'
                       ELSE 'documento não declara prazo (30 dias)' END,
         'data_emissao', c.data_emissao,
         'data_validade', c.data_validade
       )
  FROM corrigidas c;

COMMIT;
