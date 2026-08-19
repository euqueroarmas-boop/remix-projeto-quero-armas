-- =============================================================================
-- A LIBERAÇÃO DE ETAPA PASSA A SEGUIR O QUE O CLIENTE JÁ ENTREGOU
--
-- ACHADO (19/08/2026, auditoria do processo do Gilson).
-- O processo dele estava com `etapa_liberada_ate = 1` (endereço), embora ele já
-- tivesse entregue a etapa de renda INTEIRA (CCMEI, cartão CNPJ, QSA e nota
-- fiscal) e as SETE certidões de antecedentes.
--
-- A tela da equipe mostra só os documentos da etapa liberada
-- (`docVisivelPorEtapa`, em ProcessoDetalheDrawer). Com a etapa presa em 1, a
-- equipe via apenas o comprovante de endereço — tudo o que o cliente entregou
-- depois disso ficou invisível para quem precisa conferir.
--
-- POR QUE ACONTECEU.
-- A liberação é um BOTÃO MANUAL ("FORÇAR LIBERAR ETAPA"). Enquanto o cliente
-- trabalha sozinho pelo Hub — que não usa essa trava, usa grupos —, ninguém
-- precisa clicar em nada. Aí o cliente anda e a tela da equipe não anda junto.
-- Não é caso do Gilson: acontece com qualquer processo em que ninguém lembrou
-- de clicar.
--
-- Decisão do usuário (20/08/2026): a liberação deixa de ser manual e passa a
-- acompanhar o que o cliente já entregou.
--
-- A REGRA, EM UMA FRASE: a etapa liberada nunca fica atrás da etapa mais
-- avançada em que o cliente JÁ ENTREGOU alguma coisa.
--
--   • Só CONTA ENTREGA, não pendência. É isso que "acompanhar o que o cliente
--     já entregou" quer dizer, e é o que evita a armadilha do cálculo por
--     "etapa completa": passos como requerimento, GRU, gov.br e juntada caem em
--     "outros" (etapa 1) e ficam pendentes até o dia do protocolo — por eles, a
--     etapa 1 NUNCA fecharia e o processo ficaria preso no 1 para sempre.
--     Foi exatamente o que aconteceu.
--   • NUNCA ANDA PARA TRÁS (`GREATEST`). Se a equipe forçou uma etapa à frente,
--     o automático respeita e não puxa de volta.
--   • Reusa `qa_etapa_documento`, o mapa de etapas que já existe no banco. Não
--     se cria aqui uma terceira cópia da regra.
--
-- RESSALVA CONHECIDA, que esta migration NÃO resolve: existe uma segunda cópia
-- do mapa de etapas em TypeScript (`etapaDoTipo`, em ProcessoDetalheDrawer),
-- usada para decidir o que aparece na tela. Ela e `qa_categoria_documento`
-- precisam concordar. Divergência entre as duas já era possível antes disto
-- (com liberação manual) e continua sendo — unificá-las é trabalho à parte.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) Até onde o cliente chegou, pelo que ele ENTREGOU ─────────────────
CREATE OR REPLACE FUNCTION public.qa_etapa_alcancada_por_entregas(p_processo_id uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT GREATEST(
           1::smallint,
           LEAST(
             5::smallint,
             COALESCE(MAX(public.qa_etapa_documento(pd.tipo_documento)), 1::smallint)
           )
         )
    FROM public.qa_processo_documentos pd
   WHERE pd.processo_id = p_processo_id
     AND pd.status IN (
       'aprovado', 'validado', 'entregue_pelo_hub',
       'dispensado', 'dispensado_grupo', 'dispensado_por_reaproveitamento',
       'concluido', 'concluído'
     );
$$;

COMMENT ON FUNCTION public.qa_etapa_alcancada_por_entregas(uuid) IS
  'Etapa mais avançada (1..5) em que o processo JÁ TEM documento entregue. '
  'Só olha entrega, nunca pendência.';

-- ─── 2) Aplica a regra, sem nunca andar para trás ────────────────────────
CREATE OR REPLACE FUNCTION public.qa_realinhar_etapa_liberada(p_processo_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proc      RECORD;
  v_alcancada smallint;
  v_nova      smallint;
  v_total     integer := 0;
BEGIN
  FOR v_proc IN
    SELECT p.id, COALESCE(p.etapa_liberada_ate, 1)::smallint AS atual
      FROM public.qa_processos p
     WHERE p.status NOT IN ('concluido', 'cancelado', 'excluido_lgpd')
       AND (p_processo_id IS NULL OR p.id = p_processo_id)
  LOOP
    v_alcancada := public.qa_etapa_alcancada_por_entregas(v_proc.id);
    v_nova := GREATEST(v_proc.atual, v_alcancada);

    IF v_nova IS DISTINCT FROM v_proc.atual THEN
      UPDATE public.qa_processos
         SET etapa_liberada_ate = v_nova,
             updated_at = now()
       WHERE id = v_proc.id;

      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator, dados_json)
      VALUES (
        v_proc.id,
        'etapa_liberada_automaticamente',
        'ETAPA ' || v_nova || ' LIBERADA AUTOMATICAMENTE: o cliente já entregou documento dessa etapa.',
        'sistema',
        jsonb_build_object(
          'etapa_anterior', v_proc.atual,
          'etapa_nova', v_nova,
          'modo', 'automatico',
          'criterio', 'maior etapa com documento entregue'
        )
      );

      v_total := v_total + 1;
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.qa_realinhar_etapa_liberada(uuid) IS
  'Sobe etapa_liberada_ate até a etapa mais avançada já entregue pelo cliente. '
  'Nunca reduz — liberação manual da equipe é preservada. '
  'Sem argumento, vale para todos os processos abertos.';

GRANT EXECUTE ON FUNCTION public.qa_etapa_alcancada_por_entregas(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qa_realinhar_etapa_liberada(uuid) TO authenticated, service_role;

-- ─── 3) Backfill: acerta todo processo aberto, agora ─────────────────────
DO $$
DECLARE v_n integer;
BEGIN
  SELECT public.qa_realinhar_etapa_liberada(NULL) INTO v_n;
  RAISE NOTICE 'Processos com etapa liberada realinhada: %', v_n;
END $$;

-- ─── 4) Daqui em diante, sozinho ─────────────────────────────────────────
-- Toda vez que uma exigência passa a contar como entregue, o processo
-- reavalia. Não há recursão: o gatilho escreve em `qa_processos`, não em
-- `qa_processo_documentos`.
CREATE OR REPLACE FUNCTION public.qa_tg_etapa_liberada_segue_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN (
       'aprovado', 'validado', 'entregue_pelo_hub',
       'dispensado', 'dispensado_grupo', 'dispensado_por_reaproveitamento',
       'concluido', 'concluído'
     )
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    PERFORM public.qa_realinhar_etapa_liberada(NEW.processo_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_etapa_liberada_segue_entrega ON public.qa_processo_documentos;

CREATE TRIGGER trg_qa_etapa_liberada_segue_entrega
  AFTER INSERT OR UPDATE OF status
  ON public.qa_processo_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_tg_etapa_liberada_segue_entrega();

COMMIT;
