-- Swap TJSP - Ações Criminais → Justiça Militar da União (STM) no processo do piloto (cliente 211)
UPDATE public.qa_processo_documentos
   SET tipo_documento = 'certidao_crimes_militares_stm',
       status = 'pendente',
       updated_at = now()
 WHERE tipo_documento = 'certidao_estadual_distribuicao_acoes_criminais'
   AND processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = 211);

-- Garante link_emissao do STM no catálogo global (para todos os serviços que já pedem essa certidão)
UPDATE public.qa_servicos_documentos
   SET link_emissao = 'https://www.stm.jus.br/servicos-stm/certidao-negativa/emitir-certidao',
       updated_at = now()
 WHERE tipo_documento = 'certidao_crimes_militares_stm'
   AND (link_emissao IS NULL OR link_emissao = '');
