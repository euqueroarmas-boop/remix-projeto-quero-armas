-- =============================================================================
-- WAVE 3B — Completar tipos_documento novos com link, instruções e validade
-- =============================================================================
-- Data: 2026-05-18
-- Objetivo: preencher os campos auxiliares (link_emissao, instrucoes,
-- validade_dias, prazo_recomendado_dias, orgao_emissor) dos 2 tipo_documento
-- introduzidos nas Waves 2 e 3 que nasceram com esses campos vazios.
--
-- Não cria, não remove. Apenas UPDATE em registros existentes.
-- Idempotente — pode rodar várias vezes sem efeito colateral.
-- =============================================================================
BEGIN;

-- comprovante_efetiva_necessidade (porte de arma — Decreto 11.615 art. 24)
-- Usado nos serviços 41 (porte-arma-fogo) e 37 (renovacao-de-porte-...)
-- Não tem link de órgão público porque é documentação que o cliente monta
-- a partir da sua atividade profissional/situação de risco.
UPDATE qa_servicos_documentos
SET 
  link_emissao = NULL,
  instrucoes = 'Você precisa comprovar necessidade real do porte de arma. São aceitos: ' ||
               '(1) carta de cliente VIP comprovando atividade de risco; ' ||
               '(2) Boletim de Ocorrência demonstrando ameaça concreta à integridade física; ' ||
               '(3) declaração de atividade profissional de risco (transportador de valores, ' ||
               'segurança privada, motorista de aplicativo em zona de risco, joalheiro, etc.); ' ||
               '(4) outras evidências objetivas e atuais (últimos 12 meses). ' ||
               'Em caso de dúvida, fale com a Quero Armas pelo WhatsApp.',
  validade_dias = 365,
  prazo_recomendado_dias = 30,
  orgao_emissor = 'Cliente / Empregador / Autoridade Policial',
  updated_at = now()
WHERE tipo_documento = 'comprovante_efetiva_necessidade';

-- habilitacao_cacador_ibama (autorização de compra caçador — IN 311/2025)
-- Usado no serviço 51 (autorizacao-de-compra-...-cacador-cac).
UPDATE qa_servicos_documentos
SET 
  link_emissao = 'https://www.gov.br/ibama/pt-br',
  instrucoes = 'Habilitação ambiental como caçador, exigida para autorização de compra ' ||
               'no regime caçador (CAC). São aceitos: ' ||
               '(1) Licença Ambiental de Caça emitida pelo IBAMA; ' ||
               '(2) Autorização de Caça Amadora vigente; ' ||
               '(3) declaração de habilitação como caçador de subsistência (regiões específicas, ' ||
               'mediante comprovação). A habilitação deve estar dentro da validade na data ' ||
               'do protocolo do pedido de autorização de compra.',
  validade_dias = 365,
  prazo_recomendado_dias = 60,
  orgao_emissor = 'IBAMA / IBRAM',
  updated_at = now()
WHERE tipo_documento = 'habilitacao_cacador_ibama';

COMMIT;