BEGIN;

-- Posse de Arma de Fogo (servico_id=35) — pergunta-pivot opt-in para habitualidade CAC.
-- Não afeta CR Atirador (id 32) nem outros serviços.

INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa,
  obrigatorio, ordem, ativo, regra_validacao
)
SELECT
  35,
  'pergunta_anexar_habitualidade_cac',
  'Você é atirador CAC com CR vigente e quer anexar a declaração de habitualidade do clube para fortalecer o pedido de defesa pessoal?',
  'complementar',
  true,
  5,
  true,
  jsonb_build_object(
    'tipo', 'pergunta',
    'chave', 'anexar_habitualidade_cac',
    'opcoes', jsonb_build_array(
      jsonb_build_object('valor','sim','label','Sim, tenho CR vigente e vou anexar a habitualidade'),
      jsonb_build_object('valor','nao','label','Não tenho CR ou prefiro seguir sem anexar')
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_servicos_documentos
   WHERE servico_id = 35
     AND tipo_documento = 'pergunta_anexar_habitualidade_cac'
);

UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
       || jsonb_build_object(
            'exige_quando',
            jsonb_build_object('anexar_habitualidade_cac', 'sim')
          )
 WHERE servico_id = 35
   AND tipo_documento = 'declaracao_habitualidade_clube';

COMMIT;