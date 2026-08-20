-- =============================================================================
-- qa_painel_progresso_itens(_processo_id) — ABRE OS CHIPS DA COLUNA PROGRESSO
--
-- Os chips do painel (PENDENTE(S), CADASTRO, EM ANÁLISE, REAPROVEITADOS,
-- NÃO SE APLICA) mostram só o NÚMERO. Esta função devolve a LISTA por trás de
-- cada número, item a item, para o pop-up do painel.
--
-- FUNÇÃO NOVA, SOMENTE LEITURA. Nada existente é alterado: nem
-- qa_painel_progresso_clientes, nem tabelas, nem gatilhos.
--
-- A classificação (grupo, aplicável, família de status, pergunta respondida) é
-- CÓPIA FIEL da usada em qa_painel_progresso_clientes, incluindo
-- `entregue_pelo_hub` como cumprido. Cada linha já vem com as bandeiras
-- conta_* — a soma de cada bandeira bate exatamente com o número do chip.
-- =============================================================================

DROP FUNCTION IF EXISTS public.qa_painel_progresso_itens(uuid);

CREATE OR REPLACE FUNCTION public.qa_painel_progresso_itens(_processo_id uuid)
 RETURNS TABLE(
   documento_id uuid,
   tipo_documento text,
   nome_documento text,
   grupo_id text,
   grupo_nome text,
   grupo_ordem integer,
   item_ordem integer,
   status text,
   familia text,
   aplicavel boolean,
   eh_pergunta boolean,
   pergunta_chave text,
   pergunta_resposta text,
   conta_pendente boolean,
   conta_cadastro boolean,
   conta_analise boolean,
   conta_entregue boolean,
   conta_reaproveitado boolean,
   conta_nao_se_aplica boolean,
   data_envio timestamp with time zone,
   atualizado_em timestamp with time zone,
   motivo_rejeicao text,
   observacoes text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH processo_base AS (
  SELECT
    p.*,
    COALESCE(p.respostas_questionario_json, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
        'categoria_titular', lower(NULLIF(btrim(cl.categoria_titular), '')),
        'titular_profissao', NULLIF(btrim(cl.profissao), '')
      )) AS respostas
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
  WHERE p.id = _processo_id
),
docs_enriquecidos AS (
  SELECT
    pd.id,
    pd.tipo_documento,
    pd.nome_documento,
    pd.status,
    pd.data_envio,
    pd.updated_at,
    pd.motivo_rejeicao,
    pd.observacoes,
    pd.regra_validacao,
    pb.respostas,
    NULLIF(replace(COALESCE(sd.regra_validacao ->> 'grupo_checklist',
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
    ), 'saude', 'laudos'), '') AS grupo_id,
    CASE replace(COALESCE(sd.regra_validacao ->> 'grupo_checklist',
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
        END), 'saude', 'laudos')
      WHEN 'assinaturas' THEN 10 WHEN 'perguntas' THEN 20 WHEN 'identificacao' THEN 30
      WHEN 'endereco' THEN 40 WHEN 'ocupacao' THEN 50 WHEN 'antecedentes' THEN 60
      WHEN 'habitualidade' THEN 70 WHEN 'arma' THEN 72 WHEN 'declaracoes' THEN 75
      WHEN 'efetiva_necessidade' THEN 80 WHEN 'laudos' THEN 90 WHEN 'requerimento' THEN 95
      ELSE 99 END AS grupo_ordem,
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
      WHEN lower(COALESCE(pd.status,'')) IN ('aprovado','validado','concluido','concluído','entregue','ok','pre_validado','dispensado','dispensado_grupo','dispensado_por_reaproveitamento','entregue_pelo_hub','nao_aplicavel','reaproveitado','hub_reaproveitado') THEN 'cumprido'
      WHEN lower(COALESCE(pd.status,'')) IN ('em_analise','analise','enviado','recebido','fila','processando','revisao_humana','em_revisao_humana','pendente_aprovacao','aguardando_aprovacao','aguardando_equipe') THEN 'analise'
      WHEN lower(COALESCE(pd.status,'')) IN ('substituido','excluido','descartado','descartado_por_troca_servico','cancelado','arquivado') THEN 'encerrado'
      ELSE 'pendencia'
    END AS familia
  FROM public.qa_processo_documentos pd
  JOIN processo_base pb ON pb.id = pd.processo_id
  LEFT JOIN public.qa_servicos_documentos sd
    ON sd.servico_id = pb.servico_id
   AND lower(sd.tipo_documento) = lower(pd.tipo_documento)
  WHERE COALESCE(pd.obrigatorio, true)
)
SELECT
  de.id AS documento_id,
  de.tipo_documento,
  de.nome_documento,
  de.grupo_id,
  COALESCE(g.nome, initcap(replace(COALESCE(de.grupo_id,'outros'), '_', ' '))) AS grupo_nome,
  de.grupo_ordem,
  de.item_ordem,
  de.status,
  de.familia,
  de.aplicavel,
  de.eh_pergunta,
  (de.regra_validacao ->> 'chave')::text AS pergunta_chave,
  NULLIF(COALESCE(de.respostas ->> (de.regra_validacao ->> 'chave'), ''), '') AS pergunta_resposta,
  -- Bandeiras: a soma de cada uma bate com o número mostrado no chip.
  (de.aplicavel AND de.familia = 'pendencia' AND NOT de.eh_pergunta) AS conta_pendente,
  (de.aplicavel AND de.familia = 'pendencia' AND de.eh_pergunta
    AND COALESCE(de.respostas ->> (de.regra_validacao ->> 'chave'), '') = '') AS conta_cadastro,
  (de.aplicavel AND de.familia = 'analise') AS conta_analise,
  (de.familia = 'cumprido' AND lower(COALESCE(de.status,'')) NOT IN ('dispensado_grupo','nao_aplicavel')) AS conta_entregue,
  (de.status = 'dispensado_por_reaproveitamento') AS conta_reaproveitado,
  (de.status = 'dispensado_grupo') AS conta_nao_se_aplica,
  de.data_envio,
  de.updated_at AS atualizado_em,
  de.motivo_rejeicao,
  de.observacoes
FROM docs_enriquecidos de
LEFT JOIN LATERAL (
  -- `qa_checklist_grupos` pode ter o mesmo slug para vários serviços; um JOIN
  -- direto duplicaria a linha do documento e inflaria a lista do pop-up.
  SELECT cg.nome FROM public.qa_checklist_grupos cg
   WHERE cg.slug = de.grupo_id
   ORDER BY cg.servico_id NULLS LAST, cg.ordem
   LIMIT 1
) g ON true
ORDER BY de.grupo_ordem, de.item_ordem, de.tipo_documento;
$function$;

GRANT EXECUTE ON FUNCTION public.qa_painel_progresso_itens(uuid) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.qa_painel_progresso_itens(uuid) IS
  'Lista, item a item, o que cada chip da coluna PROGRESSO do painel está contando. Somente leitura.';
