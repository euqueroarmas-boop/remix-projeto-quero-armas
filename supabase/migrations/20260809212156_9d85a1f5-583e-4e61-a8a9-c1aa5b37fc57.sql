CREATE OR REPLACE FUNCTION public.qa_painel_progresso_clientes()
 RETURNS TABLE(processo_id uuid, cliente_id integer, cliente_nome text, cliente_email text, servico_nome text, status text, fase text, total_docs integer, entregues integer, proximo_doc text, ultima_atividade timestamp with time zone, dias_parado integer, cobrancas integer, criado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      + (CASE WHEN NOT (ef.tem_bo IS FALSE AND ef.tem_inquerito IS FALSE
                        AND ef.tem_acao_criminal IS FALSE AND ef.provas_total = 0)
                OR length(COALESCE(btrim(ef.relato_cliente), '')) >= 1000
              THEN 1 ELSE 0 END)
      + (CASE WHEN length(COALESCE(btrim(ef.contexto_risco), '')) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN length(COALESCE(btrim(COALESCE(ef.narrativa_final, ef.narrativa_gerada)), '')) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN ef.ciencia_bo OR bo_entregue.v THEN 1 ELSE 0 END)
      + (CASE WHEN bo_entregue.v THEN 1 ELSE 0 END)
      + (CASE WHEN bo_entregue.v THEN 1 ELSE 0 END)
      + (CASE WHEN ef.aprovado_cliente IS TRUE THEN 1 ELSE 0 END)
      )::int AS passos_ok
    FROM ef,
    LATERAL (
      SELECT (ef.bos > 0
              AND (ef.bos_recentes > 0 OR ef.bos > 1 OR COALESCE(ef.bo_pendente_registro, false) = false)) AS v
    ) AS bo_entregue
  ),
  -- Grupo que o cliente já começou a entregar (prefixo do tipo do último documento aprovado)
  grupo_andamento AS (
    SELECT DISTINCT ON (pd.processo_id)
      pd.processo_id,
      split_part(lower(pd.tipo_documento), '_', 1) AS prefixo
    FROM public.qa_processo_documentos pd
    WHERE pd.status IN ('aprovado','dispensado_grupo','dispensado_por_reaproveitamento')
      AND pd.data_envio IS NOT NULL
    ORDER BY pd.processo_id, pd.data_envio DESC
  ),
  pend AS (
    SELECT
      pd.processo_id,
      COALESCE(NULLIF(pd.nome_documento,''), pd.tipo_documento) AS nome,
      pd.created_at,
      CASE
        WHEN ga.prefixo IS NOT NULL
          AND split_part(lower(pd.tipo_documento), '_', 1) = ga.prefixo
          AND ga.prefixo NOT IN ('documento','comprovante','declaracao') THEN 0
        WHEN lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade')
          OR lower(COALESCE(pd.nome_documento,'')) LIKE '%efetiva necessidade%' THEN 1
        WHEN lower(COALESCE(pd.nome_documento,'') || ' ' || pd.tipo_documento) ~ '(laudo|psicol|capacidade t|habilita|instrutor|exame)' THEN 2
        WHEN lower(COALESCE(pd.nome_documento,'') || ' ' || pd.tipo_documento) ~ '(certid|antecedent)' THEN 3
        WHEN lower(COALESCE(pd.nome_documento,'') || ' ' || pd.tipo_documento) ~ '(requerimento|procura)' THEN 9
        ELSE 5
      END AS prio,
      CASE
        WHEN lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade')
          OR lower(COALESCE(pd.nome_documento,'')) LIKE '%efetiva necessidade%' THEN 'EFETIVA NECESSIDADE'
        WHEN lower(pd.tipo_documento) LIKE 'renda%'
          OR lower(COALESCE(pd.nome_documento,'') || ' ' || pd.tipo_documento) ~ '(nota fiscal|ocupa|renda|contra ?cheque|mei|cnpj)' THEN 'OCUPAÇÃO LÍCITA'
        WHEN lower(COALESCE(pd.nome_documento,'') || ' ' || pd.tipo_documento) ~ '(laudo|psicol|capacidade t|habilita|instrutor|exame)' THEN 'EXAMES'
        WHEN lower(COALESCE(pd.nome_documento,'') || ' ' || pd.tipo_documento) ~ '(certid|antecedent)' THEN 'CERTIDOES'
        WHEN lower(COALESCE(pd.nome_documento,'') || ' ' || pd.tipo_documento) ~ '(requerimento|procura)' THEN 'PROTOCOLO'
        ELSE 'DOCUMENTOS'
      END AS cat
    FROM public.qa_processo_documentos pd
    LEFT JOIN grupo_andamento ga ON ga.processo_id = pd.processo_id
    WHERE pd.status = 'pendente' AND COALESCE(pd.obrigatorio, true)
  ),
  prox AS (
    SELECT DISTINCT ON (p.processo_id) p.processo_id, p.nome, p.prio, p.cat
    FROM pend p
    ORDER BY p.processo_id, p.prio, p.created_at
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
      (COALESCE(d.total,0)
        + CASE WHEN COALESCE(d.efetiva_docs,0) > 0
               THEN COALESCE(efc.passos_total, 11) - 1 ELSE 0 END)::int AS total_docs,
      (COALESCE(d.ok,0)
        + CASE WHEN COALESCE(d.efetiva_docs,0) > 0
               THEN COALESCE(efc.passos_ok, 1) - COALESCE(d.efetiva_docs_ok,0) ELSE 0 END)::int AS entregues,
      pr.nome AS proximo_doc,
      pr.cat AS proximo_cat,
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
      ELSE COALESCE(b.proximo_cat, 'DOCUMENTOS')
    END AS fase,
    b.total_docs,
    GREATEST(0, LEAST(b.entregues, b.total_docs)) AS entregues,
    b.proximo_doc,
    b.ultima_atividade,
    FLOOR(EXTRACT(EPOCH FROM (now() - b.ultima_atividade)) / 86400)::int AS dias_parado,
    b.cobrancas,
    b.criado_em
  FROM base b;
$function$;