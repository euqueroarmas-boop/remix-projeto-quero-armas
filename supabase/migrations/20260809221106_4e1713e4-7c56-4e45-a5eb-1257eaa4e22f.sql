DROP FUNCTION IF EXISTS public.qa_painel_progresso_clientes();

CREATE OR REPLACE FUNCTION public.qa_painel_progresso_clientes()
RETURNS TABLE(
  processo_id uuid,
  cliente_id integer,
  cliente_nome text,
  cliente_email text,
  servico_nome text,
  status text,
  fase text,
  total_docs integer,
  entregues integer,
  dispensados integer,
  reaproveitados integer,
  documentos_pendentes integer,
  perguntas_pendentes integer,
  em_analise integer,
  grupo_atual text,
  grupo_total integer,
  grupo_concluidos integer,
  bloqueado_por_prerequisito boolean,
  proximo_doc text,
  proximo_tipo text,
  ultima_atividade timestamp with time zone,
  dias_parado integer,
  cobrancas integer,
  criado_em timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH processos_base AS (
  SELECT
    p.*,
    sc.slug AS servico_slug,
    sc.ordem_no_pacote,
    sc.pacote_slug,
    COALESCE(p.respostas_questionario_json, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
        'categoria_titular', lower(NULLIF(btrim(cl.categoria_titular), '')),
        'titular_profissao', NULLIF(btrim(cl.profissao), '')
      )) AS respostas,
    cl.nome_completo AS cliente_nome,
    cl.email AS cliente_email
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
  LEFT JOIN public.qa_servicos_catalogo sc ON sc.servico_id = p.servico_id
  WHERE p.status NOT IN ('deferido','indeferido','cancelado','arquivado')
    AND COALESCE(cl.status, '') <> 'excluido_lgpd'
),
prerequisitos AS (
  SELECT
    pb.id AS processo_id,
    EXISTS (
      SELECT 1
      FROM public.qa_servicos_prerequisitos spr
      JOIN public.qa_servicos_catalogo cat_req ON cat_req.slug = spr.prerequisito_slug
      JOIN public.qa_processos p_req
        ON p_req.cliente_id = pb.cliente_id
       AND p_req.servico_id = cat_req.servico_id
      WHERE spr.ativo = true
        AND spr.servico_slug = pb.servico_slug
        AND lower(COALESCE(p_req.status, '')) NOT IN ('concluido','deferido','finalizado')
    ) AS bloqueado
  FROM processos_base pb
),
docs_enriquecidos AS (
  SELECT
    pd.*,
    pb.respostas,
    COALESCE(sd.regra_validacao ->> 'grupo_checklist',
      CASE
        WHEN lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade')
          OR lower(pd.tipo_documento) LIKE '%efetiva_necessidade%' THEN 'efetiva_necessidade'
        WHEN lower(pd.tipo_documento) LIKE 'renda%' OR lower(pd.tipo_documento) LIKE '%ocupacao%'
          OR lower(pd.tipo_documento) LIKE '%contracheque%' OR lower(pd.tipo_documento) LIKE '%cnpj%'
          OR lower(pd.tipo_documento) LIKE '%nota_fiscal%' OR lower(pd.tipo_documento) LIKE '%identidade_funcional%' THEN 'ocupacao'
        WHEN lower(pd.tipo_documento) LIKE 'certidao%' OR lower(pd.tipo_documento) LIKE 'antecedentes%' THEN 'antecedentes'
        WHEN lower(pd.tipo_documento) LIKE '%laudo%' OR lower(pd.tipo_documento) LIKE '%psicologic%'
          OR lower(pd.tipo_documento) LIKE '%capacidade_tecnica%' OR lower(pd.tipo_documento) LIKE 'exame%' THEN 'laudos'
        WHEN lower(pd.tipo_documento) LIKE 'requerimento%' THEN 'requerimento'
        WHEN lower(pd.tipo_documento) LIKE 'pergunta%' THEN 'perguntas'
        WHEN lower(pd.tipo_documento) LIKE '%endereco%' OR lower(pd.tipo_documento) LIKE '%residencia%'
          OR lower(pd.tipo_documento) LIKE '%titular_comprovante%' OR lower(pd.tipo_documento) = 'documento_identificacao_terceiro' THEN 'endereco'
        WHEN lower(pd.tipo_documento) IN ('cin','rg','rg_com_cpf','cnh','cpf','passaporte','foto','foto_3x4') THEN 'identificacao'
        ELSE 'outros'
      END
    ) AS grupo_id,
    COALESCE(NULLIF(sd.regra_validacao ->> 'ordem_grupo_checklist','')::integer,
      CASE COALESCE(sd.regra_validacao ->> 'grupo_checklist',
        CASE
          WHEN lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade') THEN 'efetiva_necessidade'
          WHEN lower(pd.tipo_documento) LIKE 'renda%' THEN 'ocupacao'
          WHEN lower(pd.tipo_documento) LIKE 'certidao%' OR lower(pd.tipo_documento) LIKE 'antecedentes%' THEN 'antecedentes'
          WHEN lower(pd.tipo_documento) LIKE '%laudo%' OR lower(pd.tipo_documento) LIKE '%psicologic%' THEN 'laudos'
          WHEN lower(pd.tipo_documento) LIKE 'requerimento%' THEN 'requerimento'
          WHEN lower(pd.tipo_documento) LIKE 'pergunta%' THEN 'perguntas'
          ELSE 'outros'
        END)
        WHEN 'assinaturas' THEN 10 WHEN 'perguntas' THEN 20 WHEN 'identificacao' THEN 30
        WHEN 'endereco' THEN 40 WHEN 'ocupacao' THEN 50 WHEN 'antecedentes' THEN 60
        WHEN 'habitualidade' THEN 70 WHEN 'arma' THEN 72 WHEN 'declaracoes' THEN 75
        WHEN 'efetiva_necessidade' THEN 80 WHEN 'laudos' THEN 90 WHEN 'requerimento' THEN 95
        ELSE 99 END
    ) AS grupo_ordem,
    COALESCE(sd.ordem, pd.ordem, 9999) AS item_ordem,
    CASE
      WHEN pd.regra_validacao ? 'dispensa_quando' THEN NOT (
        SELECT bool_and(COALESCE(pb.respostas ->> kv.key, '') = trim(both '"' from kv.value::text))
        FROM jsonb_each((pd.regra_validacao -> 'dispensa_quando')::jsonb) kv
      )
      WHEN jsonb_typeof(pd.regra_validacao -> 'depende_de') = 'object' THEN
        COALESCE(pb.respostas ->> (pd.regra_validacao #>> '{depende_de,chave}'), '') =
        COALESCE(pd.regra_validacao #>> '{depende_de,valor}', '')
      WHEN jsonb_typeof(pd.regra_validacao -> 'exige_quando') = 'object' THEN (
        SELECT bool_and(COALESCE(pb.respostas ->> kv.key, '') = trim(both '"' from kv.value::text))
        FROM jsonb_each((pd.regra_validacao -> 'exige_quando')::jsonb) kv
      )
      ELSE true
    END AS aplicavel,
    CASE WHEN COALESCE(pd.regra_validacao ->> 'tipo', '') = 'pergunta' THEN true ELSE false END AS eh_pergunta,
    CASE
      WHEN lower(COALESCE(pd.status,'')) IN ('aprovado','validado','concluido','concluído','entregue','ok','pre_validado','dispensado','dispensado_grupo','dispensado_por_reaproveitamento','nao_aplicavel','reaproveitado','hub_reaproveitado') THEN 'cumprido'
      WHEN lower(COALESCE(pd.status,'')) IN ('em_analise','analise','enviado','recebido','fila','processando','revisao_humana','em_revisao_humana','pendente_aprovacao','aguardando_aprovacao','aguardando_equipe') THEN 'analise'
      WHEN lower(COALESCE(pd.status,'')) IN ('substituido','excluido','descartado','descartado_por_troca_servico','cancelado','arquivado') THEN 'encerrado'
      ELSE 'pendencia'
    END AS familia
  FROM public.qa_processo_documentos pd
  JOIN processos_base pb ON pb.id = pd.processo_id
  LEFT JOIN public.qa_servicos_documentos sd
    ON sd.servico_id = pb.servico_id
   AND lower(sd.tipo_documento) = lower(pd.tipo_documento)
  WHERE COALESCE(pd.obrigatorio, true)
),
ef AS (
  SELECT
    e.processo_id,
    e.updated_at,
    (SELECT count(*) FROM public.qa_efetiva_necessidade_provas pv WHERE pv.efetiva_necessidade_id = e.id) AS provas_total,
    (SELECT count(*) FROM public.qa_efetiva_necessidade_provas pv WHERE pv.efetiva_necessidade_id = e.id AND pv.tipo = 'boletim_ocorrencia') AS bos,
    (SELECT count(*) FROM public.qa_efetiva_necessidade_provas pv WHERE pv.efetiva_necessidade_id = e.id AND pv.tipo = 'boletim_ocorrencia' AND COALESCE(pv.data_fato, pv.created_at::date) >= current_date - 183) AS bos_recentes,
    e.tem_bo, e.tem_inquerito, e.tem_acao_criminal, e.sofre_ameaca,
    e.relato_cliente, e.contexto_risco, e.narrativa_gerada, e.narrativa_final,
    e.bo_pendente_registro, e.aprovado_cliente,
    EXISTS (SELECT 1 FROM public.qa_cliente_ciencias ci WHERE ci.cliente_id=e.cliente_id AND ci.termo_codigo='bo_efetiva_necessidade') AS ciencia_bo
  FROM public.qa_efetiva_necessidade e
),
ef_calc AS (
  SELECT ef.processo_id, ef.updated_at AS efetiva_updated_at, 11::int AS passos_total,
    ((ef.tem_bo IS NOT NULL)::int + (ef.tem_inquerito IS NOT NULL)::int + (ef.tem_acao_criminal IS NOT NULL)::int + (ef.sofre_ameaca IS NOT NULL)::int
    + (CASE WHEN NOT (ef.tem_bo IS FALSE AND ef.tem_inquerito IS FALSE AND ef.tem_acao_criminal IS FALSE AND ef.provas_total=0)
              OR length(COALESCE(btrim(ef.relato_cliente),'')) >= 1000 THEN 1 ELSE 0 END)
    + (length(COALESCE(btrim(ef.contexto_risco),'')) > 0)::int
    + (length(COALESCE(btrim(COALESCE(ef.narrativa_final,ef.narrativa_gerada)),'')) > 0)::int
    + (ef.ciencia_bo OR bo.v)::int + bo.v::int + bo.v::int + (ef.aprovado_cliente IS TRUE)::int)::int AS passos_ok
  FROM ef
  CROSS JOIN LATERAL (SELECT (ef.bos > 0 AND (ef.bos_recentes > 0 OR ef.bos > 1 OR COALESCE(ef.bo_pendente_registro,false)=false)) AS v) bo
),
doc_totais AS (
  SELECT
    de.processo_id,
    count(*)::int AS docs_total,
    count(*) FILTER (WHERE de.familia='cumprido')::int AS docs_concluidos,
    count(*) FILTER (WHERE de.status='dispensado_grupo')::int AS dispensados,
    count(*) FILTER (WHERE de.status='dispensado_por_reaproveitamento')::int AS reaproveitados,
    count(*) FILTER (WHERE de.aplicavel AND de.familia='pendencia' AND NOT de.eh_pergunta)::int AS documentos_pendentes,
    count(*) FILTER (WHERE de.aplicavel AND de.familia='pendencia' AND de.eh_pergunta
      AND COALESCE(de.respostas ->> (de.regra_validacao ->> 'chave'),'')='')::int AS perguntas_pendentes,
    count(*) FILTER (WHERE de.aplicavel AND de.familia='analise')::int AS em_analise,
    count(*) FILTER (WHERE lower(de.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade'))::int AS efetiva_docs,
    count(*) FILTER (WHERE lower(de.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade') AND de.familia='cumprido')::int AS efetiva_docs_concluidos,
    max(de.data_envio) AS ultimo_envio,
    max(de.updated_at) AS ultima_mudanca
  FROM docs_enriquecidos de
  GROUP BY de.processo_id
),
acionaveis AS (
  SELECT de.*,
    row_number() OVER (PARTITION BY de.processo_id ORDER BY de.grupo_ordem, de.item_ordem, de.created_at) AS rn
  FROM docs_enriquecidos de
  WHERE de.aplicavel AND de.familia='pendencia'
    AND (NOT de.eh_pergunta OR COALESCE(de.respostas ->> (de.regra_validacao ->> 'chave'),'')='')
),
proximo AS (
  SELECT * FROM acionaveis WHERE rn=1
),
grupo_totais AS (
  SELECT
    pr.processo_id,
    pr.grupo_id,
    count(*)::int
      + CASE WHEN pr.grupo_id='efetiva_necessidade' AND max(dt.efetiva_docs)>0 THEN max(COALESCE(ec.passos_total,11))-1 ELSE 0 END AS grupo_total,
    count(*) FILTER (WHERE de.familia='cumprido')::int
      + CASE WHEN pr.grupo_id='efetiva_necessidade' AND max(dt.efetiva_docs)>0 THEN max(COALESCE(ec.passos_ok,0))-max(dt.efetiva_docs_concluidos) ELSE 0 END AS grupo_concluidos
  FROM proximo pr
  JOIN docs_enriquecidos de ON de.processo_id=pr.processo_id AND de.grupo_id=pr.grupo_id
  JOIN doc_totais dt ON dt.processo_id=pr.processo_id
  LEFT JOIN ef_calc ec ON ec.processo_id=pr.processo_id
  GROUP BY pr.processo_id, pr.grupo_id
),
ciencias AS (
  SELECT cliente_id, max(created_at) AS ultima_ciencia FROM public.qa_cliente_ciencias GROUP BY cliente_id
),
cob AS (
  SELECT processo_id, count(*)::int AS qtd FROM public.qa_inatividade_cobrancas WHERE status='enviado' GROUP BY processo_id
),
base AS (
  SELECT
    pb.id AS processo_id, pb.cliente_id, pb.cliente_nome, pb.cliente_email, pb.servico_nome, pb.status,
    (COALESCE(dt.docs_total,0) + CASE WHEN COALESCE(dt.efetiva_docs,0)>0 THEN COALESCE(ec.passos_total,11)-1 ELSE 0 END)::int AS total_docs,
    (COALESCE(dt.docs_concluidos,0) + CASE WHEN COALESCE(dt.efetiva_docs,0)>0 THEN COALESCE(ec.passos_ok,0)-COALESCE(dt.efetiva_docs_concluidos,0) ELSE 0 END)::int AS concluidos,
    COALESCE(dt.dispensados,0)::int AS dispensados,
    COALESCE(dt.reaproveitados,0)::int AS reaproveitados,
    COALESCE(dt.documentos_pendentes,0)::int AS documentos_pendentes,
    COALESCE(dt.perguntas_pendentes,0)::int AS perguntas_pendentes,
    COALESCE(dt.em_analise,0)::int AS em_analise,
    pr.grupo_id,
    COALESCE(gt.grupo_total,0)::int AS grupo_total,
    COALESCE(gt.grupo_concluidos,0)::int AS grupo_concluidos,
    COALESCE(pre.bloqueado,false) AS bloqueado,
    CASE WHEN pr.grupo_id='efetiva_necessidade' THEN 'Efetiva necessidade' ELSE COALESCE(NULLIF(pr.nome_documento,''),pr.tipo_documento) END AS proximo_doc,
    CASE WHEN pr.eh_pergunta THEN 'pergunta' ELSE 'documento' END AS proximo_tipo,
    GREATEST(pb.created_at, COALESCE(dt.ultimo_envio,pb.created_at), COALESCE(dt.ultima_mudanca,pb.created_at), COALESCE(ec.efetiva_updated_at,pb.created_at), COALESCE(ci.ultima_ciencia,pb.created_at)) AS ultima_atividade,
    COALESCE(cb.qtd,0) AS cobrancas,
    pb.created_at AS criado_em
  FROM processos_base pb
  LEFT JOIN prerequisitos pre ON pre.processo_id=pb.id
  LEFT JOIN doc_totais dt ON dt.processo_id=pb.id
  LEFT JOIN ef_calc ec ON ec.processo_id=pb.id
  LEFT JOIN proximo pr ON pr.processo_id=pb.id
  LEFT JOIN grupo_totais gt ON gt.processo_id=pb.id
  LEFT JOIN ciencias ci ON ci.cliente_id=pb.cliente_id
  LEFT JOIN cob cb ON cb.processo_id=pb.id
)
SELECT
  b.processo_id, b.cliente_id, b.cliente_nome, b.cliente_email, b.servico_nome, b.status,
  CASE
    WHEN b.bloqueado THEN 'AGUARDANDO ETAPA ANTERIOR'
    WHEN b.status IN ('protocolado','deferido','indeferido','em_exigencia') THEN 'ÓRGÃO'
    WHEN b.total_docs>0 AND b.concluidos>=b.total_docs THEN 'PRONTO'
    WHEN b.grupo_id='efetiva_necessidade' THEN 'EFETIVA NECESSIDADE'
    WHEN b.grupo_id='ocupacao' THEN 'OCUPAÇÃO LÍCITA'
    WHEN b.grupo_id='antecedentes' THEN 'CERTIDÕES'
    WHEN b.grupo_id='laudos' THEN 'EXAMES'
    WHEN b.grupo_id='requerimento' THEN 'PROTOCOLO'
    WHEN b.grupo_id='perguntas' THEN 'CADASTRO'
    ELSE 'DOCUMENTOS'
  END AS fase,
  b.total_docs,
  greatest(0,least(b.concluidos,b.total_docs)) AS entregues,
  b.dispensados,
  b.reaproveitados,
  b.documentos_pendentes,
  b.perguntas_pendentes,
  b.em_analise,
  CASE b.grupo_id
    WHEN 'efetiva_necessidade' THEN 'EFETIVA NECESSIDADE'
    WHEN 'ocupacao' THEN 'OCUPAÇÃO LÍCITA'
    WHEN 'antecedentes' THEN 'IDONEIDADE'
    WHEN 'laudos' THEN 'LAUDOS'
    WHEN 'requerimento' THEN 'REQUERIMENTO'
    WHEN 'perguntas' THEN 'CADASTROS'
    WHEN 'identificacao' THEN 'IDENTIFICAÇÃO CIVIL'
    WHEN 'endereco' THEN 'IDENTIFICAÇÃO RESIDENCIAL'
    ELSE upper(replace(COALESCE(b.grupo_id,'outros'),'_',' '))
  END AS grupo_atual,
  b.grupo_total,
  greatest(0,least(b.grupo_concluidos,b.grupo_total)) AS grupo_concluidos,
  b.bloqueado AS bloqueado_por_prerequisito,
  CASE WHEN b.bloqueado THEN 'Aguardando conclusão da etapa anterior' ELSE b.proximo_doc END AS proximo_doc,
  CASE WHEN b.bloqueado THEN 'bloqueio' ELSE b.proximo_tipo END AS proximo_tipo,
  b.ultima_atividade,
  floor(extract(epoch FROM (now()-b.ultima_atividade))/86400)::int AS dias_parado,
  b.cobrancas,
  b.criado_em
FROM base b
WHERE b.total_docs>0 OR b.bloqueado;
$function$;

REVOKE ALL ON FUNCTION public.qa_painel_progresso_clientes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_painel_progresso_clientes() TO authenticated, service_role;