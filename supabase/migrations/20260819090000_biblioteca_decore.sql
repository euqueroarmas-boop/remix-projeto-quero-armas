-- ============================================================================
-- Biblioteca: DECORE — Declaração Comprobatória de Percepção de Rendimentos
-- ----------------------------------------------------------------------------
-- Decisão do titular em 19/08/2026: o DECORE do dossiê do Wellington fica
-- registrado na Biblioteca de Documentos e treinado no parser, mas NÃO vira
-- exigência de nenhum serviço por enquanto — só entra em checklist no dia em
-- que um cliente precisar comprovar renda por ele.
--
-- Por isso este bloco cria APENAS a linha da Biblioteca (`renda_decore`).
-- Nenhuma linha em qa_servicos_documentos, nenhum tipo novo no vocabulário do
-- Hub — a Biblioteca tem espaço de códigos próprio (cartao_cnpj_mei e
-- renda_ctps_digital já vivem assim) e o treino de modelos grava em
-- qa_documentos_modelos_aprovados com tipo_documento = codigo.
--
-- O TREINO DO PARSER NÃO É SQL: depois de colar este bloco, a equipe abre
-- Configurações → Biblioteca de Documentos → DECORE e envia o PDF do Wellington
-- como arquivo-modelo. É o upload que dispara a edge function
-- qa-modelo-biblioteca-treinar (análise determinística + embedding). Quando
-- houver um segundo DECORE, subir também — com 2+ modelos o selo da linha fica
-- completo e a comparação da IA ganha base.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

INSERT INTO public.qa_documentos_biblioteca (
  codigo, nome, categoria,
  descricao_o_que_e, descricao_como_enviar, observacao_cliente,
  validade_dias, formato_aceito, link_emissao, link_modelo,
  base_legal, emissor_padrao, ativo
) VALUES (
  'renda_decore',
  'DECORE — Declaração Comprobatória de Percepção de Rendimentos',
  'ocupacao_licita',
  'Declaração emitida por contador registrado no CRC que comprova os rendimentos '
  || 'de profissional liberal ou autônomo, com fonte pagadora, período e valor. '
  || 'Serve como comprovante de ocupação lícita quando não há holerite nem CNPJ.',
  '1) Peça o DECORE ao seu contador — ele emite pelo sistema do CRC.\n'
  || '2) Confira se constam seu nome, CPF, a fonte pagadora, o período e o valor.\n'
  || '3) Envie o PDF completo, com as duas páginas e o selo do CRC.',
  'O DECORE vale 90 dias a partir da emissão. Documento vencido será recusado.',
  90,
  ARRAY['pdf'],
  NULL,
  NULL,
  'Resolução CFC n.º 1.592/2020',
  'Contador registrado no CRC',
  true
)
ON CONFLICT (codigo) DO UPDATE
  SET nome                  = EXCLUDED.nome,
      categoria             = EXCLUDED.categoria,
      descricao_o_que_e     = EXCLUDED.descricao_o_que_e,
      descricao_como_enviar = EXCLUDED.descricao_como_enviar,
      observacao_cliente    = EXCLUDED.observacao_cliente,
      validade_dias         = EXCLUDED.validade_dias,
      base_legal            = EXCLUDED.base_legal,
      emissor_padrao        = EXCLUDED.emissor_padrao,
      ativo                 = true,
      arquivado_em          = NULL,
      arquivado_por         = NULL,
      updated_at            = now();

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) A linha na Biblioteca:
--
-- SELECT codigo, nome, categoria, validade_dias, base_legal, ativo
--   FROM public.qa_documentos_biblioteca WHERE codigo = 'renda_decore';
--
-- 2) Depois que a equipe subir o PDF do Wellington pela tela da Biblioteca,
--    o modelo treinado aparece aqui (1 linha, det e ia preenchidos):
--
-- SELECT tipo_documento, count(*) AS modelos,
--        count(*) FILTER (WHERE texto_ocr_normalizado IS NOT NULL) AS det,
--        count(*) FILTER (WHERE embedding_texto IS NOT NULL)       AS ia
--   FROM public.qa_documentos_modelos_aprovados
--  WHERE ativo AND tipo_documento = 'renda_decore'
--  GROUP BY tipo_documento;
