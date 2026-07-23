-- Corrige a inferência indevida de "2º grau" no pacote de certidões estaduais.
-- Mantém a organização em 4 exigências, mas com nomes/códigos corretos:
-- distribuição, execuções, Polícia Civil e Tribunal de Justiça Militar.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.qa_documentos_biblioteca
    WHERE codigo = 'certidao_estadual_segundo_grau_acoes_criminais'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.qa_documentos_biblioteca
    WHERE codigo = 'certidao_estadual_policia_civil'
  ) THEN
    UPDATE public.qa_documentos_biblioteca
       SET codigo = 'certidao_estadual_policia_civil',
           nome = 'Certidão Estadual — Polícia Civil',
           descricao_o_que_e = 'Certidão estadual emitida pela Polícia Civil, quando disponível no estado do requerente.',
           descricao_como_enviar = 'Emita a certidão estadual da Polícia Civil do seu estado e envie o PDF original.',
           updated_at = now()
     WHERE codigo = 'certidao_estadual_segundo_grau_acoes_criminais';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.qa_documentos_biblioteca
    WHERE codigo = 'certidao_estadual_segundo_grau_execucoes_criminais'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.qa_documentos_biblioteca
    WHERE codigo = 'certidao_estadual_justica_militar'
  ) THEN
    UPDATE public.qa_documentos_biblioteca
       SET codigo = 'certidao_estadual_justica_militar',
           nome = 'Certidão Estadual — Tribunal de Justiça Militar',
           descricao_o_que_e = 'Certidão estadual emitida pelo Tribunal de Justiça Militar, quando disponível no estado do requerente.',
           descricao_como_enviar = 'Emita a certidão estadual do Tribunal de Justiça Militar do seu estado, quando disponível, e envie o PDF original.',
           updated_at = now()
     WHERE codigo = 'certidao_estadual_segundo_grau_execucoes_criminais';
  END IF;
END $$;

UPDATE public.qa_servicos_documentos
   SET tipo_documento = 'certidao_estadual_policia_civil',
       nome_documento = 'Certidão Estadual — Polícia Civil'
 WHERE tipo_documento = 'certidao_estadual_segundo_grau_acoes_criminais';

UPDATE public.qa_servicos_documentos
   SET tipo_documento = 'certidao_estadual_justica_militar',
       nome_documento = 'Certidão Estadual — Tribunal de Justiça Militar'
 WHERE tipo_documento = 'certidao_estadual_segundo_grau_execucoes_criminais';

INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   observacao_cliente, validade_dias, formato_aceito, link_emissao, base_legal, ativo)
VALUES
  (
    'certidao_estadual_policia_civil',
    'Certidão Estadual — Polícia Civil',
    'certidoes',
    'Certidão estadual emitida pela Polícia Civil, quando disponível no estado do requerente.',
    'Emita a certidão estadual da Polícia Civil do seu estado e envie o PDF original.',
    'Pode variar conforme o estado. A equipe confere se o órgão local oferece esta consulta.',
    30,
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
    'Pode variar conforme o estado. A equipe confere se o órgão local oferece esta consulta.',
    30,
    ARRAY['pdf'],
    NULL,
    'IN DG/PF 201',
    true
  )
ON CONFLICT (codigo) DO NOTHING;
