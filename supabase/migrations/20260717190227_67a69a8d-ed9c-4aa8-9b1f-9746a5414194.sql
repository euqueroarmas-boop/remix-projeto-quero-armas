-- Insere placeholders {{itens_contratados_bloco}} e {{clausula_pagamento_bloco}}
-- no template vigente. Placeholders vazios substituem para "" no substitute(),
-- então o texto atual permanece igual quando não há dados extras a exibir.
UPDATE public.qa_contract_templates
SET corpo_html = replace(
      replace(
        corpo_html,
        E'eletrônico.</p>\n<h2>CLÁUSULA SEGUNDA',
        E'eletrônico.</p>\n{{itens_contratados_bloco}}\n<h2>CLÁUSULA SEGUNDA'
      ),
      E'bancário.</p>\n<p>3.3.',
      E'bancário.</p>\n{{clausula_pagamento_bloco}}\n<p>3.3.'
    ),
    versao = versao + 1,
    updated_at = now()
WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
  AND vigente = true
  AND position('{{itens_contratados_bloco}}' in corpo_html) = 0;