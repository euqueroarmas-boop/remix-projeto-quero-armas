-- Renomeia "Contrato de Prestação de Serviços" para "Contrato de Adesão de
-- Serviços" — categoria jurídica específica do art. 54 do Código de Defesa
-- do Consumidor (cláusulas pré-estabelecidas unilateralmente pelo
-- fornecedor, sem possibilidade de negociação individual pelo
-- consumidor). É a nomenclatura correta para o modelo de contratação da
-- Quero Armas (cláusulas fixas, aceite eletrônico, sem negociação),
-- reforçando — não enfraquecendo — as proteções já implementadas
-- (cláusulas destacadas) na migration 20260621020000.
--
-- Roda depois de 20260621020000 (reescrita completa), operando sobre o
-- corpo_html já atualizado.
UPDATE public.qa_contract_templates
   SET titulo = replace(titulo, 'Contrato de Prestação de Serviços', 'Contrato de Adesão de Serviços'),
       corpo_html = replace(
         replace(
           corpo_html,
           '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>',
           '<h1>CONTRATO DE ADESÃO DE SERVIÇOS</h1>'
         ),
         'celebrar o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORIA TÉCNICA E DESPACHO ADMINISTRATIVO, regido pelas seguintes cláusulas e condições',
         'celebrar o presente CONTRATO DE ADESÃO DE SERVIÇOS DE ASSESSORIA TÉCNICA E DESPACHO ADMINISTRATIVO, nos termos do art. 54 da Lei nº 8.078/1990 (Código de Defesa do Consumidor), regido pelas seguintes cláusulas e condições'
       ),
       updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND titulo LIKE '%Contrato de Prestação de Serviços%';
