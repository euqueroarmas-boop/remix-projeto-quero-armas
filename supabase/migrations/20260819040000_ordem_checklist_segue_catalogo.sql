-- =============================================================================
-- A ORDEM DO CHECKLIST PASSA A SEGUIR O CATÁLOGO SOZINHA
--
-- ACHADO (19/08/2026, auditoria do processo do Gilson).
-- No catálogo do serviço, o Laudo Psicológico é o item 480 — depois da
-- declaração de efetiva necessidade (440). No processo dele, o mesmo laudo
-- estava como item 290, ANTES dela. A posição 290 pertence a outro documento
-- (holerite de servidor público, hoje inativo): a exigência ficou com uma
-- ordem que não é dela e passou a furar a fila do cliente.
--
-- POR QUE ACONTECEU.
-- A ordem é copiada do catálogo para o processo no momento em que o checklist
-- é montado. Depois disso, mexer no catálogo NÃO reflete em quem já tem
-- processo aberto: existe `qa_sincronizar_checklist_processos_servico`, que
-- faz isso certo, mas é MANUAL — alguém precisa lembrar de chamá-la. Quando o
-- laudo foi reposicionado no catálogo, ninguém chamou, e todos os processos
-- daquele serviço ficaram com a ordem velha.
--
-- Decisão do usuário: "todos os processos devem respeitar isso, e se
-- atualizarmos algo no serviço, vale para todos".
--
-- O QUE ESTA MIGRATION FAZ.
--   1. Realinha a ORDEM de todo processo aberto com a ordem do catálogo.
--   2. Cria um gatilho: mexeu na ordem do catálogo, os processos abertos
--      daquele serviço acompanham na hora. Deixa de depender de memória.
--
-- O QUE ELA NÃO FAZ, DE PROPÓSITO.
--   • Não mexe em `etapa`. Vários processos têm etapa diferente do catálogo
--     (ex.: comprovante de residência gravado como "base" onde o catálogo diz
--     "endereco"), e a etapa decide o que aparece em qual tela. Mudar isso
--     junto seria alterar visibilidade sem ninguém ter pedido.
--   • Não adiciona, não remove e não dispensa exigência nenhuma. Só a ordem.
--     Documento entregue continua entregue.
--   • Só olha linha ATIVA do catálogo: sem regra ativa, não há ordem
--     autoritativa, e a exigência fica como está.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) A ordem autoritativa de cada exigência, vinda do catálogo ─────────
--
-- `DISTINCT ON (pd.id)` porque o mesmo tipo de documento pode ter mais de uma
-- linha no catálogo, uma por condição profissional. A regra ESPECÍFICA da
-- condição do processo ganha da regra geral; empatou, vale a menor ordem.
--
-- O filtro de condição trata a lista separada por vírgula ("autonomo,empresario")
-- do mesmo jeito que a função de sincronizar passou a tratar em 13/08 — sem
-- isso, exigência de MEI ficaria de fora por comparação literal.
CREATE OR REPLACE FUNCTION public.qa_realinhar_ordem_checklist(p_servico_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ajustadas integer := 0;
BEGIN
  WITH alvo AS (
    SELECT DISTINCT ON (pd.id)
           pd.id AS pd_id,
           sd.ordem AS ordem_catalogo
      FROM public.qa_processo_documentos pd
      JOIN public.qa_processos p
        ON p.id = pd.processo_id
      JOIN public.qa_servicos_documentos sd
        ON sd.servico_id = p.servico_id
       AND sd.tipo_documento = pd.tipo_documento
     WHERE p.status NOT IN ('concluido', 'cancelado')
       AND sd.ativo = true
       AND sd.ordem IS NOT NULL
       AND (p_servico_id IS NULL OR p.servico_id = p_servico_id)
       AND (
         sd.condicao_profissional IS NULL
         OR COALESCE(p.condicao_profissional, 'indefinido') = ANY (
              SELECT btrim(lower(x))
                FROM unnest(string_to_array(sd.condicao_profissional, ',')) AS x
            )
       )
     ORDER BY pd.id,
              (sd.condicao_profissional IS NOT NULL) DESC,
              sd.ordem
  ),
  ajuste AS (
    UPDATE public.qa_processo_documentos pd
       SET ordem = a.ordem_catalogo,
           updated_at = now()
      FROM alvo a
     WHERE pd.id = a.pd_id
       AND pd.ordem IS DISTINCT FROM a.ordem_catalogo
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_ajustadas FROM ajuste;

  RETURN COALESCE(v_ajustadas, 0);
END;
$$;

COMMENT ON FUNCTION public.qa_realinhar_ordem_checklist(integer) IS
  'Realinha qa_processo_documentos.ordem com a ordem do catálogo do serviço, '
  'em processos abertos. Sem argumento, vale para todos os serviços. '
  'Só mexe em ordem — não adiciona, não remove e não dispensa exigência.';

GRANT EXECUTE ON FUNCTION public.qa_realinhar_ordem_checklist(integer) TO authenticated, service_role;

-- ─── 2) Backfill: acerta a fila de todo mundo, agora ─────────────────────
DO $$
DECLARE v_n integer;
BEGIN
  SELECT public.qa_realinhar_ordem_checklist(NULL) INTO v_n;
  RAISE NOTICE 'Exigências realinhadas com o catálogo: %', v_n;
END $$;

-- ─── 3) Daqui em diante, o catálogo manda sozinho ────────────────────────
-- Gatilho por LINHA e por TIPO DE DOCUMENTO: mexeu na ordem de um documento
-- do catálogo, só as exigências daquele tipo, naquele serviço, em processo
-- aberto, acompanham. É barato e não toca em mais nada.
CREATE OR REPLACE FUNCTION public.qa_tg_ordem_catalogo_para_processos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ordem IS NULL OR NEW.ativo IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  UPDATE public.qa_processo_documentos pd
     SET ordem = NEW.ordem,
         updated_at = now()
    FROM public.qa_processos p
   WHERE p.id = pd.processo_id
     AND p.servico_id = NEW.servico_id
     AND p.status NOT IN ('concluido', 'cancelado')
     AND pd.tipo_documento = NEW.tipo_documento
     AND pd.ordem IS DISTINCT FROM NEW.ordem
     AND (
       NEW.condicao_profissional IS NULL
       OR COALESCE(p.condicao_profissional, 'indefinido') = ANY (
            SELECT btrim(lower(x))
              FROM unnest(string_to_array(NEW.condicao_profissional, ',')) AS x
          )
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_ordem_catalogo_para_processos ON public.qa_servicos_documentos;

CREATE TRIGGER trg_qa_ordem_catalogo_para_processos
  AFTER INSERT OR UPDATE OF ordem, ativo, condicao_profissional
  ON public.qa_servicos_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_tg_ordem_catalogo_para_processos();

COMMIT;
