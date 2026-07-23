-- Certidao estadual: o item "Justica Estadual" e um agrupador conceitual.
-- O cliente nao baixa nada desse item pai; ele entrega as 4 certidoes filhas.
-- Base legal operacional: Lei 10.826/2003, Decreto 11.615/2023,
-- Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311.

INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   observacao_cliente, validade_dias, formato_aceito, link_emissao, base_legal,
   emissor_padrao, ativo)
VALUES
  (
    'certidao_estadual_distribuicao_acoes_criminais',
    'Certidão Estadual — Distribuição de Ações Criminais',
    'certidoes',
    'Certidão da Justiça Estadual que informa a existência ou inexistência de ações criminais distribuídas em nome do requerente.',
    'Emita no Tribunal de Justiça do seu estado e envie o PDF original. Em São Paulo, use a certidão de Distribuição de Ações Criminais.',
    'Uma das certidões estaduais obrigatórias. O nome deve bater com o documento de identificação.',
    60,
    ARRAY['pdf'],
    NULL,
    'Lei 10.826/2003; Decreto 11.615/2023; Decreto 12.345/2024; IN DG/PF 201; IN DG/PF 311',
    'cliente',
    true
  ),
  (
    'certidao_estadual_execucoes_criminais',
    'Certidão Estadual — Execuções Criminais',
    'certidoes',
    'Certidão da Justiça Estadual que informa a existência ou inexistência de execuções criminais em nome do requerente.',
    'Emita no Tribunal de Justiça do seu estado e envie o PDF original. Em São Paulo, use a certidão de Execuções Criminais.',
    'Não substitui a certidão de distribuição; são conferências diferentes.',
    60,
    ARRAY['pdf'],
    NULL,
    'Lei 10.826/2003; Decreto 11.615/2023; Decreto 12.345/2024; IN DG/PF 201; IN DG/PF 311',
    'cliente',
    true
  ),
  (
    'certidao_estadual_policia_civil',
    'Certidão Estadual — Polícia Civil',
    'certidoes',
    'Certidão estadual emitida pela Polícia Civil, quando disponível no estado do requerente.',
    'Emita a certidão estadual da Polícia Civil do seu estado, quando disponível, e envie o PDF original.',
    'Pode variar conforme o estado. A equipe confere se o órgão local oferece esta consulta.',
    60,
    ARRAY['pdf'],
    NULL,
    'Lei 10.826/2003; Decreto 11.615/2023; Decreto 12.345/2024; IN DG/PF 201; IN DG/PF 311',
    'cliente',
    true
  ),
  (
    'certidao_estadual_justica_militar',
    'Certidão Estadual — Tribunal de Justiça Militar',
    'certidoes',
    'Certidão estadual emitida pelo Tribunal de Justiça Militar, quando disponível no estado do requerente.',
    'Emita a certidão estadual do Tribunal de Justiça Militar do seu estado, quando disponível, e envie o PDF original.',
    'Pode variar conforme o estado. A equipe confere se o tribunal local oferece esta consulta.',
    60,
    ARRAY['pdf'],
    NULL,
    'Lei 10.826/2003; Decreto 11.615/2023; Decreto 12.345/2024; IN DG/PF 201; IN DG/PF 311',
    'cliente',
    true
  )
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    categoria = EXCLUDED.categoria,
    descricao_o_que_e = EXCLUDED.descricao_o_que_e,
    descricao_como_enviar = EXCLUDED.descricao_como_enviar,
    observacao_cliente = EXCLUDED.observacao_cliente,
    validade_dias = EXCLUDED.validade_dias,
    formato_aceito = EXCLUDED.formato_aceito,
    link_emissao = EXCLUDED.link_emissao,
    base_legal = EXCLUDED.base_legal,
    emissor_padrao = EXCLUDED.emissor_padrao,
    ativo = true,
    arquivado_em = NULL,
    updated_at = now();

WITH pares AS (
  SELECT 'certidao_estadual_segundo_grau_acoes_criminais'::text AS antigo,
         'certidao_estadual_policia_civil'::text AS novo
  UNION ALL
  SELECT 'certidao_estadual_segundo_grau_execucoes_criminais'::text AS antigo,
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
    biblioteca_id = a.biblioteca_id,
    ativo = true,
    updated_at = now()
FROM alvos a
WHERE sd.tipo_documento = a.antigo
  AND NOT EXISTS (
    SELECT 1
    FROM public.qa_servicos_documentos existente
    WHERE existente.servico_id = sd.servico_id
      AND existente.tipo_documento = a.novo
      AND COALESCE(existente.condicao_profissional, '') = COALESCE(sd.condicao_profissional, '')
      AND existente.id <> sd.id
  );

WITH pares AS (
  SELECT 'certidao_estadual_segundo_grau_acoes_criminais'::text AS antigo
  UNION ALL
  SELECT 'certidao_estadual_segundo_grau_execucoes_criminais'::text AS antigo
)
UPDATE public.qa_servicos_documentos sd
SET ativo = false,
    updated_at = now()
FROM pares p
WHERE sd.tipo_documento = p.antigo;

UPDATE public.qa_servicos_documentos
SET ativo = false,
    updated_at = now()
WHERE tipo_documento = 'certidao_antecedentes_criminais_estadual';

UPDATE public.qa_documentos_biblioteca
SET ativo = false,
    arquivado_em = COALESCE(arquivado_em, now()),
    nome = CASE
      WHEN codigo = 'certidao_antecedentes_criminais_estadual'
        THEN 'GRUPO — Certidão de Antecedentes Criminais — Justiça Estadual'
      WHEN codigo = 'certidao_estadual_segundo_grau_acoes_criminais'
        THEN 'LEGADO — Certidão Estadual — Polícia Civil'
      WHEN codigo = 'certidao_estadual_segundo_grau_execucoes_criminais'
        THEN 'LEGADO — Certidão Estadual — Tribunal de Justiça Militar'
      ELSE nome
    END,
    observacao_cliente = CASE
      WHEN codigo = 'certidao_antecedentes_criminais_estadual'
        THEN 'Item pai usado apenas para organização interna. O cliente deve entregar as 4 certidões estaduais filhas.'
      ELSE observacao_cliente
    END,
    updated_at = now()
WHERE codigo IN (
  'certidao_antecedentes_criminais_estadual',
  'certidao_estadual_segundo_grau_acoes_criminais',
  'certidao_estadual_segundo_grau_execucoes_criminais'
);
