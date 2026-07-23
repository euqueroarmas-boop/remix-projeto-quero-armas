-- Requerimento de posse: a validade e de 15 dias apenas depois do protocolo.
-- Base legal operacional: Lei 10.826/2003, Decreto 11.615/2023,
-- Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311.

UPDATE public.qa_documentos_biblioteca
SET validade_dias = 15,
    descricao_como_enviar = 'Nao se preocupe. A nossa equipe solicitara e protocolara o requerimento. A validade de 15 dias conta somente depois do protocolo.',
    observacao_cliente = 'Validade de 15 dias somente depois do protocolo.',
    base_legal = COALESCE(NULLIF(base_legal, ''), 'IN DG/PF 201'),
    updated_at = now()
WHERE ativo
  AND (
    codigo IN ('requerimento_de_posse_de_arma_de_fogo', 'requerimento_posse_arma_fogo')
    OR (
      lower(nome) LIKE '%requerimento%'
      AND lower(nome) LIKE '%posse%'
      AND lower(nome) LIKE '%arma%'
    )
  );

UPDATE public.qa_servicos_documentos
SET validade_dias = 15,
    instrucoes = COALESCE(
      NULLIF(instrucoes, ''),
      'Nao se preocupe. A nossa equipe solicitara e protocolara o requerimento. A validade de 15 dias conta somente depois do protocolo.'
    ),
    observacoes_cliente = 'Validade de 15 dias somente depois do protocolo.',
    updated_at = now()
WHERE ativo
  AND (
    tipo_documento IN ('requerimento_de_posse_de_arma_de_fogo', 'requerimento_posse_arma_fogo')
    OR (
      lower(nome_documento) LIKE '%requerimento%'
      AND lower(nome_documento) LIKE '%posse%'
      AND lower(nome_documento) LIKE '%arma%'
    )
  );
