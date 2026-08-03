-- 1) desativa exigências indevidas de servidor
UPDATE public.qa_servicos_documentos
SET ativo = false
WHERE condicao_profissional IN ('funcionario_publico','seguranca_publica')
  AND tipo_documento IN ('renda_holerite_funcionario_publico','renda_carteira_funcional');

-- 2) contra cheque digital deixa de ser "sem condição"
UPDATE public.qa_servicos_documentos
SET ativo = false
WHERE tipo_documento = 'contra_cheque_digital'
  AND condicao_profissional IS NULL;

-- 3) cria/ativa Identidade Funcional Digital + Contra Cheque Digital por condição
DO $$
DECLARE s RECORD; c TEXT; d RECORD;
BEGIN
  FOR s IN
    SELECT DISTINCT servico_id
    FROM public.qa_servicos_documentos
    WHERE tipo_documento = 'renda_definir_condicao'
  LOOP
    FOREACH c IN ARRAY ARRAY['funcionario_publico','seguranca_publica'] LOOP
      FOR d IN
        SELECT * FROM (VALUES
          ('identidade_funcional_digital','Identidade Funcional Digital',210),
          ('contra_cheque_digital','Contra Cheque Digital',220)
        ) AS t(cod, nome, ord)
      LOOP
        IF EXISTS (
          SELECT 1 FROM public.qa_servicos_documentos
          WHERE servico_id = s.servico_id AND tipo_documento = d.cod AND condicao_profissional = c
        ) THEN
          UPDATE public.qa_servicos_documentos
          SET ativo = true,
              obrigatorio = true,
              nome_documento = d.nome,
              etapa = 'condicao_profissional',
              ordem = d.ord,
              regra_validacao = COALESCE(regra_validacao,'{}'::jsonb)
                || jsonb_build_object('grupo_checklist','ocupacao','ordem_grupo_checklist',30)
          WHERE servico_id = s.servico_id AND tipo_documento = d.cod AND condicao_profissional = c;
        ELSE
          INSERT INTO public.qa_servicos_documentos
            (servico_id, tipo_documento, nome_documento, etapa, ordem, ativo, obrigatorio, condicao_profissional, regra_validacao)
          VALUES
            (s.servico_id, d.cod, d.nome, 'condicao_profissional', d.ord, true, true, c,
             jsonb_build_object('grupo_checklist','ocupacao','ordem_grupo_checklist',30));
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;