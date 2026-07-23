-- Organiza a exigência de Justiça Estadual como pacote auditável.
-- Base legal operacional: Lei 10.826/2003, Decreto 11.615/2023,
-- Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311.
-- A IN DG/PF 201 exige certidões e comprovação de idoneidade; estes itens
-- desdobram a parte estadual para reduzir erro humano na coleta documental.

INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   observacao_cliente, validade_dias, formato_aceito, link_emissao, base_legal, ativo)
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
    'IN DG/PF 201',
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
    'IN DG/PF 201',
    true
  ),
  (
    'certidao_estadual_policia_civil',
    'Certidão Estadual — Polícia Civil',
    'certidoes',
    'Certidão estadual emitida pela Polícia Civil, quando disponível no estado do requerente.',
    'Emita a certidão estadual da Polícia Civil do seu estado e envie o PDF original.',
    'Pode variar conforme o estado. A equipe confere se o tribunal local oferece esta consulta.',
    60,
    ARRAY['pdf'],
    NULL,
    'IN DG/PF 201',
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
    'IN DG/PF 201',
    true
  )
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao_o_que_e = EXCLUDED.descricao_o_que_e,
  descricao_como_enviar = EXCLUDED.descricao_como_enviar,
  observacao_cliente = EXCLUDED.observacao_cliente,
  validade_dias = EXCLUDED.validade_dias,
  formato_aceito = EXCLUDED.formato_aceito,
  link_emissao = EXCLUDED.link_emissao,
  base_legal = EXCLUDED.base_legal,
  ativo = true,
  updated_at = now();
