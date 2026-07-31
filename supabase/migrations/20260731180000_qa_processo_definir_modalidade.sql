-- =============================================================================
-- Define a modalidade de um processo e ajusta o checklist
--
-- Por que uma função própria, e não um parâmetro em `qa_venda_to_processo`:
-- o checklist é explodido no momento em que o processo nasce. Mudar a
-- assinatura daquela RPC exigiria reescrevê-la inteira, e ela faz muita coisa.
-- Esta função age DEPOIS, e por isso serve para os dois casos que importam:
-- o processo novo, logo após a criação, e os que já existem sem modalidade.
--
-- O que ela faz:
--   1. grava a modalidade no processo;
--   2. REMOVE do checklist as exigências que não se aplicam àquela modalidade
--      (ex.: habitualidade e clube somem para defesa pessoal);
--   3. ACRESCENTA as que passaram a se aplicar e ainda não estavam lá;
--   4. registra o que mudou em qa_processo_eventos.
--
-- Nunca remove exigência já cumprida: documento aprovado não se apaga por
-- mudança de classificação. Se a modalidade mudar e sobrar um documento que
-- não era daquela modalidade, ele fica — e a equipe decide.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.qa_processo_definir_modalidade(
  p_processo_id uuid,
  p_modalidade  text
)
RETURNS TABLE (removidos integer, adicionados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_proc public.qa_processos%ROWTYPE;
  v_mod  text;
  v_rem  integer := 0;
  v_add  integer := 0;
  v_tipos_rem text[] := ARRAY[]::text[];
  v_tipos_add text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % não encontrado', p_processo_id;
  END IF;

  v_mod := NULLIF(TRIM(LOWER(COALESCE(p_modalidade, ''))), '');
  IF v_mod IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.qa_modalidades WHERE codigo = v_mod
  ) THEN
    RAISE EXCEPTION 'Modalidade "%" não existe em qa_modalidades', v_mod;
  END IF;

  UPDATE public.qa_processos
     SET modalidade = v_mod, updated_at = now()
   WHERE id = p_processo_id;

  -- Sem modalidade definida não se filtra nada: volta ao checklist completo.
  IF v_mod IS NULL THEN
    removidos := 0; adicionados := 0; RETURN NEXT; RETURN;
  END IF;

  -- 1) Fora as que não se aplicam — só as ainda pendentes.
  WITH alvo AS (
    SELECT pd.id, pd.tipo_documento
      FROM public.qa_processo_documentos pd
      JOIN public.qa_servicos_documentos sd
        ON sd.servico_id = v_proc.servico_id
       AND sd.tipo_documento = pd.tipo_documento
     WHERE pd.processo_id = p_processo_id
       AND pd.status = 'pendente'
       AND sd.condicao_modalidade IS NOT NULL
       AND NOT (v_mod = ANY(sd.condicao_modalidade))
  ), del AS (
    DELETE FROM public.qa_processo_documentos d
     USING alvo a WHERE d.id = a.id
     RETURNING d.tipo_documento
  )
  SELECT COUNT(*)::int, COALESCE(array_agg(DISTINCT tipo_documento), ARRAY[]::text[])
    INTO v_rem, v_tipos_rem FROM del;

  -- 2) Dentro as que passaram a valer e ainda não estavam no checklist.
  WITH novas AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa, status,
      obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
      instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor,
      prazo_recomendado_dias, escopo
    )
    SELECT p_processo_id, v_proc.cliente_id, sd.tipo_documento, sd.nome_documento,
           CASE WHEN sd.etapa IN ('base','complementar','tecnico','final')
                THEN sd.etapa ELSE 'base' END,
           'pendente', COALESCE(sd.obrigatorio, true),
           sd.validade_dias, sd.formato_aceito, sd.regra_validacao, sd.link_emissao,
           sd.instrucoes, sd.observacoes_cliente, sd.modelo_url, sd.exemplo_url,
           sd.orgao_emissor, sd.prazo_recomendado_dias, COALESCE(sd.escopo, 'processo')
      FROM public.qa_servicos_documentos sd
     WHERE sd.servico_id = v_proc.servico_id
       AND sd.ativo = true
       AND (sd.condicao_profissional IS NULL
            OR sd.condicao_profissional = COALESCE(NULLIF(v_proc.condicao_profissional,''), 'indefinido'))
       AND sd.condicao_modalidade IS NOT NULL
       AND v_mod = ANY(sd.condicao_modalidade)
       AND NOT EXISTS (
         SELECT 1 FROM public.qa_processo_documentos x
          WHERE x.processo_id = p_processo_id
            AND x.tipo_documento = sd.tipo_documento
       )
    RETURNING tipo_documento
  )
  SELECT COUNT(*)::int, COALESCE(array_agg(DISTINCT tipo_documento), ARRAY[]::text[])
    INTO v_add, v_tipos_add FROM novas;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (
    p_processo_id, 'modalidade_definida',
    format('Modalidade "%s": %s exigência(s) removida(s), %s adicionada(s).', v_mod, v_rem, v_add),
    jsonb_build_object('modalidade', v_mod, 'removidos', v_tipos_rem, 'adicionados', v_tipos_add),
    'sistema'
  );

  removidos := v_rem;
  adicionados := v_add;
  RETURN NEXT;
END;
$fn$;

REVOKE ALL ON FUNCTION public.qa_processo_definir_modalidade(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_processo_definir_modalidade(uuid, text) TO authenticated, service_role;

COMMIT;
