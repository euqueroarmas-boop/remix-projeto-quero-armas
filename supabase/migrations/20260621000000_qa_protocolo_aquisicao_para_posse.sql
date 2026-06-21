-- O serviço "aquisicao-registro-posse-de-arma-de-fogo" (combo "Aquisição,
-- registro e posse" vendido na Defesa Pessoal) gerava protocolos com sigla
-- AQUISICAO (QAAQUISICAO20260005, etc.) — genérico demais e juridicamente
-- impreciso: o processo de fato resultante na Polícia Federal é de POSSE,
-- mesma categoria do serviço avulso "posse-de-arma-fogo" (sigla POSSE).
--
-- Decisão do usuário: os dois serviços compartilham a mesma sigla/sequência
-- QAPOSSE (não criamos uma sigla nova só para o combo).
--
-- Esta migration só afeta GERAÇÕES FUTURAS de protocolo (qa_gerar_protocolo
-- lê sigla_protocolo do catálogo no momento da chamada). Protocolos já
-- emitidos com sigla AQUISICAO NÃO são renumerados aqui — renomear um
-- protocolo oficial já comunicado ao cliente/PF é uma decisão separada,
-- avaliada caso a caso.
UPDATE public.qa_servicos_catalogo
   SET sigla_protocolo = 'POSSE'
 WHERE slug = 'aquisicao-registro-posse-de-arma-de-fogo'
   AND sigla_protocolo IS DISTINCT FROM 'POSSE';
