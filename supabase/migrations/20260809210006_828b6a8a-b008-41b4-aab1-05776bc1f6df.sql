CREATE OR REPLACE FUNCTION public.qa_painel_progresso_clientes()
RETURNS TABLE (
  processo_id uuid,
  cliente_id integer,
  cliente_nome text,
  cliente_email text,
  servico_nome text,
  status text,
  fase text,
  total_docs integer,
  entregues integer,
  proximo_doc text,
  ultima_atividade timestamptz,
  dias_parado integer,
  cobrancas integer,
  criado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH docs AS (
    SELECT pd.processo_id,
      COUNT(*) FILTER (WHERE COALESCE(pd.obrigatorio, true) AND pd.status <> 'nao_aplicavel')::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(pd.obrigatorio, true) AND pd.status IN ('aprovado','dispensado_grupo','dispensado_por_reaproveitamento'))::int AS ok,
      COUNT(*) FILTER (WHERE COALESCE(pd.obrigatorio, true) AND pd.status <> 'nao_aplicavel'
        AND lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade'))::int AS efetiva_docs,
      COUNT(*) FILTER (WHERE COALESCE(pd.obrigatorio, true)
        AND pd.status IN ('aprovado','dispensado_grupo','dispensado_por_reaproveitamento')
        AND lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade'))::int AS efetiva_docs_ok,
      MAX(pd.data_envio) AS ultimo_envio
    FROM public.qa_processo_documentos pd
    GROUP BY pd.processo_id
  ),
  -- Efetiva necessidade vale pelos seus 11 passos, nao por 1 documento.
  ef AS (
    SELECT
      e.processo_id,
      e.cliente_id,
      (SELECT COUNT(*) FROM public.qa_efetiva_necessidade_provas pv
         WHERE pv.efetiva_necessidade_id = e.id) AS provas_total,
      (SELECT COUNT(*) FROM public.qa_efetiva_necessidade_provas pv
         WHERE pv.efetiva_necessidade_id = e.id AND pv.tipo = 'boletim_ocorrencia') AS bos,
      (SELECT COUNT(*) FROM public.qa_efetiva_necessidade_provas pv
         WHERE pv.efetiva_necessidade_id = e.id AND pv.tipo = 'boletim_ocorrencia'
           AND COALESCE(pv.data_fato, pv.created_at::date) >= (now()::date - 183)) AS bos_recentes,
      e.tem_bo, e.tem_inquerito, e.tem_acao_criminal, e.sofre_ameaca,
      e.relato_cliente, e.contexto_risco, e.narrativa_gerada, e.narrativa_final,
      e.bo_pendente_registro, e.aprovado_cliente,
      EXISTS (
        SELECT 1 FROM public.qa_cliente_ciencias ci
        WHERE ci.cliente_id = e.cliente_id AND ci.termo_codigo = 'bo_efetiva_necessidade'
      ) AS ciencia_bo
    FROM public.qa_efetiva_necessidade e
  ),
  ef_calc AS (
    SELECT
      ef.processo_id,
      11 AS passos_total,
      (
        (CASE WHEN ef.tem_bo IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN ef.tem_inquerito IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN ef.tem_acao_criminal IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN ef.sofre_ameaca IS NOT NULL THEN 1 ELSE 0 END)
      -- relato: cumprido quando ha alguma prova ou o texto atinge o minimo
      + (CASE WHEN NOT (ef.tem_bo IS FALSE AND ef.tem_inquerito IS FALSE
                        AND ef.tem_acao_criminal IS FALSE AND ef.provas_total = 0)
                OR length(COALESCE(btrim(ef.relato_cliente), '')) >= 1000
              THEN 1 ELSE 0 END)
      + (CASE WHEN length(COALESCE(btrim(ef.contexto_risco), '')) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN length(COALESCE(btrim(COALESCE(ef.narrativa_final, ef.narrativa_gerada)), '')) > 0 THEN 1 ELSE 0 END)
      -- entender_bo
      + (CASE WHEN ef.ciencia_bo OR bo_entregue.v THEN 1 ELSE 0 END)
      + (CASE WHEN bo_entregue.v THEN 1 ELSE 0 END)   -- registrar_bo
      + (CASE WHEN bo_entregue.v THEN 1 ELSE 0 END)   -- enviar_bo
      + (CASE WHEN ef.aprovado_cliente IS TRUE THEN 1 ELSE 0 END)
      )::int AS passos_ok
    FROM ef,
    LATERAL (
      SELECT (ef.bos > 0
              AND (ef.bos_recentes > 0 OR ef.bos > 1 OR COALESCE(ef.bo_pendente_registro, false) = false)) AS v
    ) AS bo_entregue
  ),
  prox AS (
    SELECT DISTINCT ON (pd.processo_id) pd.processo_id,
      COALESCE(NULLIF(pd.nome_documento,''), pd.tipo_documento) AS nome
    FROM public.qa_processo_documentos pd
    WHERE pd.status = 'pendente' AND COALESCE(pd.obrigatorio, true)
    ORDER BY pd.processo_id, pd.created_at
  ),
  cob AS (
    SELECT c.processo_id, COUNT(*)::int AS qtd
    FROM public.qa_inatividade_cobrancas c
    WHERE c.status = 'enviado'
    GROUP BY c.processo_id
  ),
  base AS (
    SELECT
      p.id AS processo_id,
      p.cliente_id,
      cl.nome_completo AS cliente_nome,
      cl.email AS cliente_email,
      p.servico_nome,
      p.status,
      -- soma os passos extras da efetiva necessidade (11 no lugar de 1 doc)
      (COALESCE(d.total,0)
        + CASE WHEN COALESCE(d.efetiva_docs,0) > 0 AND efc.passos_total IS NOT NULL
               THEN efc.passos_total - 1 ELSE 0 END)::int AS total_docs,
      (COALESCE(d.ok,0)
        + CASE WHEN COALESCE(d.efetiva_docs,0) > 0 AND efc.passos_ok IS NOT NULL
               THEN efc.passos_ok - COALESCE(d.efetiva_docs_ok,0) ELSE 0 END)::int AS entregues,
      pr.nome AS proximo_doc,
      GREATEST(COALESCE(d.ultimo_envio, p.created_at), p.created_at) AS ultima_atividade,
      COALESCE(cb.qtd, 0) AS cobrancas,
      p.created_at AS criado_em
    FROM public.qa_processos p
    JOIN public.qa_clientes cl ON cl.id = p.cliente_id
    LEFT JOIN docs d ON d.processo_id = p.id
    LEFT JOIN ef_calc efc ON efc.processo_id = p.id
    LEFT JOIN prox pr ON pr.processo_id = p.id
    LEFT JOIN cob cb ON cb.processo_id = p.id
    WHERE p.status NOT IN ('deferido','indeferido','cancelado','arquivado')
      AND COALESCE(cl.status, '') <> 'excluido_lgpd'
  )
  SELECT
    b.processo_id,
    b.cliente_id,
    b.cliente_nome,
    b.cliente_email,
    b.servico_nome,
    b.status,
    CASE
      WHEN b.status IN ('protocolado','deferido','indeferido','em_exigencia') THEN 'ORGAO'
      WHEN b.total_docs > 0 AND b.entregues >= b.total_docs THEN 'PRONTO'
      ELSE 'DOCUMENTOS'
    END AS fase,
    b.total_docs,
    GREATEST(0, LEAST(b.entregues, b.total_docs)) AS entregues,
    b.proximo_doc,
    b.ultima_atividade,
    FLOOR(EXTRACT(EPOCH FROM (now() - b.ultima_atividade)) / 86400)::int AS dias_parado,
    b.cobrancas,
    b.criado_em
  FROM base b;
$$;

GRANT EXECUTE ON FUNCTION public.qa_painel_progresso_clientes() TO authenticated, service_role;