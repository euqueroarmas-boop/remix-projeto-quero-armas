-- =============================================================================
-- DOCUMENTO "DO MÊS" VENCE NO FIM DO MÊS, NÃO 30 DIAS DEPOIS
--
-- DECISÃO DO USUÁRIO (19/08/2026), fechando a ressalva do holerite do Mizael:
-- "Deixe como holerite do mês. Marque o tempo pra vencer e virou o mês, pede
-- holerite novo."
--
-- O QUE ESTAVA ERRADO. A migration anterior (20260819090000) calculou a validade
-- do holerite dele somando o prazo do catálogo (30 dias) à data de entrega:
-- 15/08 + 30 = 14/09. Mas holerite não vale 30 dias corridos — ele vale o MÊS a
-- que se refere. Um holerite de agosto não serve para protocolar em setembro,
-- ainda que tenha "30 dias de idade". A conta antiga dava folga onde não há.
--
-- A REGRA CERTA, para todo documento "do mês atual" / "do último mês":
-- vence no ÚLTIMO DIA do mês de referência. Virou o mês, pede um novo.
--
-- Os dias continuam corridos — mês corrido, dia corrido, sem contagem útil.
-- O que muda é só o marco: fim do mês em vez de +30.
--
-- QUAL É O MÊS DE REFERÊNCIA. O melhor sinal disponível, nesta ordem:
--   1. `dc.data_emissao` — quando o arquivo trouxe a data.
--   2. `pd.data_envio`   — a entrega, quando não há emissão.
-- Nos dois casos vale o mês da data, e o vencimento é o último dia dele.
--
-- POR QUE ESTA REGRA PODE SOBRESCREVER DATA JÁ GRAVADA (a anterior não podia):
-- holerite, contracheque e comprovante de benefício NÃO TRAZEM data de validade
-- impressa. Nenhum "válido até" foi lido de documento nenhum — toda data que
-- existe nessas linhas foi CALCULADA por algum caminho do sistema. Recalcular
-- pela regra certa não apaga informação de ninguém; corrige uma conta.
-- Documento com validade de verdade (certidão, cartão CNPJ) não entra aqui.
--
-- EFEITO IMEDIATO, e por que é seguro: encurta a validade de quem tinha folga
-- indevida (Mizael 14/09 → 31/08; Anthony 06/09 → 31/08). Ninguém é incomodado
-- por isso: pela regra de 20260819080000, documento vencido é MARCADO como
-- vencido e a reemissão só é pedida quando o processo fica pronto para
-- protocolar. Encurtar a data avisa a equipe cedo, sem cobrar o cliente.
--
-- Idempotente: recalcula sempre, escreve só quando o valor muda.
-- =============================================================================

BEGIN;

-- ─── 1) Quais documentos são "do mês" ────────────────────────────────────
-- Casa pelo TIPO e, como rede, pelo NOME que o cliente vê — com e sem acento,
-- porque o catálogo tem as duas grafias e `unaccent` não está garantida aqui.
CREATE OR REPLACE FUNCTION public.qa_documento_do_mes(p_tipo text, p_nome text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT
    lower(coalesce(p_tipo, '')) LIKE '%mes_atual%'
    OR lower(coalesce(p_tipo, '')) LIKE '%ultimo_mes%'
    OR lower(coalesce(p_tipo, '')) LIKE '%mes_vigente%'
    OR lower(coalesce(p_tipo, '')) = 'renda_comprovante_beneficio'
    OR lower(coalesce(p_nome, '')) LIKE '%mês atual%'
    OR lower(coalesce(p_nome, '')) LIKE '%mes atual%'
    OR lower(coalesce(p_nome, '')) LIKE '%último mês%'
    OR lower(coalesce(p_nome, '')) LIKE '%ultimo mes%';
$$;

COMMENT ON FUNCTION public.qa_documento_do_mes(text, text) IS
  'Documento preso ao MÊS de referência (holerite, contracheque, comprovante de '
  'benefício). Vence no último dia do mês, não em prazo de dias.';

-- ─── 2) A conta da validade passa a distinguir os dois casos ─────────────
CREATE OR REPLACE FUNCTION public.qa_preencher_validade_por_prazo_catalogo()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_total integer := 0;
BEGIN
  WITH base AS (
    SELECT dc.id                                             AS doc_id,
           min(pd.validade_dias)                             AS validade_dias,
           COALESCE(dc.data_emissao, min(pd.data_envio)::date) AS dt_base,
           (dc.data_emissao IS NOT NULL)                     AS base_e_emissao,
           bool_or(public.qa_documento_do_mes(pd.tipo_documento, pd.nome_documento))
                                                             AS do_mes,
           dc.data_validade                                  AS validade_atual,
           dc.tipo_documento,
           dc.qa_cliente_id
      FROM public.qa_documentos_cliente dc
      JOIN public.qa_processo_documentos pd
        ON pd.arquivo_storage_key = dc.arquivo_storage_path
      JOIN public.qa_processos p
        ON p.id = pd.processo_id
     WHERE pd.validade_dias IS NOT NULL
       AND public.qa_processo_em_aberto(p.status)
       AND pd.status IN (
         'aprovado', 'validado', 'entregue_pelo_hub',
         'dispensado', 'dispensado_grupo', 'dispensado_por_reaproveitamento'
       )
     GROUP BY dc.id, dc.data_emissao, dc.data_validade, dc.tipo_documento, dc.qa_cliente_id
  ),
  calculada AS (
    SELECT b.*,
           CASE
             -- Documento do MÊS: último dia do mês de referência.
             WHEN b.do_mes THEN
               (date_trunc('month', b.dt_base) + interval '1 month - 1 day')::date
             -- Demais: prazo do catálogo, em dias corridos.
             ELSE b.dt_base + b.validade_dias
           END AS validade_nova
      FROM base b
     WHERE b.dt_base IS NOT NULL
  ),
  alvo AS (
    SELECT c.*
      FROM calculada c
     WHERE
       -- Documento do mês: corrige sempre que a conta antiga divergir. Não há
       -- "válido até" impresso nesses papéis, então toda data ali foi
       -- calculada — recalcular não apaga informação de ninguém.
       (c.do_mes AND c.validade_nova IS DISTINCT FROM c.validade_atual)
       -- Demais: só preenche o que está em branco. Data de certidão ou de
       -- cartão CNPJ vem do próprio documento e não se mexe.
       OR (NOT c.do_mes AND c.validade_atual IS NULL)
  ),
  gravadas AS (
    UPDATE public.qa_documentos_cliente dc
       SET data_validade = alvo.validade_nova,
           updated_at    = now()
      FROM alvo
     WHERE dc.id = alvo.doc_id
    RETURNING dc.id, alvo.qa_cliente_id, alvo.tipo_documento, alvo.do_mes,
              alvo.validade_atual, alvo.validade_nova, alvo.validade_dias,
              alvo.dt_base, alvo.base_e_emissao
  )
  INSERT INTO public.qa_documentos_cliente_eventos
    (documento_id, qa_cliente_id, acao, ator_tipo, detalhes)
  SELECT g.id,
         g.qa_cliente_id,
         'editado',
         'sistema',
         jsonb_build_object(
           'motivo', CASE
                       WHEN g.do_mes THEN 'documento do mês: vence no fim do mês de referência'
                       ELSE 'validade ausente calculada pelo prazo do catálogo'
                     END,
           'tipo_documento', g.tipo_documento,
           'regra',        CASE WHEN g.do_mes THEN 'fim_do_mes' ELSE 'prazo_em_dias' END,
           'prazo_dias',   CASE WHEN g.do_mes THEN NULL ELSE g.validade_dias END,
           'base_usada',   CASE WHEN g.base_e_emissao THEN 'data_emissao' ELSE 'data_envio' END,
           'base',         g.dt_base,
           'validade_anterior', g.validade_atual,
           'data_validade', g.validade_nova
         )
    FROM gravadas g;

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.qa_preencher_validade_por_prazo_catalogo() IS
  'Mantém data_validade no acervo. Documento do MÊS (holerite, contracheque, '
  'benefício) vence no último dia do mês de referência e é corrigido sempre. '
  'Os demais só têm a validade PREENCHIDA quando está em branco, pelo prazo do '
  'catálogo em dias corridos — data vinda do próprio documento nunca é tocada.';

REVOKE ALL ON FUNCTION public.qa_preencher_validade_por_prazo_catalogo()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_preencher_validade_por_prazo_catalogo()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.qa_documento_do_mes(text, text)
  TO authenticated, service_role;

-- ─── 3) Corrige agora o que já está gravado errado ───────────────────────
DO $$
DECLARE v_n integer;
BEGIN
  SELECT public.qa_preencher_validade_por_prazo_catalogo() INTO v_n;
  RAISE NOTICE 'Validades corrigidas ou preenchidas: %', v_n;
END $$;

-- O agendamento diário (qa-preencher-validade-ausente-diario, 06:05 UTC) já
-- existe desde 20260819090000 e passa a aplicar esta regra sozinho.

COMMIT;
