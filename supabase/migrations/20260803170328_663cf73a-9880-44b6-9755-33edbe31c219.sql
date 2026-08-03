UPDATE public.qa_servicos_documentos
SET regra_validacao = (regra_validacao - 'cria_documentos_por_condicao')
  || jsonb_build_object(
      'tipo', 'pergunta',
      'chave', 'condicao_profissional',
      'opcoes', jsonb_build_array(
        jsonb_build_object('label','CLT — carteira assinada','valor','clt'),
        jsonb_build_object('label','Servidor público (área geral)','valor','funcionario_publico'),
        jsonb_build_object('label','Servidor de segurança pública (PM, PC, PF, PRF, Guarda, Bombeiro, agente penitenciário)','valor','seguranca_publica'),
        jsonb_build_object('label','Autônomo ou MEI','valor','autonomo'),
        jsonb_build_object('label','Empresário ou sócio','valor','empresario'),
        jsonb_build_object('label','Aposentado ou pensionista','valor','aposentado')
      )
    ),
    updated_at = now()
WHERE tipo_documento = 'renda_definir_condicao'
  AND (regra_validacao->>'tipo' IS DISTINCT FROM 'pergunta'
       OR regra_validacao->'opcoes' IS NULL
       OR jsonb_array_length(COALESCE(regra_validacao->'opcoes','[]'::jsonb)) = 0);