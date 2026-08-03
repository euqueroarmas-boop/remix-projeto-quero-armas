-- 1) Alinha os atestados institucionais ao grupo/ordem do grupo da pergunta pivô
WITH pivo AS (
  SELECT servico_id,
         COALESCE(regra_validacao->>'grupo_checklist','saude') AS grupo,
         COALESCE((regra_validacao->>'ordem_grupo_checklist')::int, 60) AS ordem_grupo,
         ordem AS ordem_pivo
  FROM public.qa_servicos_documentos
  WHERE tipo_documento = 'exames_instituicao_definir'
)
UPDATE public.qa_servicos_documentos d
SET regra_validacao = COALESCE(d.regra_validacao,'{}'::jsonb)
      || jsonb_build_object(
           'grupo_checklist', p.grupo,
           'ordem_grupo_checklist', p.ordem_grupo,
           'exige_quando', jsonb_build_object('exames_instituicao','sim')
         ),
    condicao_profissional = 'seguranca_publica',
    ativo = true,
    ordem = p.ordem_pivo + CASE WHEN d.tipo_documento = 'atestado_aptidao_psicologica_instituicao' THEN 1 ELSE 2 END,
    updated_at = now()
FROM pivo p
WHERE d.servico_id = p.servico_id
  AND d.tipo_documento IN ('atestado_aptidao_psicologica_instituicao','atestado_capacidade_tecnica_instituicao');

-- 2) Garante a dispensa dos laudos de credenciados quando o cliente usa os exames da instituição
WITH pivo AS (
  SELECT DISTINCT servico_id FROM public.qa_servicos_documentos
  WHERE tipo_documento = 'exames_instituicao_definir'
)
UPDATE public.qa_servicos_documentos d
SET regra_validacao = COALESCE(d.regra_validacao,'{}'::jsonb)
      || jsonb_build_object('dispensa_quando', jsonb_build_object('exames_instituicao','sim')),
    updated_at = now()
FROM pivo p
WHERE d.servico_id = p.servico_id
  AND d.tipo_documento IN ('laudo_psicologico','laudo_capacidade_tecnica');