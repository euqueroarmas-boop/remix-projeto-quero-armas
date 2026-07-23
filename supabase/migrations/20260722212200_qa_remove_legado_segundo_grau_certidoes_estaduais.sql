-- Remove da configuracao visivel os registros legados criados com a premissa
-- errada de "2º grau". Se algum checklist já usou esses códigos, move para
-- os códigos corretos quando não houver duplicidade.

WITH pares AS (
  SELECT
    'certidao_estadual_segundo_grau_acoes_criminais'::text AS antigo,
    'certidao_estadual_policia_civil'::text AS novo
  UNION ALL
  SELECT
    'certidao_estadual_segundo_grau_execucoes_criminais'::text AS antigo,
    'certidao_estadual_justica_militar'::text AS novo
),
alvos AS (
  SELECT p.antigo, p.novo, b.id AS biblioteca_id, b.nome
  FROM pares p
  JOIN public.qa_documentos_biblioteca b ON b.codigo = p.novo
)
DELETE FROM public.qa_servicos_documentos antigo_doc
USING alvos a
WHERE antigo_doc.tipo_documento = a.antigo
  AND EXISTS (
    SELECT 1
    FROM public.qa_servicos_documentos novo_doc
    WHERE novo_doc.servico_id = antigo_doc.servico_id
      AND novo_doc.tipo_documento = a.novo
      AND COALESCE(novo_doc.condicao_profissional, '') = COALESCE(antigo_doc.condicao_profissional, '')
  );

WITH pares AS (
  SELECT
    'certidao_estadual_segundo_grau_acoes_criminais'::text AS antigo,
    'certidao_estadual_policia_civil'::text AS novo
  UNION ALL
  SELECT
    'certidao_estadual_segundo_grau_execucoes_criminais'::text AS antigo,
    'certidao_estadual_justica_militar'::text AS novo
),
alvos AS (
  SELECT p.antigo, p.novo, b.id AS biblioteca_id, b.nome
  FROM pares p
  JOIN public.qa_documentos_biblioteca b ON b.codigo = p.novo
)
UPDATE public.qa_servicos_documentos sd
SET tipo_documento = a.novo,
    nome_documento = a.nome,
    biblioteca_id = a.biblioteca_id
FROM alvos a
WHERE sd.tipo_documento = a.antigo;

UPDATE public.qa_documentos_biblioteca
SET ativo = false,
    arquivado_em = COALESCE(arquivado_em, now()),
    nome = CASE
      WHEN nome ILIKE '%arquivado%' THEN nome
      ELSE nome || ' (arquivado)'
    END,
    updated_at = now()
WHERE codigo IN (
  'certidao_estadual_segundo_grau_acoes_criminais',
  'certidao_estadual_segundo_grau_execucoes_criminais'
);
